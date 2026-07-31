import {
  createInitialGameState,
  CURRENT_GAME_STATE_VERSION,
  isSystemCommandIdFor,
  type GameCommand,
  type GameState,
  type TransactionReceipt,
} from './state';
import type {
  InventoryPolicy,
  OwnedItemInstance,
} from './economy';
import { getOwnedQuantity } from './economy';
import {
  energyCostForDuration,
  japanDayIndex,
  pauseRunningSessionAfterLoad,
} from './study';
import {
  HOUSE_LEVEL_MILESTONES,
  achievementDefinitionFingerprint,
  houseLevelForFocusMinutes,
  levelForExperience,
  type AchievementDefinition,
} from './progression';
import { dayForWorldMinute, weatherForDay } from './world';
import {
  isFiniteNumber,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isSafeIdentifier,
  type JsonValue,
} from './types';

export const SAVE_FORMAT = 'komorebi-house-save';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  schemaVersion: number;
  revision: number;
  savedAtUtcMs: number;
  checksum: string;
  state: GameState;
}

export interface SaveWarning {
  code: string;
  message: string;
}

export interface SaveLoadError {
  code: 'INVALID_JSON' | 'INVALID_SHAPE' | 'FUTURE_VERSION' | 'CHECKSUM_MISMATCH';
  message: string;
  issues?: string[];
}

export type SaveLoadResult =
  | {
      ok: true;
      state: GameState;
      warnings: SaveWarning[];
      sourceVersion: number;
      migrated: boolean;
    }
  | { ok: false; error: SaveLoadError };

export interface DecodeSaveOptions {
  catalogVersion?: string;
  migrationUtcMs?: number;
  defaultPlayerName?: string;
  weatherSeed?: number;
  inventoryPolicyForItem?: (itemId: string) => InventoryPolicy | undefined;
  achievementDefinitions?: readonly AchievementDefinition[];
  knownLocationIds?: readonly string[];
}

interface LegacySaveV1 {
  version: 1;
  location: string;
  coins: number;
  ownedItems: Record<string, number>;
  placedDecor?: JsonValue[];
  playerName?: string;
}

export interface MigratedSaveV2 {
  schemaVersion: 2;
  revision: number;
  catalogVersion: string;
  createdAtUtcMs: number;
  lastObservedUtcMs: number;
  playerName: string;
  currencyId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  inventoryStacks: Record<string, number>;
  inventoryInstances: Record<string, OwnedItemInstance>;
  inventoryPolicies: Record<string, InventoryPolicy>;
  currentLocationId: string;
  unlockedLocationIds: string[];
  visitCounts: Record<string, number>;
  extensions: Record<string, JsonValue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function uniqueStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => isSafeIdentifier(entry)) &&
    new Set(value).size === value.length
  );
}

function positiveIntegerRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, amount]) =>
        isSafeIdentifier(key) && isPositiveSafeInteger(amount),
    )
  );
}

function nonNegativeIntegerRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, amount]) =>
        isSafeIdentifier(key) && isNonNegativeSafeInteger(amount),
    )
  );
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function checksumFor(value: unknown): string {
  const text = stableJson(value);
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function detectVersion(value: Record<string, unknown>): number | null {
  if (isRecord(value.meta) && isNonNegativeSafeInteger(value.meta.schemaVersion)) {
    return value.meta.schemaVersion;
  }
  if (isNonNegativeSafeInteger(value.schemaVersion)) return value.schemaVersion;
  if (value.version === 1 && 'coins' in value && 'ownedItems' in value) return 1;
  return null;
}

function parseLegacyV1(value: Record<string, unknown>): LegacySaveV1 | null {
  if (
    value.version !== 1 ||
    typeof value.location !== 'string' ||
    !value.location ||
    !isNonNegativeSafeInteger(value.coins) ||
    !positiveIntegerRecord(value.ownedItems) ||
    Object.keys(value.ownedItems).some((itemId) => !isSafeIdentifier(itemId))
  ) {
    return null;
  }
  if (value.placedDecor !== undefined) {
    if (!Array.isArray(value.placedDecor) || !value.placedDecor.every(isJsonValue)) return null;
    const instanceIds = new Set<string>();
    const placedCounts: Record<string, number> = {};
    for (const placement of value.placedDecor) {
      if (
        !isRecord(placement) ||
        !isSafeIdentifier(placement.instanceId) ||
        !isSafeIdentifier(placement.itemId) ||
        !isSafeIdentifier(placement.location) ||
        instanceIds.has(placement.instanceId)
      ) {
        return null;
      }
      instanceIds.add(placement.instanceId);
      placedCounts[placement.itemId] = (placedCounts[placement.itemId] ?? 0) + 1;
    }
    if (
      Object.entries(placedCounts).some(
        ([itemId, count]) =>
          count >
          ((value.ownedItems as Record<string, number>)[itemId] ?? 0),
      )
    ) {
      return null;
    }
  }
  return {
    version: 1,
    location: value.location,
    coins: value.coins,
    ownedItems: value.ownedItems,
    placedDecor: value.placedDecor as JsonValue[] | undefined,
    playerName: typeof value.playerName === 'string' ? value.playerName : undefined,
  };
}

export function migrateSaveV1ToV2(
  legacy: LegacySaveV1,
  options: DecodeSaveOptions = {},
): MigratedSaveV2 {
  const migrationUtcMs = options.migrationUtcMs ?? 0;
  if (!isNonNegativeSafeInteger(migrationUtcMs)) {
    throw new RangeError('Migration time must be a non-negative safe integer.');
  }
  const placedLocations = (legacy.placedDecor ?? [])
    .map((entry) =>
      isRecord(entry) && typeof entry.location === 'string' ? entry.location : null,
    )
    .filter((entry): entry is string => Boolean(entry));
  const unlockedLocationIds = [...new Set([legacy.location, ...placedLocations])];
  const migrationInstances: Record<string, OwnedItemInstance> = {};
  const migrationStacks: Record<string, number> = {};
  const migrationPolicies: Record<string, InventoryPolicy> = {};
  const reservedPlacementInstanceIds = new Set(
    (legacy.placedDecor ?? [])
      .map((placement) =>
        isRecord(placement) ? placement.instanceId : undefined,
      )
      .filter((instanceId): instanceId is string =>
        isSafeIdentifier(instanceId),
      ),
  );
  const placementsByItem = new Map<string, Record<string, unknown>[]>();
  for (const placement of legacy.placedDecor ?? []) {
    if (!isRecord(placement) || typeof placement.itemId !== 'string') continue;
    const entries = placementsByItem.get(placement.itemId) ?? [];
    entries.push(placement);
    placementsByItem.set(placement.itemId, entries);
  }
  for (const [itemId, quantity] of Object.entries(legacy.ownedItems)) {
    const placements = placementsByItem.get(itemId) ?? [];
    if (placements.length === 0) {
      migrationStacks[itemId] = quantity;
      migrationPolicies[itemId] = { storage: 'stack' };
      continue;
    }
    migrationPolicies[itemId] = { storage: 'instance' };
    for (const placement of placements) {
      const instanceId = placement.instanceId as string;
      migrationInstances[instanceId] = {
        instanceId,
        itemId,
        acquiredAtUtcMs: migrationUtcMs,
        disposition: {
          kind: 'placed',
          placementId: instanceId,
          locationId: placement.location as string,
        },
      };
    }
    for (let index = placements.length; index < quantity; index += 1) {
      let instanceId = `legacy:${itemId}:${index + 1}`;
      while (
        migrationInstances[instanceId] ||
        reservedPlacementInstanceIds.has(instanceId)
      ) {
        instanceId = `${instanceId}:owned`;
      }
      migrationInstances[instanceId] = {
        instanceId,
        itemId,
        acquiredAtUtcMs: migrationUtcMs,
        disposition: { kind: 'stored' },
      };
    }
  }
  const migratedWorlds: Record<string, JsonValue> = {};
  for (const placement of legacy.placedDecor ?? []) {
    if (
      !isRecord(placement) ||
      !isSafeIdentifier(placement.location) ||
      !isSafeIdentifier(placement.instanceId) ||
      !isSafeIdentifier(placement.itemId)
    ) {
      continue;
    }
    const existing = migratedWorlds[placement.location];
    const items =
      isRecord(existing) && Array.isArray(existing.items)
        ? [...existing.items]
        : [];
    items.push({
      instanceId: placement.instanceId,
      itemId: placement.itemId,
      position: {
        x:
          typeof placement.x === 'number' &&
          Number.isFinite(placement.x)
            ? placement.x
            : 0,
        y:
          typeof placement.y === 'number' &&
          Number.isFinite(placement.y)
            ? placement.y
            : 0,
      },
      rotation: [0, 90, 180, 270].includes(
        placement.rotation as number,
      )
        ? (placement.rotation as number)
        : 0,
    });
    migratedWorlds[placement.location] = {
      schemaVersion: 1,
      worldId: placement.location,
      revision: 0,
      items,
    };
  }
  return {
    schemaVersion: 2,
    revision: 0,
    catalogVersion: 'legacy-v1',
    createdAtUtcMs: migrationUtcMs,
    lastObservedUtcMs: migrationUtcMs,
    playerName: legacy.playerName?.trim() || options.defaultPlayerName || 'Haru',
    currencyId: 'hikari',
    balance: legacy.coins,
    lifetimeEarned: legacy.coins,
    lifetimeSpent: 0,
    inventoryStacks: migrationStacks,
    inventoryInstances: migrationInstances,
    inventoryPolicies: migrationPolicies,
    currentLocationId: legacy.location,
    unlockedLocationIds,
    visitCounts: { [legacy.location]: 1 },
    extensions: {
      legacyWorld: {
        schemaVersion: 1,
        placedDecor: legacy.placedDecor ?? [],
      },
      ...migratedWorlds,
    },
  };
}

function parseSaveV2(value: Record<string, unknown>): MigratedSaveV2 | null {
  if (
    value.schemaVersion !== 2 ||
    !isNonNegativeSafeInteger(value.revision) ||
    typeof value.catalogVersion !== 'string' ||
    !isNonNegativeSafeInteger(value.createdAtUtcMs) ||
    !isNonNegativeSafeInteger(value.lastObservedUtcMs) ||
    typeof value.playerName !== 'string' ||
    !isSafeIdentifier(value.currencyId) ||
    !isNonNegativeSafeInteger(value.balance) ||
    !isNonNegativeSafeInteger(value.lifetimeEarned) ||
    !isNonNegativeSafeInteger(value.lifetimeSpent) ||
    !positiveIntegerRecord(value.inventoryStacks) ||
    (value.inventoryInstances !== undefined &&
      (!isRecord(value.inventoryInstances) ||
        !Object.values(value.inventoryInstances).every(isJsonValue))) ||
    (value.inventoryPolicies !== undefined &&
      (!isRecord(value.inventoryPolicies) ||
        !Object.values(value.inventoryPolicies).every(isJsonValue))) ||
    !isSafeIdentifier(value.currentLocationId) ||
    !uniqueStrings(value.unlockedLocationIds) ||
    !positiveIntegerRecord(value.visitCounts) ||
    !isRecord(value.extensions) ||
    !Object.values(value.extensions).every(isJsonValue)
  ) {
    return null;
  }
  if (value.lifetimeEarned - value.lifetimeSpent !== value.balance) return null;
  const inventoryInstances =
    (value.inventoryInstances as Record<string, OwnedItemInstance> | undefined) ??
    {};
  const inventoryPolicies =
    (value.inventoryPolicies as Record<string, InventoryPolicy> | undefined) ??
    Object.fromEntries(
      Object.keys(value.inventoryStacks).map((itemId) => [
        itemId,
        { storage: 'stack' as const },
      ]),
    );
  return {
    schemaVersion: 2,
    revision: value.revision,
    catalogVersion: value.catalogVersion,
    createdAtUtcMs: value.createdAtUtcMs,
    lastObservedUtcMs: value.lastObservedUtcMs,
    playerName: value.playerName,
    currencyId: value.currencyId,
    balance: value.balance,
    lifetimeEarned: value.lifetimeEarned,
    lifetimeSpent: value.lifetimeSpent,
    inventoryStacks: value.inventoryStacks,
    inventoryInstances,
    inventoryPolicies,
    currentLocationId: value.currentLocationId,
    unlockedLocationIds: value.unlockedLocationIds,
    visitCounts: value.visitCounts,
    extensions: value.extensions as Record<string, JsonValue>,
  };
}

export function migrateSaveV2ToV3(
  legacy: MigratedSaveV2,
  options: DecodeSaveOptions = {},
): GameState {
  const base = createInitialGameState({
    nowUtcMs: legacy.lastObservedUtcMs,
    playerName: legacy.playerName,
    initialBalance: legacy.balance,
    currencyId: legacy.currencyId,
    initialLocationId: legacy.currentLocationId,
    unlockedLocationIds: legacy.unlockedLocationIds,
    catalogVersion: legacy.catalogVersion,
    weatherSeed: options.weatherSeed,
    extensions: legacy.extensions,
  });
  return {
    ...base,
    meta: {
      ...base.meta,
      // V2 had no complete command journal. Resetting the optimistic revision
      // is safer than pretending historical transactions can be replay-guarded.
      revision: 0,
      createdAtUtcMs: legacy.createdAtUtcMs,
      lastObservedUtcMs: legacy.lastObservedUtcMs,
    },
    economy: {
      ...base.economy,
      wallet: {
        ...base.economy.wallet,
        balance: legacy.balance,
        lifetimeEarned: legacy.lifetimeEarned,
        lifetimeSpent: legacy.lifetimeSpent,
      },
      inventory: {
        ...base.economy.inventory,
        stacks: { ...legacy.inventoryStacks },
        instances: { ...legacy.inventoryInstances },
        policies: { ...legacy.inventoryPolicies },
      },
    },
    travel: {
      ...base.travel,
      visitCounts: { ...legacy.visitCounts },
    },
  };
}

/**
 * Version 4 made transaction fingerprints, persisted inventory policy,
 * checkpoint proof, daily minute accumulation, and achievement-definition
 * receipts explicit. Older v3 saves are upgraded conservatively: unverified
 * command/achievement receipts cannot be replayed for new rewards.
 */
export function migrateSaveV3ToV4(
  legacy: Record<string, unknown>,
  options: DecodeSaveOptions = {},
): GameState | null {
  if (!isJsonValue(legacy)) return null;
  const cloned = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
  if (
    !isRecord(cloned.meta) ||
    cloned.meta.schemaVersion !== 3 ||
    !isRecord(cloned.economy) ||
    !isRecord(cloned.economy.inventory) ||
    !isRecord(cloned.study) ||
    !isRecord(cloned.progression)
  ) {
    return null;
  }
  const progression = cloned.progression as Record<string, unknown>;

  cloned.meta.schemaVersion = CURRENT_GAME_STATE_VERSION;
  if (isRecord(cloned.meta.processedTransactions)) {
    for (const receipt of Object.values(cloned.meta.processedTransactions)) {
      if (isRecord(receipt) && typeof receipt.commandFingerprint !== 'string') {
        receipt.commandFingerprint = 'legacy-unverified';
      }
    }
  }

  const inventory = cloned.economy.inventory;
  if (!isRecord(inventory.stacks) || !isRecord(inventory.instances)) return null;
  if (!isRecord(inventory.policies)) {
    const policies: Record<string, JsonValue> = {};
    for (const itemId of Object.keys(inventory.stacks)) {
      policies[itemId] = { storage: 'stack' };
    }
    for (const instance of Object.values(inventory.instances)) {
      if (!isRecord(instance) || typeof instance.itemId !== 'string') return null;
      const existingPolicy = policies[instance.itemId];
      if (
        isRecord(existingPolicy) &&
        existingPolicy.storage === 'instance'
      ) {
        continue;
      }
      if (existingPolicy) return null;
      policies[instance.itemId] = { storage: 'instance' };
    }
    inventory.policies = policies;
  }

  if (cloned.study.focusedMinutesToday === undefined) {
    cloned.study.focusedMinutesToday = 0;
  } else if (!isNonNegativeSafeInteger(cloned.study.focusedMinutesToday)) {
    return null;
  }
  if (
    cloned.study.dailyRhythmBonusClaimedDay !== null &&
    cloned.study.dailyRhythmBonusClaimedDay !== undefined &&
    !isNonNegativeSafeInteger(cloned.study.dailyRhythmBonusClaimedDay)
  ) {
    return null;
  }
  if (cloned.study.dailyRhythmBonusClaimedDay === undefined) {
    cloned.study.dailyRhythmBonusClaimedDay = null;
  }
  if (!isRecord(cloned.study.rewardLedger)) {
    if (
      !isNonNegativeSafeInteger(cloned.study.completedSessions) ||
      !isNonNegativeSafeInteger(cloned.study.totalFocusMinutes) ||
      !isNonNegativeSafeInteger(cloned.study.rewardDay) ||
      !isNonNegativeSafeInteger(cloned.study.rewardedHikariToday) ||
      !isNonNegativeSafeInteger(cloned.study.focusedMinutesToday)
    ) {
      return null;
    }
    cloned.study.rewardLedger = {
      baseline: {
        completedSessions: cloned.study.completedSessions,
        totalFocusMinutes: cloned.study.totalFocusMinutes,
        rewardDay: cloned.study.rewardDay,
        rewardedHikariOnRewardDay: cloned.study.rewardedHikariToday,
        focusedMinutesOnRewardDay: cloned.study.focusedMinutesToday,
        rhythmBonusClaimedDay:
          cloned.study.dailyRhythmBonusClaimedDay,
      },
      receipts: {},
    };
  }
  if (isRecord(cloned.study.activeSession)) {
    const session = cloned.study.activeSession;
    if (
      !isNonNegativeSafeInteger(session.startedAtUtcMs) ||
      !isNonNegativeSafeInteger(session.accumulatedActiveMs) ||
      !isNonNegativeSafeInteger(cloned.meta.lastObservedUtcMs)
    ) {
      return null;
    }
    const wallAvailable = Math.max(
      0,
      cloned.meta.lastObservedUtcMs - session.startedAtUtcMs,
    );
    session.accumulatedActiveMs = Math.min(
      session.accumulatedActiveMs,
      wallAvailable,
    );
    session.lastCheckpointAtUtcMs = cloned.meta.lastObservedUtcMs;
    session.status = 'paused';
  }

  if (!isNonNegativeSafeInteger(progression.experience)) return null;
  if (!isPositiveSafeInteger(progression.level)) return null;
  progression.experienceLevel = levelForExperience(
    progression.experience,
  );
  progression.claimedLevelGrantLevels = HOUSE_LEVEL_MILESTONES
    .filter(
      (milestone) => milestone.level <= (progression.level as number),
    )
    .map((milestone) => milestone.level);
  const unlocked = uniqueStrings(progression.unlockedAchievementIds)
    ? progression.unlockedAchievementIds
    : [];
  if (!isRecord(progression.achievementDefinitionFingerprints)) {
    progression.achievementDefinitionFingerprints =
      Object.fromEntries(
        unlocked.map((id) => [id, 'legacy-unverified']),
      );
  }
  return cloned as unknown as GameState;
}

/**
 * Early version 4 builds did not yet persist the per-session reward ledger.
 * Preserve their aggregate totals as a migration baseline so an existing
 * browser save is not discarded merely because it predates that invariant.
 */
export function migrateSaveV4ToV5(
  legacy: Record<string, unknown>,
): GameState | null {
  if (!isJsonValue(legacy)) return null;
  const cloned = JSON.parse(JSON.stringify(legacy)) as Record<
    string,
    unknown
  >;
  if (
    !isRecord(cloned.meta) ||
    cloned.meta.schemaVersion !== 4 ||
    !isRecord(cloned.study)
  ) {
    return null;
  }
  cloned.meta.schemaVersion = CURRENT_GAME_STATE_VERSION;
  if (!isRecord(cloned.study.rewardLedger)) {
    if (
      !isNonNegativeSafeInteger(cloned.study.completedSessions) ||
      !isNonNegativeSafeInteger(cloned.study.totalFocusMinutes) ||
      !isNonNegativeSafeInteger(cloned.study.rewardDay) ||
      !isNonNegativeSafeInteger(cloned.study.rewardedHikariToday) ||
      !isNonNegativeSafeInteger(cloned.study.focusedMinutesToday) ||
      (cloned.study.dailyRhythmBonusClaimedDay !== null &&
        !isNonNegativeSafeInteger(
          cloned.study.dailyRhythmBonusClaimedDay,
        ))
    ) {
      return null;
    }
    cloned.study.rewardLedger = {
      baseline: {
        completedSessions: cloned.study.completedSessions,
        totalFocusMinutes: cloned.study.totalFocusMinutes,
        rewardDay: cloned.study.rewardDay,
        rewardedHikariOnRewardDay: cloned.study.rewardedHikariToday,
        focusedMinutesOnRewardDay: cloned.study.focusedMinutesToday,
        rhythmBonusClaimedDay:
          cloned.study.dailyRhythmBonusClaimedDay,
      },
      receipts: {},
    };
  }
  return cloned as unknown as GameState;
}

function validReceipt(value: unknown, id: string, revision: number): value is TransactionReceipt {
  if (!isRecord(value)) return false;
  return (
    value.transactionId === id &&
    isPositiveSafeInteger(value.revision) &&
    value.revision <= revision &&
    typeof value.commandType === 'string' &&
    isNonNegativeSafeInteger(value.committedAtUtcMs) &&
    typeof value.commandFingerprint === 'string' &&
    (/^[0-9a-f]{8}$/.test(value.commandFingerprint) ||
      value.commandFingerprint === 'legacy-unverified')
  );
}

function validateGameStateIssues(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return ['state must be an object'];
  const state = value as unknown as GameState;

  if (!isRecord(state.meta)) issues.push('meta must be an object');
  else {
    if (state.meta.schemaVersion !== CURRENT_GAME_STATE_VERSION) issues.push('meta.schemaVersion is unsupported');
    if (!isNonNegativeSafeInteger(state.meta.revision)) issues.push('meta.revision must be a non-negative integer');
    if (!state.meta.catalogVersion) issues.push('meta.catalogVersion may not be empty');
    if (!isNonNegativeSafeInteger(state.meta.createdAtUtcMs)) issues.push('meta.createdAtUtcMs is invalid');
    if (!isNonNegativeSafeInteger(state.meta.lastObservedUtcMs)) issues.push('meta.lastObservedUtcMs is invalid');
    if (state.meta.createdAtUtcMs > state.meta.lastObservedUtcMs) issues.push('created time is after last observed time');
    if (!isRecord(state.meta.processedTransactions)) issues.push('processedTransactions must be an object');
    else {
      const receiptRevisions = new Set<number>();
      for (const [id, receipt] of Object.entries(state.meta.processedTransactions)) {
        if (
          !isSafeIdentifier(id) ||
          !validReceipt(receipt, id, state.meta.revision)
        ) {
          issues.push(`invalid transaction receipt: ${id}`);
        } else {
          receiptRevisions.add(receipt.revision);
        }
      }
      if (
        Object.keys(state.meta.processedTransactions).length !==
          state.meta.revision ||
        receiptRevisions.size !== state.meta.revision
      ) {
        issues.push('transaction journal does not cover every revision');
      }
    }
  }

  if (!isRecord(state.profile) || typeof state.profile.playerName !== 'string' || !state.profile.playerName) {
    issues.push('profile.playerName may not be empty');
  }

  if (!isRecord(state.economy) || !isRecord(state.economy.wallet) || !isRecord(state.economy.inventory)) {
    issues.push('economy state is malformed');
  } else {
    const wallet = state.economy.wallet;
    if (
      !isSafeIdentifier(wallet.currencyId) ||
      !isNonNegativeSafeInteger(wallet.balance) ||
      !isNonNegativeSafeInteger(wallet.lifetimeEarned) ||
      !isNonNegativeSafeInteger(wallet.lifetimeSpent)
    ) {
      issues.push('wallet values are invalid');
    } else if (wallet.lifetimeEarned - wallet.lifetimeSpent !== wallet.balance) {
      issues.push('wallet ledger does not reconcile');
    }
    if (
      !nonNegativeIntegerRecord(state.economy.inventory.stacks) ||
      Object.keys(state.economy.inventory.stacks).some(
        (itemId) => !isSafeIdentifier(itemId),
      )
    ) {
      issues.push('inventory stacks are invalid');
    } else if (Object.values(state.economy.inventory.stacks).some((quantity) => quantity === 0)) {
      issues.push('inventory stacks may not contain zero quantities');
    }
    if (!isRecord(state.economy.inventory.policies)) {
      issues.push('inventory policies are invalid');
    }
    if (!isRecord(state.economy.inventory.instances)) {
      issues.push('inventory instances are invalid');
    } else {
      const placementIds = new Set<string>();
      for (const [id, instance] of Object.entries(state.economy.inventory.instances)) {
        if (
          !isRecord(instance) ||
          instance.instanceId !== id ||
          !isSafeIdentifier(id) ||
          !isSafeIdentifier(instance.itemId) ||
          !isNonNegativeSafeInteger(instance.acquiredAtUtcMs) ||
          !isRecord(instance.disposition)
        ) {
          issues.push(`invalid inventory instance: ${id}`);
          continue;
        }
        if (instance.disposition.kind === 'placed') {
          if (
            !isSafeIdentifier(instance.disposition.placementId) ||
            !isSafeIdentifier(instance.disposition.locationId)
          ) {
            issues.push(`invalid placed disposition: ${id}`);
          } else if (placementIds.has(instance.disposition.placementId)) {
            issues.push(`duplicate placement id: ${instance.disposition.placementId}`);
          } else {
            placementIds.add(instance.disposition.placementId);
          }
        } else if (instance.disposition.kind !== 'stored') {
          issues.push(`invalid item disposition: ${id}`);
        }
      }
    }
    if (
      isRecord(state.economy.inventory.policies) &&
      isRecord(state.economy.inventory.instances) &&
      isRecord(state.economy.inventory.stacks)
    ) {
      const ownedItemIds = new Set([
        ...Object.keys(state.economy.inventory.stacks),
        ...Object.values(state.economy.inventory.instances)
          .filter(isRecord)
          .map((instance) =>
            typeof instance.itemId === 'string' ? instance.itemId : '',
          )
          .filter(Boolean),
      ]);
      for (const itemId of ownedItemIds) {
        const policy = state.economy.inventory.policies[itemId];
        if (
          !isSafeIdentifier(itemId) ||
          !isRecord(policy) ||
          (policy.storage !== 'stack' && policy.storage !== 'instance') ||
          (policy.unique !== undefined && typeof policy.unique !== 'boolean') ||
          (policy.maxOwned !== undefined &&
            !isPositiveSafeInteger(policy.maxOwned))
        ) {
          issues.push(`invalid inventory policy: ${itemId}`);
          continue;
        }
        const stackQuantity = state.economy.inventory.stacks[itemId] ?? 0;
        const instanceQuantity = Object.values(
          state.economy.inventory.instances,
        ).filter(
          (instance) =>
            isRecord(instance) && instance.itemId === itemId,
        ).length;
        const total = stackQuantity + instanceQuantity;
        if (
          (policy.storage === 'stack' && instanceQuantity > 0) ||
          (policy.storage === 'instance' && stackQuantity > 0) ||
          (policy.unique === true && total > 1) ||
          (policy.maxOwned !== undefined && total > policy.maxOwned)
        ) {
          issues.push(`inventory ownership violates policy: ${itemId}`);
        }
      }
    }
    if (
      !uniqueStrings(state.economy.processedTransactionIds) ||
      state.economy.processedTransactionIds.some(
        (id) => !isSafeIdentifier(id),
      )
    ) {
      issues.push('economy transaction ids are invalid');
    } else if (isRecord(state.meta?.processedTransactions)) {
      const aggregateIds = Object.keys(state.meta.processedTransactions);
      if (
        state.economy.processedTransactionIds.some(
          (id) =>
            !aggregateIds.some(
              (aggregateId) =>
                id === aggregateId ||
                id.startsWith(`${aggregateId}:`) ||
                isSystemCommandIdFor(aggregateId, id),
            ),
        )
      ) {
        issues.push('economy transaction ids are absent from the aggregate journal');
      }
    }
  }

  if (!isRecord(state.study)) issues.push('study state is malformed');
  else {
    if (
      !isNonNegativeSafeInteger(state.study.energy) ||
      !isPositiveSafeInteger(state.study.maxEnergy) ||
      state.study.energy > state.study.maxEnergy
    ) {
      issues.push('study energy is invalid');
    }
    for (const key of [
      'lastEnergyRefreshDay',
      'streak',
      'bestStreak',
      'totalFocusMinutes',
      'completedSessions',
      'rewardedHikariToday',
      'focusedMinutesToday',
      'rewardDay',
    ] as const) {
      if (!isNonNegativeSafeInteger(state.study[key])) issues.push(`study.${key} is invalid`);
    }
    if (
      state.study.lastCompletedDay !== null &&
      !isNonNegativeSafeInteger(state.study.lastCompletedDay)
    ) {
      issues.push('study.lastCompletedDay is invalid');
    }
    if (
      state.study.dailyRhythmBonusClaimedDay !== null &&
      !isNonNegativeSafeInteger(state.study.dailyRhythmBonusClaimedDay)
    ) {
      issues.push('study.dailyRhythmBonusClaimedDay is invalid');
    }
    if (state.study.bestStreak < state.study.streak) issues.push('best streak is below current streak');
    const completedSessionIdsAreValid = uniqueStrings(
      state.study.completedSessionIds,
    );
    if (!completedSessionIdsAreValid) {
      issues.push('completed study ids are invalid');
    }
    const ledger = state.study.rewardLedger;
    if (
      !isRecord(ledger) ||
      !isRecord(ledger.baseline) ||
      !isRecord(ledger.receipts)
    ) {
      issues.push('study reward ledger is malformed');
    } else {
      const baseline = ledger.baseline;
      const baselineIsValid =
        isNonNegativeSafeInteger(baseline.completedSessions) &&
        isNonNegativeSafeInteger(baseline.totalFocusMinutes) &&
        isNonNegativeSafeInteger(baseline.rewardDay) &&
        isNonNegativeSafeInteger(baseline.rewardedHikariOnRewardDay) &&
        isNonNegativeSafeInteger(baseline.focusedMinutesOnRewardDay) &&
        (baseline.rhythmBonusClaimedDay === null ||
          isNonNegativeSafeInteger(baseline.rhythmBonusClaimedDay));
      if (!baselineIsValid) {
        issues.push('study reward ledger baseline is invalid');
      } else {
        let receiptFocusMinutes = 0;
        let receiptHikariOnRewardDay = 0;
        let receiptFocusOnRewardDay = 0;
        let rhythmBonusClaimedDay =
          baseline.rhythmBonusClaimedDay as number | null;
        const receiptIds: string[] = [];
        let receiptsAreValid = true;
        for (const [sessionId, receipt] of Object.entries(
          ledger.receipts,
        )) {
          if (
            !isRecord(receipt) ||
            !isSafeIdentifier(sessionId) ||
            receipt.sessionId !== sessionId ||
            !isNonNegativeSafeInteger(receipt.completedAtUtcMs) ||
            receipt.completedAtUtcMs >
              Number.MAX_SAFE_INTEGER - 9 * 60 * 60 * 1_000 ||
            !isNonNegativeSafeInteger(receipt.completionDay) ||
            receipt.completionDay !==
              japanDayIndex(receipt.completedAtUtcMs) ||
            receipt.completionDay > state.study.rewardDay ||
            !isPositiveSafeInteger(receipt.focusMinutes) ||
            receipt.focusMinutes > 180 ||
            !isNonNegativeSafeInteger(receipt.hikari) ||
            !isNonNegativeSafeInteger(receipt.rhythmBonus)
          ) {
            receiptsAreValid = false;
            continue;
          }
          receiptIds.push(sessionId);
          receiptFocusMinutes += receipt.focusMinutes;
          if (receipt.completionDay === state.study.rewardDay) {
            receiptHikariOnRewardDay += receipt.hikari;
            receiptFocusOnRewardDay += receipt.focusMinutes;
          }
          if (receipt.rhythmBonus > 0) {
            rhythmBonusClaimedDay =
              rhythmBonusClaimedDay === null
                ? receipt.completionDay
                : Math.max(
                    rhythmBonusClaimedDay,
                    receipt.completionDay,
                  );
          }
          if (
            !Number.isSafeInteger(receiptFocusMinutes) ||
            !Number.isSafeInteger(receiptHikariOnRewardDay) ||
            !Number.isSafeInteger(receiptFocusOnRewardDay)
          ) {
            receiptsAreValid = false;
          }
        }
        if (!receiptsAreValid) {
          issues.push('study reward receipts are invalid');
        } else {
          const expectedSessions =
            baseline.completedSessions + receiptIds.length;
          const expectedFocusMinutes =
            baseline.totalFocusMinutes + receiptFocusMinutes;
          const baselineHikariToday =
            baseline.rewardDay === state.study.rewardDay
              ? baseline.rewardedHikariOnRewardDay
              : 0;
          const baselineFocusToday =
            baseline.rewardDay === state.study.rewardDay
              ? baseline.focusedMinutesOnRewardDay
              : 0;
          const expectedHikariToday =
            baselineHikariToday + receiptHikariOnRewardDay;
          const expectedFocusToday =
            baselineFocusToday + receiptFocusOnRewardDay;
          if (
            !Number.isSafeInteger(expectedSessions) ||
            state.study.completedSessions !== expectedSessions ||
            (completedSessionIdsAreValid &&
              (state.study.completedSessionIds.length !==
                expectedSessions ||
                receiptIds.some(
                  (id) =>
                    !state.study.completedSessionIds.includes(id),
                )))
          ) {
            issues.push('study session receipts do not reconcile');
          }
          if (
            !Number.isSafeInteger(expectedFocusMinutes) ||
            state.study.totalFocusMinutes !== expectedFocusMinutes
          ) {
            issues.push('study focus receipts do not reconcile');
          }
          if (
            state.study.rewardDay < baseline.rewardDay ||
            !Number.isSafeInteger(expectedHikariToday) ||
            state.study.rewardedHikariToday !== expectedHikariToday ||
            !Number.isSafeInteger(expectedFocusToday) ||
            state.study.focusedMinutesToday !== expectedFocusToday
          ) {
            issues.push('daily study reward receipts do not reconcile');
          }
          if (
            state.study.dailyRhythmBonusClaimedDay !==
            rhythmBonusClaimedDay
          ) {
            issues.push('daily rhythm receipt does not reconcile');
          }
        }
      }
    }
    if (state.study.activeSession !== null) {
      const session = state.study.activeSession;
      if (
        !isRecord(session) ||
        !isSafeIdentifier(session.id) ||
        !['study', 'read', 'journal', 'create'].includes(session.activity) ||
        !isSafeIdentifier(session.locationId) ||
        !['running', 'paused'].includes(session.status) ||
        !isPositiveSafeInteger(session.plannedDurationMs) ||
        session.plannedDurationMs < 5 * 60_000 ||
        session.plannedDurationMs > 180 * 60_000 ||
        session.plannedDurationMs % 60_000 !== 0 ||
        !isNonNegativeSafeInteger(session.accumulatedActiveMs) ||
        session.accumulatedActiveMs > session.plannedDurationMs ||
        !isPositiveSafeInteger(session.energyReserved) ||
        session.energyReserved !==
          energyCostForDuration(session.plannedDurationMs / 60_000) ||
        !isNonNegativeSafeInteger(session.startedAtUtcMs) ||
        !isNonNegativeSafeInteger(session.lastCheckpointAtUtcMs) ||
        session.lastCheckpointAtUtcMs < session.startedAtUtcMs ||
        session.lastCheckpointAtUtcMs - session.startedAtUtcMs <
          session.accumulatedActiveMs ||
        session.startedAtUtcMs < state.meta.createdAtUtcMs ||
        session.lastCheckpointAtUtcMs > state.meta.lastObservedUtcMs ||
        !isPositiveSafeInteger(session.locationBonusBps) ||
        session.locationBonusBps < 8_000 ||
        session.locationBonusBps > 20_000
      ) {
        issues.push('active study session is invalid');
      }
    }
  }

  if (!isRecord(state.travel)) issues.push('travel state is malformed');
  else {
    if (
      !isSafeIdentifier(state.travel.currentLocationId) ||
      !uniqueStrings(state.travel.unlockedLocationIds) ||
      state.travel.unlockedLocationIds.some((id) => !isSafeIdentifier(id)) ||
      !state.travel.unlockedLocationIds.includes(state.travel.currentLocationId)
    ) {
      issues.push('current travel location is invalid or locked');
    }
    if (
      !positiveIntegerRecord(state.travel.visitCounts) ||
      Object.keys(state.travel.visitCounts).some(
        (id) => !isSafeIdentifier(id),
      )
    ) {
      issues.push('travel visit counts are invalid');
    }
    if (
      state.travel.lastTravelWorldMinute !== null &&
      !isNonNegativeSafeInteger(state.travel.lastTravelWorldMinute)
    ) {
      issues.push('last travel time is invalid');
    }
  }

  if (!isRecord(state.clock)) issues.push('world clock is malformed');
  else {
    if (
      !isNonNegativeSafeInteger(state.clock.worldMinute) ||
      !isNonNegativeSafeInteger(state.clock.weatherSeed) ||
      !isSafeIdentifier(state.clock.climateId)
    ) {
      issues.push('world clock values are invalid');
    } else {
      const expectedWeather = weatherForDay(
        state.clock.weatherSeed,
        dayForWorldMinute(state.clock.worldMinute),
        state.clock.climateId,
      );
      if (state.clock.weather !== expectedWeather) issues.push('persisted weather is not deterministic');
    }
  }

  if (!isRecord(state.progression)) issues.push('progression state is malformed');
  else {
    if (!isNonNegativeSafeInteger(state.progression.experience)) issues.push('experience is invalid');
    if (!isPositiveSafeInteger(state.progression.experienceLevel)) issues.push('experience level is invalid');
    if (!isPositiveSafeInteger(state.progression.level)) issues.push('house level is invalid');
    if (!isPositiveSafeInteger(state.progression.maxLevelReached)) issues.push('max level is invalid');
    if (
      isNonNegativeSafeInteger(state.progression.experience) &&
      state.progression.experienceLevel !== levelForExperience(state.progression.experience)
    ) {
      issues.push('experience level does not match experience');
    }
    if (
      isNonNegativeSafeInteger(state.study?.totalFocusMinutes) &&
      state.progression.level !== houseLevelForFocusMinutes(state.study.totalFocusMinutes)
    ) {
      issues.push('house level does not match focus minutes');
    }
    if (state.progression.maxLevelReached < state.progression.level) issues.push('max level is below level');
    if (
      !Array.isArray(state.progression.claimedLevelGrantLevels) ||
      state.progression.claimedLevelGrantLevels.some(
        (level) => !isPositiveSafeInteger(level),
      ) ||
      new Set(state.progression.claimedLevelGrantLevels).size !==
        state.progression.claimedLevelGrantLevels.length
    ) {
      issues.push('claimed house level grants are invalid');
    } else {
      const expectedClaims = HOUSE_LEVEL_MILESTONES
        .filter((milestone) => milestone.level <= state.progression.level)
        .map((milestone) => milestone.level);
      const actualClaims = [...state.progression.claimedLevelGrantLevels].sort(
        (a, b) => a - b,
      );
      if (
        actualClaims.length !== expectedClaims.length ||
        actualClaims.some((level, index) => level !== expectedClaims[index])
      ) {
        issues.push('house level grant receipts do not match attained milestones');
      }
    }
    if (!nonNegativeIntegerRecord(state.progression.counters)) issues.push('progress counters are invalid');
    const achievementIdsAreValid = uniqueStrings(
      state.progression.unlockedAchievementIds,
    );
    if (!achievementIdsAreValid) issues.push('achievement ids are invalid');
    if (!isRecord(state.progression.achievementDefinitionFingerprints)) {
      issues.push('achievement definition fingerprints are invalid');
    } else if (achievementIdsAreValid) {
      const fingerprintIds = Object.keys(
        state.progression.achievementDefinitionFingerprints,
      ).sort();
      const unlockedIds = [...state.progression.unlockedAchievementIds].sort();
      if (
        fingerprintIds.length !== unlockedIds.length ||
        fingerprintIds.some((id, index) => id !== unlockedIds[index]) ||
        Object.values(
          state.progression.achievementDefinitionFingerprints,
        ).some(
          (fingerprint) =>
            typeof fingerprint !== 'string' ||
            (!/^[0-9a-f]{8}$/.test(fingerprint) &&
              fingerprint !== 'legacy-unverified'),
        )
      ) {
        issues.push('achievement fingerprints do not match unlocked achievements');
      }
    }
    const claimedRewardIdsAreValid = uniqueStrings(
      state.progression.claimedAchievementRewardIds,
    );
    if (!claimedRewardIdsAreValid) issues.push('claimed reward ids are invalid');
    if (
      claimedRewardIdsAreValid &&
      achievementIdsAreValid &&
      state.progression.claimedAchievementRewardIds.some(
        (id) => !state.progression.unlockedAchievementIds.includes(id),
      )
    ) {
      issues.push('a locked achievement reward is marked claimed');
    }
  }

  if (
    !isRecord(state.extensions) ||
    !Object.values(state.extensions).every(isJsonValue) ||
    Object.keys(state.extensions).some((key) => !isSafeIdentifier(key))
  ) {
    issues.push('extensions must contain JSON-safe values');
  } else if (
    isRecord(state.economy?.inventory) &&
    isRecord(state.economy.inventory.instances)
  ) {
    const placedInventory = new Map<
      string,
      Map<string, string>
    >();
    for (const instance of Object.values(
      state.economy.inventory.instances,
    )) {
      if (
        isRecord(instance) &&
        isSafeIdentifier(instance.instanceId) &&
        isSafeIdentifier(instance.itemId) &&
        isRecord(instance.disposition) &&
        instance.disposition.kind === 'placed' &&
        isSafeIdentifier(instance.disposition.locationId)
      ) {
        const locationItems =
          placedInventory.get(instance.disposition.locationId) ??
          new Map<string, string>();
        locationItems.set(instance.instanceId, instance.itemId);
        placedInventory.set(
          instance.disposition.locationId,
          locationItems,
        );
      }
    }

    const worldSnapshots = new Map<
      string,
      Map<string, string>
    >();
    const globallyPlacedIds = new Set<string>();
    for (const [extensionKey, extension] of Object.entries(
      state.extensions,
    )) {
      if (
        !isRecord(extension) ||
        (!Object.hasOwn(extension, 'worldId') &&
          !Object.hasOwn(extension, 'items'))
      ) {
        continue;
      }
      if (
        extension.schemaVersion !== 1 ||
        extension.worldId !== extensionKey ||
        !isNonNegativeSafeInteger(extension.revision) ||
        !Array.isArray(extension.items)
      ) {
        issues.push(`invalid WorldCore snapshot: ${extensionKey}`);
        continue;
      }
      const snapshotItems = new Map<string, string>();
      let snapshotIsValid = true;
      for (const item of extension.items) {
        if (
          !isRecord(item) ||
          !isSafeIdentifier(item.instanceId) ||
          !isSafeIdentifier(item.itemId) ||
          snapshotItems.has(item.instanceId) ||
          globallyPlacedIds.has(item.instanceId) ||
          !isRecord(item.position) ||
          !isFiniteNumber(item.position.x) ||
          !isFiniteNumber(item.position.y) ||
          ![0, 90, 180, 270].includes(item.rotation as number)
        ) {
          snapshotIsValid = false;
          continue;
        }
        snapshotItems.set(item.instanceId, item.itemId);
        globallyPlacedIds.add(item.instanceId);
      }
      if (!snapshotIsValid) {
        issues.push(`invalid WorldCore items: ${extensionKey}`);
      } else {
        worldSnapshots.set(extensionKey, snapshotItems);
      }
    }

    const worldLocations = new Set([
      ...placedInventory.keys(),
      ...worldSnapshots.keys(),
    ]);
    for (const locationId of worldLocations) {
      const expected = placedInventory.get(locationId) ?? new Map();
      const actual = worldSnapshots.get(locationId);
      if (
        !actual ||
        actual.size !== expected.size ||
        [...expected].some(
          ([instanceId, itemId]) =>
            actual.get(instanceId) !== itemId,
        )
      ) {
        issues.push(
          `WorldCore ownership does not reconcile: ${locationId}`,
        );
      }
    }
  }
  return issues;
}

export function validateGameState(value: unknown): value is GameState {
  return validateGameStateIssues(value).length === 0;
}

function unwrapEnvelope(
  parsed: Record<string, unknown>,
): { value: unknown; envelopeVersion?: number } | SaveLoadError {
  if (parsed.format !== SAVE_FORMAT) return { value: parsed };
  if (
    !isNonNegativeSafeInteger(parsed.schemaVersion) ||
    !isNonNegativeSafeInteger(parsed.revision) ||
    !isNonNegativeSafeInteger(parsed.savedAtUtcMs) ||
    typeof parsed.checksum !== 'string' ||
    !isRecord(parsed.state)
  ) {
    return { code: 'INVALID_SHAPE', message: 'The save envelope is malformed.' };
  }
  if (parsed.schemaVersion > CURRENT_GAME_STATE_VERSION) {
    return {
      code: 'FUTURE_VERSION',
      message: `Save version ${parsed.schemaVersion} is newer than this game supports.`,
    };
  }
  if (checksumFor(parsed.state) !== parsed.checksum) {
    return { code: 'CHECKSUM_MISMATCH', message: 'The save checksum does not match its contents.' };
  }
  return { value: parsed.state, envelopeVersion: parsed.schemaVersion };
}

export function decodeAndMigrateGameState(
  raw: string,
  options: DecodeSaveOptions = {},
): SaveLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: { code: 'INVALID_JSON', message: 'The save is not valid JSON.' } };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: { code: 'INVALID_SHAPE', message: 'The save root must be an object.' } };
  }
  const unwrapped = unwrapEnvelope(parsed);
  if ('code' in unwrapped) return { ok: false, error: unwrapped };
  if (!isRecord(unwrapped.value)) {
    return { ok: false, error: { code: 'INVALID_SHAPE', message: 'The save state must be an object.' } };
  }

  const sourceVersion = detectVersion(unwrapped.value);
  if (sourceVersion === null) {
    return { ok: false, error: { code: 'INVALID_SHAPE', message: 'The save has no recognised schema version.' } };
  }
  if (sourceVersion > CURRENT_GAME_STATE_VERSION) {
    return {
      ok: false,
      error: {
        code: 'FUTURE_VERSION',
        message: `Save version ${sourceVersion} is newer than this game supports.`,
      },
    };
  }

  const warnings: SaveWarning[] = [];
  let migrated: unknown = unwrapped.value;
  try {
    if (sourceVersion === 1) {
      const legacy = parseLegacyV1(unwrapped.value);
      if (!legacy) {
        return { ok: false, error: { code: 'INVALID_SHAPE', message: 'The version 1 save is malformed.' } };
      }
      migrated = migrateSaveV1ToV2(legacy, options);
      warnings.push({
        code: 'MIGRATED_V1_ECONOMY',
        message: 'Legacy ownership and placed identities were preserved in the authoritative inventory.',
      });
    }
    if (sourceVersion <= 2) {
      const versionTwo = parseSaveV2(migrated as Record<string, unknown>);
      if (!versionTwo) {
        return { ok: false, error: { code: 'INVALID_SHAPE', message: 'The version 2 save is malformed.' } };
      }
      migrated = migrateSaveV2ToV3(versionTwo, options);
      warnings.push({
        code: 'MIGRATED_V2_SYSTEMS',
        message: 'Study, progression, weather, and transaction state were initialised.',
      });
    }
    if (sourceVersion === 3) {
      const versionFour = migrateSaveV3ToV4(unwrapped.value, options);
      if (!versionFour) {
        return {
          ok: false,
          error: {
            code: 'INVALID_SHAPE',
            message: 'The version 3 save is malformed.',
          },
        };
      }
      migrated = versionFour;
      warnings.push({
        code: 'MIGRATED_V3_RECEIPTS',
        message: 'Legacy focus and reward receipts were upgraded conservatively.',
      });
    }
    if (sourceVersion === 4) {
      const versionFive = migrateSaveV4ToV5(unwrapped.value);
      if (!versionFive) {
        return {
          ok: false,
          error: {
            code: 'INVALID_SHAPE',
            message: 'The version 4 save is malformed.',
          },
        };
      }
      migrated = versionFive;
      warnings.push({
        code: 'MIGRATED_V4_REWARD_LEDGER',
        message: 'Historical focus totals were preserved in the reward ledger.',
      });
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_SHAPE',
        message: 'The legacy save could not be migrated safely.',
      },
    };
  }

  const issues = validateGameStateIssues(migrated);
  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_SHAPE',
        message: 'The save failed gameplay invariant validation.',
        issues,
      },
    };
  }
  let state = migrated as GameState;
  if (
    options.catalogVersion &&
    (state.meta.catalogVersion !== options.catalogVersion ||
      sourceVersion < CURRENT_GAME_STATE_VERSION)
  ) {
    const ownedItemIds = new Set([
      ...Object.keys(state.economy.inventory.stacks),
      ...Object.values(state.economy.inventory.instances).map(
        (instance) => instance.itemId,
      ),
    ]);
    if (ownedItemIds.size > 0 && !options.inventoryPolicyForItem) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SHAPE',
          message: 'Catalog reconciliation requires current inventory policies.',
          issues: ['inventoryPolicyForItem is required when owned items cross catalog versions'],
        },
      };
    }
    const reconciledPolicies = { ...state.economy.inventory.policies };
    const reconciledStacks = { ...state.economy.inventory.stacks };
    const reconciledInstances = { ...state.economy.inventory.instances };
    const reconciliationIssues: string[] = [];
    for (const itemId of ownedItemIds) {
      const currentPolicy = options.inventoryPolicyForItem?.(itemId);
      if (!currentPolicy) {
        warnings.push({
          code: 'ORPHANED_CATALOG_ITEM',
          message: `Owned item "${itemId}" is absent from the current catalog and was preserved.`,
        });
        continue;
      }
      const owned = getOwnedQuantity(state.economy.inventory, itemId);
      const persisted = state.economy.inventory.policies[itemId];
      if (
        (currentPolicy.storage !== 'stack' &&
          currentPolicy.storage !== 'instance') ||
        (currentPolicy.unique !== undefined &&
          typeof currentPolicy.unique !== 'boolean') ||
        (currentPolicy.maxOwned !== undefined &&
          !isPositiveSafeInteger(currentPolicy.maxOwned))
      ) {
        reconciliationIssues.push(`current catalog policy is invalid: ${itemId}`);
      } else if (
        (currentPolicy.unique === true && owned > 1) ||
        (currentPolicy.maxOwned !== undefined &&
          owned > currentPolicy.maxOwned)
      ) {
        reconciliationIssues.push(`owned quantity exceeds the current catalog policy: ${itemId}`);
      } else if (persisted?.storage !== currentPolicy.storage) {
        if (sourceVersion >= CURRENT_GAME_STATE_VERSION) {
          reconciliationIssues.push(`storage migration requires an explicit item alias migration: ${itemId}`);
          continue;
        }
        if (persisted?.storage === 'stack' && currentPolicy.storage === 'instance') {
          const quantity = reconciledStacks[itemId] ?? 0;
          delete reconciledStacks[itemId];
          for (let index = 0; index < quantity; index += 1) {
            let instanceId = `migrated:${checksumFor(`${itemId}:${index + 1}`)}:${index + 1}`;
            while (reconciledInstances[instanceId]) instanceId = `${instanceId}:owned`;
            reconciledInstances[instanceId] = {
              instanceId,
              itemId,
              acquiredAtUtcMs: state.meta.lastObservedUtcMs,
              disposition: { kind: 'stored' },
            };
          }
          reconciledPolicies[itemId] = { ...currentPolicy };
        } else if (
          persisted?.storage === 'instance' &&
          currentPolicy.storage === 'stack'
        ) {
          const instances = Object.values(reconciledInstances).filter(
            (instance) => instance.itemId === itemId,
          );
          if (
            instances.some(
              (instance) => instance.disposition.kind === 'placed',
            )
          ) {
            reconciliationIssues.push(`placed instances cannot migrate to a stack: ${itemId}`);
            continue;
          }
          for (const instance of instances) {
            delete reconciledInstances[instance.instanceId];
          }
          reconciledStacks[itemId] = instances.length;
          reconciledPolicies[itemId] = { ...currentPolicy };
        }
      } else {
        reconciledPolicies[itemId] = { ...currentPolicy };
      }
    }
    if (reconciliationIssues.length > 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SHAPE',
          message: 'The save could not be reconciled with the current catalog.',
          issues: reconciliationIssues,
        },
      };
    }
    if (!options.knownLocationIds) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SHAPE',
          message: 'Catalog reconciliation requires the current location ids.',
          issues: ['knownLocationIds is required across catalog versions'],
        },
      };
    }
    const knownLocations = new Set(options.knownLocationIds);
    const referencedLocations = new Set([
      state.travel.currentLocationId,
      ...state.travel.unlockedLocationIds,
      ...Object.keys(state.travel.visitCounts),
      ...Object.values(reconciledInstances)
        .filter((instance) => instance.disposition.kind === 'placed')
        .map((instance) =>
          instance.disposition.kind === 'placed'
            ? instance.disposition.locationId
            : '',
        ),
    ]);
    const missingLocations = [...referencedLocations].filter(
      (locationId) => !knownLocations.has(locationId),
    );
    if (
      [...knownLocations].some((id) => !isSafeIdentifier(id)) ||
      missingLocations.length > 0
    ) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SHAPE',
          message: 'The save references locations absent from the current catalog.',
          issues: missingLocations.map(
            (locationId) => `missing location: ${locationId}`,
          ),
        },
      };
    }
    if (
      state.progression.unlockedAchievementIds.length > 0 &&
      !options.achievementDefinitions
    ) {
      return {
        ok: false,
        error: {
          code: 'INVALID_SHAPE',
          message: 'Catalog reconciliation requires current achievement definitions.',
          issues: ['achievementDefinitions is required for unlocked achievements'],
        },
      };
    }
    const currentAchievements = new Map(
      (options.achievementDefinitions ?? []).map((definition) => [
        definition.id,
        definition,
      ]),
    );
    for (const achievementId of state.progression.unlockedAchievementIds) {
      const currentDefinition = currentAchievements.get(achievementId);
      if (!currentDefinition) {
        warnings.push({
          code: 'ORPHANED_ACHIEVEMENT',
          message: `Unlocked achievement "${achievementId}" is absent from the current catalog and was preserved without a claim path.`,
        });
      } else if (
        state.progression.achievementDefinitionFingerprints[achievementId] !==
        achievementDefinitionFingerprint(currentDefinition)
      ) {
        warnings.push({
          code: 'ACHIEVEMENT_DEFINITION_CHANGED',
          message: `Achievement "${achievementId}" changed; its prior unlock cannot claim the new reward.`,
        });
      }
    }
    state = {
      ...state,
      meta: { ...state.meta, catalogVersion: options.catalogVersion },
      economy: {
        ...state.economy,
        inventory: {
          ...state.economy.inventory,
          stacks: reconciledStacks,
          instances: reconciledInstances,
          policies: reconciledPolicies,
        },
      },
    };
    warnings.push({
      code: 'CATALOG_VERSION_RECONCILED',
      message: 'The save was reconciled to the current catalog version.',
    });
  }
  const reconciledIssues = validateGameStateIssues(state);
  if (reconciledIssues.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_SHAPE',
        message: 'The reconciled save failed gameplay invariant validation.',
        issues: reconciledIssues,
      },
    };
  }
  const pausedStudy = pauseRunningSessionAfterLoad(state.study);
  if (pausedStudy !== state.study) {
    state = { ...state, study: pausedStudy };
    warnings.push({
      code: 'PAUSED_RUNNING_STUDY',
      message: 'A running focus session was restored paused at its last checkpoint.',
    });
  }
  return {
    ok: true,
    state,
    warnings,
    sourceVersion,
    migrated: sourceVersion !== CURRENT_GAME_STATE_VERSION,
  };
}

export function encodeGameState(
  state: GameState,
  savedAtUtcMs = state.meta.lastObservedUtcMs,
): string {
  const issues = validateGameStateIssues(state);
  if (issues.length > 0) {
    throw new Error(`Cannot encode invalid game state: ${issues.join('; ')}`);
  }
  if (!isNonNegativeSafeInteger(savedAtUtcMs)) {
    throw new RangeError('Save time must be a non-negative safe integer.');
  }
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    schemaVersion: CURRENT_GAME_STATE_VERSION,
    revision: state.meta.revision,
    savedAtUtcMs,
    checksum: checksumFor(state),
    state,
  };
  return stableJson(envelope);
}

export const serializeGameState = encodeGameState;
export const deserializeGameState = decodeAndMigrateGameState;
