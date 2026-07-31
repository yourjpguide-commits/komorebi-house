import {
  createEconomyState,
  createQuoteFingerprint,
  creditWallet,
  markItemPlaced,
  markItemStored,
  purchaseItem,
  type EconomyState,
  type InventoryState,
  type InventoryPolicy,
  type ShopOffer,
} from './economy';
import {
  DEFAULT_ACHIEVEMENTS,
  achievementDefinitionFingerprint,
  applyHouseLevelProgress,
  createProgressionState,
  grantExperience,
  markAchievementRewardClaimed,
  recordProgressionEvents,
  type AchievementDefinition,
  type ProgressionState,
} from './progression';
import {
  DEFAULT_STUDY_REWARD_CONFIG,
  cancelStudySession,
  checkpointStudySession,
  completeStudySession,
  createStudyState,
  isStudyRewardConfigValid,
  pauseStudySession,
  resumeStudySession,
  startStudySession,
  syncStudyDay,
  type StudyActivity,
  type StudyRewardConfig,
  type StudyState,
} from './study';
import {
  advanceWorldTime,
  createTravelState,
  createWorldClock,
  setWorldClimate,
  travelTo,
  unlockLocation,
  type LocationDefinition,
  type TravelState,
  type WorldClockState,
} from './world';
import {
  accepted,
  isNonNegativeSafeInteger,
  isSafeIdentifier,
  rejected,
  type GameplayEvent,
  type JsonValue,
  type SystemResult,
} from './types';

export const CURRENT_GAME_STATE_VERSION = 5;

export interface GameProfile {
  playerName: string;
}

export interface TransactionReceipt {
  transactionId: string;
  revision: number;
  commandType: GameCommand['type'];
  committedAtUtcMs: number;
  commandFingerprint: string;
}

export interface GameStateMeta {
  schemaVersion: number;
  revision: number;
  catalogVersion: string;
  createdAtUtcMs: number;
  lastObservedUtcMs: number;
  processedTransactions: Record<string, TransactionReceipt>;
}

export interface GameState {
  meta: GameStateMeta;
  profile: GameProfile;
  economy: EconomyState;
  study: StudyState;
  travel: TravelState;
  clock: WorldClockState;
  progression: ProgressionState;
  /**
   * Renderer-owned, JSON-safe slices (for example `extensions.room`) round-trip
   * through saves without making the gameplay core depend on Phaser or WorldCore.
   */
  extensions: Record<string, JsonValue>;
}

export interface GameCatalog {
  version: string;
  getShopOffer(
    itemId: string,
    state?: Readonly<GameState>,
  ): { offer: ShopOffer; policy?: InventoryPolicy } | undefined;
  getLocation(
    locationId: string,
    state?: Readonly<GameState>,
  ): LocationDefinition | undefined;
  achievements?: readonly AchievementDefinition[];
  studyRewardConfig?: StudyRewardConfig;
}

export type GameCommand =
  | {
      type: 'purchase';
      itemId: string;
      bundles?: number;
      quoteFingerprint?: string;
    }
  | {
      type: 'study.start';
      sessionId?: string;
      activity: StudyActivity;
      durationMinutes: number;
    }
  | {
      type: 'study.checkpoint';
      sessionId: string;
      activeElapsedMs: number;
    }
  | { type: 'study.pause'; sessionId: string }
  | { type: 'study.resume'; sessionId: string }
  | { type: 'study.complete'; sessionId: string; qualityPercent?: number }
  | { type: 'study.cancel'; sessionId: string }
  | { type: 'travel'; locationId: string }
  | { type: 'world.advance'; minutes: number }
  | { type: 'daily.sync' }
  | { type: 'location.unlock'; locationId: string }
  | {
      type: 'inventory.mark-placed';
      instanceId: string;
      placementId: string;
      locationId: string;
      worldExtension: { key: string; value: JsonValue };
    }
  | {
      type: 'inventory.mark-stored';
      instanceId: string;
      worldExtension: { key: string; value: JsonValue };
    }
  | { type: 'achievement.claim'; achievementId: string };

export interface CommandEnvelope {
  transactionId: string;
  expectedRevision: number;
  nowUtcMs: number;
  /** Only trusted orchestration may issue maintenance-only commands. */
  authority?: 'player' | 'system';
  command: GameCommand;
}

export interface AppliedCommand {
  receipt: TransactionReceipt;
  duplicate: boolean;
}

export interface InitialGameStateOptions {
  nowUtcMs: number;
  playerName?: string;
  initialBalance?: number;
  currencyId?: string;
  initialLocationId?: string;
  unlockedLocationIds?: readonly string[];
  maxEnergy?: number;
  catalogVersion?: string;
  weatherSeed?: number;
  extensions?: Record<string, JsonValue>;
}

export function createInitialGameState(options: InitialGameStateOptions): GameState {
  if (!isNonNegativeSafeInteger(options.nowUtcMs)) {
    throw new RangeError('Initial UTC time must be a non-negative safe integer.');
  }
  const initialLocationId = options.initialLocationId ?? 'room';
  return {
    meta: {
      schemaVersion: CURRENT_GAME_STATE_VERSION,
      revision: 0,
      catalogVersion: options.catalogVersion ?? 'development',
      createdAtUtcMs: options.nowUtcMs,
      lastObservedUtcMs: options.nowUtcMs,
      processedTransactions: {},
    },
    profile: { playerName: options.playerName?.trim() || 'Haru' },
    economy: createEconomyState(options.initialBalance ?? 240, options.currencyId ?? 'hikari'),
    study: createStudyState(options.nowUtcMs, options.maxEnergy ?? 5),
    travel: createTravelState(
      initialLocationId,
      options.unlockedLocationIds ?? [initialLocationId],
    ),
    clock: createWorldClock({ weatherSeed: options.weatherSeed }),
    progression: {
      ...createProgressionState(),
      counters: { uniqueLocationsVisited: 1 },
    },
    extensions: { ...(options.extensions ?? {}) },
  };
}

export function getPurchaseQuote(
  state: GameState,
  itemId: string,
  bundles: number,
  catalog: GameCatalog,
): { totalPrice: number; quantity: number; fingerprint: string } | null {
  const entry = catalog.getShopOffer(itemId, state);
  if (
    !entry ||
    entry.offer.itemId !== itemId ||
    entry.offer.active === false
  ) {
    return null;
  }
  const quantity = bundles * (entry.offer.bundleSize ?? 1);
  const totalPrice = bundles * entry.offer.unitPrice;
  if (
    !Number.isSafeInteger(bundles) ||
    bundles <= 0 ||
    !Number.isSafeInteger(quantity) ||
    !Number.isSafeInteger(totalPrice)
  ) {
    return null;
  }
  return {
    totalPrice,
    quantity,
    fingerprint: createQuoteFingerprint(entry.offer, bundles, entry.policy),
  };
}

function isRuntimeJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isRuntimeJsonValue);
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.entries(value).every(
      ([key, entry]) => isSafeIdentifier(key) && isRuntimeJsonValue(entry),
    )
  );
}

function worldExtensionItems(
  value: JsonValue,
): Map<string, { itemId: string }> | null {
  if (!isRuntimeJsonValue(value)) return null;
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }
  if (
    value.schemaVersion !== 1 ||
    !isSafeIdentifier(value.worldId) ||
    !isNonNegativeSafeInteger(value.revision)
  ) {
    return null;
  }
  const items = value.items;
  if (!Array.isArray(items)) return null;
  const result = new Map<string, { itemId: string }>();
  for (const item of items) {
    if (
      item === null ||
      Array.isArray(item) ||
      typeof item !== 'object' ||
      !isSafeIdentifier(item.instanceId) ||
      !isSafeIdentifier(item.itemId) ||
      result.has(item.instanceId) ||
      item.position === null ||
      Array.isArray(item.position) ||
      typeof item.position !== 'object' ||
      typeof item.position.x !== 'number' ||
      !Number.isFinite(item.position.x) ||
      typeof item.position.y !== 'number' ||
      !Number.isFinite(item.position.y) ||
      ![0, 90, 180, 270].includes(item.rotation as number)
    ) {
      return null;
    }
    result.set(item.instanceId, { itemId: item.itemId });
  }
  return result;
}

function worldSnapshotMatchesInventory(
  inventory: InventoryState,
  extensionKey: string,
  items: ReadonlyMap<string, { itemId: string }>,
  transitioningInstanceId: string,
  nextDisposition:
    | { kind: 'stored' }
    | { kind: 'placed'; locationId: string },
): boolean {
  const expected = new Map<string, string>();
  for (const instance of Object.values(inventory.instances)) {
    const disposition =
      instance.instanceId === transitioningInstanceId
        ? nextDisposition
        : instance.disposition;
    if (
      disposition.kind === 'placed' &&
      disposition.locationId === extensionKey
    ) {
      expected.set(instance.instanceId, instance.itemId);
    }
  }
  if (expected.size !== items.size) return false;
  for (const [instanceId, itemId] of expected) {
    if (items.get(instanceId)?.itemId !== itemId) return false;
  }
  return true;
}

function canonicalCommandJson(value: unknown): string {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalCommandJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalCommandJson(record[key])}`,
    )
    .join(',')}}`;
}

function commandIdHash(source: string, seed: number): string {
  let hash = seed;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Child operations use a reserved, bounded namespace. This keeps fan-out ids
 * valid even when the player transaction id is at its maximum length.
 */
export function deriveSystemCommandId(
  parentTransactionId: string,
  purpose: string,
): string {
  if (
    !isSafeIdentifier(parentTransactionId) ||
    !isSafeIdentifier(purpose)
  ) {
    throw new RangeError('System command ids require safe identifiers.');
  }
  const digest =
    commandIdHash(parentTransactionId, 2_166_136_261) +
    commandIdHash(parentTransactionId, 2_899_937_381);
  return `sys:${digest}:${purpose}`;
}

export function isSystemCommandIdFor(
  parentTransactionId: string,
  candidate: string,
): boolean {
  if (
    !isSafeIdentifier(parentTransactionId) ||
    !isSafeIdentifier(candidate)
  ) {
    return false;
  }
  const digest =
    commandIdHash(parentTransactionId, 2_166_136_261) +
    commandIdHash(parentTransactionId, 2_899_937_381);
  return candidate.startsWith(`sys:${digest}:`);
}

export function fingerprintGameCommand(command: GameCommand): string {
  const source = canonicalCommandJson(command);
  let hash = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function withProgression(
  progression: ProgressionState,
  events: GameplayEvent[],
  envelope: CommandEnvelope,
  achievements: readonly AchievementDefinition[],
): SystemResult<ProgressionState, ProgressionState> {
  const recorded = recordProgressionEvents(progression, {
    commandId: deriveSystemCommandId(envelope.transactionId, 'progress'),
    events,
    nowUtcMs: envelope.nowUtcMs,
    achievements,
  });
  if (!recorded.ok) return recorded;
  events.push(...recorded.events);
  return accepted(recorded.state, recorded.state);
}

/**
 * Atomic renderer-independent command authority.
 *
 * Failed commands return the exact original state. Successful commands bump
 * the revision once. Replaying a committed transaction id returns its receipt
 * without replaying events or rewards.
 */
export function applyGameCommand(
  state: GameState,
  envelope: CommandEnvelope,
  catalog: GameCatalog,
): SystemResult<GameState, AppliedCommand> {
  if (
    !isSafeIdentifier(envelope.transactionId) ||
    envelope.transactionId.startsWith('sys:') ||
    !isNonNegativeSafeInteger(envelope.nowUtcMs)
  ) {
    return rejected(state, 'INVALID_COMMAND_ENVELOPE', 'Commands require a transaction id and valid UTC time.');
  }
  const commandFingerprint = fingerprintGameCommand(envelope.command);
  const priorReceipt = state.meta.processedTransactions[envelope.transactionId];
  if (priorReceipt) {
    if (priorReceipt.commandFingerprint !== commandFingerprint) {
      return rejected(
        state,
        'IDEMPOTENCY_KEY_REUSED',
        'This transaction id was already used for a different command.',
      );
    }
    return accepted(state, { receipt: priorReceipt, duplicate: true });
  }
  if (envelope.expectedRevision !== state.meta.revision) {
    return rejected(state, 'STALE_REVISION', 'The command was based on an older game state.', {
      expectedRevision: envelope.expectedRevision,
      currentRevision: state.meta.revision,
    });
  }
  if (envelope.nowUtcMs < state.meta.lastObservedUtcMs) {
    return rejected(
      state,
      'UTC_CLOCK_ROLLBACK',
      'The command timestamp is older than the last committed game time.',
      {
        commandUtcMs: envelope.nowUtcMs,
        lastObservedUtcMs: state.meta.lastObservedUtcMs,
      },
    );
  }
  if (catalog.version !== state.meta.catalogVersion) {
    return rejected(state, 'CATALOG_VERSION_MISMATCH', 'The game catalog changed; refresh the current state.', {
      stateCatalogVersion: state.meta.catalogVersion,
      currentCatalogVersion: catalog.version,
    });
  }

  let economy = state.economy;
  let study = state.study;
  let travel = state.travel;
  let clock = state.clock;
  let progression = state.progression;
  let extensions = state.extensions;
  const events: GameplayEvent[] = [];
  const achievements = catalog.achievements ?? DEFAULT_ACHIEVEMENTS;
  const command = envelope.command;
  if (
    (command.type === 'world.advance' ||
      command.type === 'location.unlock') &&
    envelope.authority !== 'system'
  ) {
    return rejected(
      state,
      'SYSTEM_COMMAND_REQUIRED',
      'This maintenance command requires trusted system authority.',
    );
  }

  switch (command.type) {
    case 'purchase': {
      const entry = catalog.getShopOffer(command.itemId, state);
      if (!entry) {
        return rejected(state, 'OFFER_NOT_FOUND', 'The requested shop item does not exist.');
      }
      if (
        entry.offer.itemId !== command.itemId ||
        !isSafeIdentifier(entry.offer.itemId)
      ) {
        return rejected(
          state,
          'CATALOG_IDENTITY_MISMATCH',
          'The shop catalog returned a different item identity.',
        );
      }
      const result = purchaseItem(economy, {
        commandId: envelope.transactionId,
        offer: entry.offer,
        bundles: command.bundles,
        policy: entry.policy,
        nowUtcMs: envelope.nowUtcMs,
        playerLevel: progression.level,
        unlockedAchievementIds: progression.unlockedAchievementIds,
        totalFocusMinutes: study.totalFocusMinutes,
        progressCounters: progression.counters,
        quoteFingerprint: command.quoteFingerprint,
      });
      if (!result.ok) return { ...result, state };
      economy = result.state;
      events.push(...result.events);
      break;
    }
    case 'study.start': {
      const location = catalog.getLocation(travel.currentLocationId, state);
      if (location && location.id !== travel.currentLocationId) {
        return rejected(
          state,
          'CATALOG_IDENTITY_MISMATCH',
          'The location catalog returned a different current location identity.',
        );
      }
      if (
        !isStudyRewardConfigValid(
          catalog.studyRewardConfig ?? DEFAULT_STUDY_REWARD_CONFIG,
        )
      ) {
        return rejected(
          state,
          'INVALID_REWARD_CONFIG',
          'The focus reward configuration cannot settle safely.',
        );
      }
      const result = startStudySession(study, {
        commandId: envelope.transactionId,
        sessionId:
          command.sessionId ??
          deriveSystemCommandId(envelope.transactionId, 'session'),
        activity: command.activity,
        locationId: travel.currentLocationId,
        durationMinutes: command.durationMinutes,
        nowUtcMs: envelope.nowUtcMs,
        locationBonusBps: location?.studyRewardBps,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);
      break;
    }
    case 'study.checkpoint': {
      const result = checkpointStudySession(study, {
        commandId: envelope.transactionId,
        sessionId: command.sessionId,
        activeElapsedMs: command.activeElapsedMs,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);
      break;
    }
    case 'study.pause': {
      const result = pauseStudySession(study, {
        commandId: envelope.transactionId,
        sessionId: command.sessionId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);
      break;
    }
    case 'study.resume': {
      const result = resumeStudySession(study, {
        commandId: envelope.transactionId,
        sessionId: command.sessionId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);
      break;
    }
    case 'study.cancel': {
      const result = cancelStudySession(study, {
        commandId: envelope.transactionId,
        sessionId: command.sessionId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);
      break;
    }
    case 'study.complete': {
      const result = completeStudySession(study, {
        commandId: envelope.transactionId,
        sessionId: command.sessionId,
        nowUtcMs: envelope.nowUtcMs,
        qualityPercent: command.qualityPercent,
        rewardConfig: catalog.studyRewardConfig ?? DEFAULT_STUDY_REWARD_CONFIG,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);

      const houseProgress = applyHouseLevelProgress(progression, {
        commandId: deriveSystemCommandId(
          envelope.transactionId,
          'house-level',
        ),
        totalFocusMinutes: study.totalFocusMinutes,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!houseProgress.ok) {
        return rejected(
          state,
          houseProgress.error.code,
          houseProgress.error.message,
          houseProgress.error.details,
        );
      }
      progression = houseProgress.state;
      events.push(...houseProgress.events);

      if (result.value.hikari > 0) {
        const credit = creditWallet(economy, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'study-hikari',
          ),
          amount: result.value.hikari,
          nowUtcMs: envelope.nowUtcMs,
          reason: 'study',
        });
        if (!credit.ok) return rejected(state, credit.error.code, credit.error.message, credit.error.details);
        economy = credit.state;
        events.push(...credit.events);
      }
      if (houseProgress.value.hikariGrant > 0) {
        const credit = creditWallet(economy, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'level-grants',
          ),
          amount: houseProgress.value.hikariGrant,
          nowUtcMs: envelope.nowUtcMs,
          reason: 'house-level',
        });
        if (!credit.ok) {
          return rejected(state, credit.error.code, credit.error.message, credit.error.details);
        }
        economy = credit.state;
        events.push(...credit.events);
      }
      if (result.value.xp > 0) {
        const xp = grantExperience(progression, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'study-xp',
          ),
          amount: result.value.xp,
          nowUtcMs: envelope.nowUtcMs,
          reason: 'study',
        });
        if (!xp.ok) return rejected(state, xp.error.code, xp.error.message, xp.error.details);
        progression = xp.state;
        events.push(...xp.events);
      }
      const time = advanceWorldTime(clock, {
        commandId: deriveSystemCommandId(
          envelope.transactionId,
          'study-time',
        ),
        minutes: result.value.focusMinutes,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!time.ok) return rejected(state, time.error.code, time.error.message, time.error.details);
      clock = time.state;
      events.push(...time.events);
      break;
    }
    case 'travel': {
      if (study.activeSession) {
        return rejected(state, 'TRAVEL_DURING_STUDY', 'Finish or cancel the active focus session before travelling.');
      }
      const destination = catalog.getLocation(command.locationId, state);
      if (!destination) {
        return rejected(state, 'LOCATION_NOT_FOUND', 'The requested destination does not exist.');
      }
      if (
        destination.id !== command.locationId ||
        !isSafeIdentifier(destination.id)
      ) {
        return rejected(
          state,
          'CATALOG_IDENTITY_MISMATCH',
          'The location catalog returned a different destination identity.',
        );
      }
      const result = travelTo(travel, {
        commandId: envelope.transactionId,
        destination,
        worldMinute: clock.worldMinute,
        nowUtcMs: envelope.nowUtcMs,
        playerLevel: progression.level,
        unlockedAchievementIds: progression.unlockedAchievementIds,
        totalFocusMinutes: study.totalFocusMinutes,
        progressCounters: progression.counters,
      });
      if (!result.ok) return { ...result, state };
      travel = result.state;
      events.push(...result.events);
      if (destination.travelMinutes > 0) {
        const advanced = advanceWorldTime(clock, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'travel-time',
          ),
          minutes: destination.travelMinutes,
          nowUtcMs: envelope.nowUtcMs,
        });
        if (!advanced.ok) {
          return rejected(state, advanced.error.code, advanced.error.message, advanced.error.details);
        }
        clock = advanced.state;
        events.push(...advanced.events);
      }
      if (destination.climateId && destination.climateId !== clock.climateId) {
        const climate = setWorldClimate(clock, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'climate',
          ),
          climateId: destination.climateId,
          nowUtcMs: envelope.nowUtcMs,
        });
        if (!climate.ok) {
          return rejected(state, climate.error.code, climate.error.message, climate.error.details);
        }
        clock = climate.state;
        events.push(...climate.events);
      }
      break;
    }
    case 'world.advance': {
      const result = advanceWorldTime(clock, {
        commandId: envelope.transactionId,
        minutes: command.minutes,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      clock = result.state;
      events.push(...result.events);
      break;
    }
    case 'daily.sync': {
      const result = syncStudyDay(study, {
        commandId: envelope.transactionId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      study = result.state;
      events.push(...result.events);
      break;
    }
    case 'location.unlock': {
      const location = catalog.getLocation(command.locationId, state);
      if (!location) {
        return rejected(state, 'LOCATION_NOT_FOUND', 'The requested destination does not exist.');
      }
      if (
        location.id !== command.locationId ||
        !isSafeIdentifier(location.id)
      ) {
        return rejected(
          state,
          'CATALOG_IDENTITY_MISMATCH',
          'The location catalog returned a different unlock identity.',
        );
      }
      const result = unlockLocation(travel, {
        commandId: envelope.transactionId,
        locationId: command.locationId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      travel = result.state;
      events.push(...result.events);
      break;
    }
    case 'inventory.mark-placed': {
      const placementLocation = catalog.getLocation(
        command.locationId,
        state,
      );
      const worldItems = worldExtensionItems(command.worldExtension.value);
      if (
        !placementLocation ||
        placementLocation.id !== command.locationId ||
        !travel.unlockedLocationIds.includes(command.locationId) ||
        travel.currentLocationId !== command.locationId ||
        !isSafeIdentifier(command.worldExtension.key) ||
        command.worldExtension.key !== command.locationId ||
        command.placementId !== command.instanceId ||
        !worldItems ||
        !worldSnapshotMatchesInventory(
          economy.inventory,
          command.worldExtension.key,
          worldItems,
          command.instanceId,
          { kind: 'placed', locationId: command.locationId },
        )
      ) {
        return rejected(
          state,
          'WORLD_PLACEMENT_MISMATCH',
          'The owned item and WorldCore placement must commit together with one shared instance id.',
        );
      }
      const result = markItemPlaced(economy, {
        commandId: envelope.transactionId,
        instanceId: command.instanceId,
        placementId: command.placementId,
        locationId: command.locationId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      economy = result.state;
      events.push(...result.events);
      extensions = {
        ...extensions,
        [command.worldExtension.key]: command.worldExtension.value,
      };
      break;
    }
    case 'inventory.mark-stored': {
      const existingInstance = economy.inventory.instances[command.instanceId];
      const worldItems = worldExtensionItems(command.worldExtension.value);
      if (
        !isSafeIdentifier(command.worldExtension.key) ||
        !existingInstance ||
        existingInstance.disposition.kind !== 'placed' ||
        command.worldExtension.key !== existingInstance.disposition.locationId ||
        !worldItems ||
        !worldSnapshotMatchesInventory(
          economy.inventory,
          command.worldExtension.key,
          worldItems,
          command.instanceId,
          { kind: 'stored' },
        )
      ) {
        return rejected(
          state,
          'WORLD_STORAGE_MISMATCH',
          'A stored item must be removed from the committed WorldCore snapshot.',
        );
      }
      const result = markItemStored(economy, {
        commandId: envelope.transactionId,
        instanceId: command.instanceId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!result.ok) return { ...result, state };
      economy = result.state;
      events.push(...result.events);
      extensions = {
        ...extensions,
        [command.worldExtension.key]: command.worldExtension.value,
      };
      break;
    }
    case 'achievement.claim': {
      const definition = achievements.find((candidate) => candidate.id === command.achievementId);
      if (!definition) {
        return rejected(state, 'ACHIEVEMENT_NOT_FOUND', 'The achievement does not exist.');
      }
      const hikari = definition.reward?.hikari ?? 0;
      const experience = definition.reward?.experience ?? 0;
      if (
        !isNonNegativeSafeInteger(hikari) ||
        !isNonNegativeSafeInteger(experience)
      ) {
        return rejected(
          state,
          'INVALID_ACHIEVEMENT_REWARD',
          'Achievement rewards must be non-negative safe integers.',
        );
      }
      if (
        progression.achievementDefinitionFingerprints[
          command.achievementId
        ] !== achievementDefinitionFingerprint(definition)
      ) {
        return rejected(
          state,
          'ACHIEVEMENT_DEFINITION_CHANGED',
          'This achievement changed after it was unlocked and cannot reuse the old reward claim.',
        );
      }
      const claimed = markAchievementRewardClaimed(progression, {
        commandId: envelope.transactionId,
        achievementId: command.achievementId,
        nowUtcMs: envelope.nowUtcMs,
      });
      if (!claimed.ok) return { ...claimed, state };
      progression = claimed.state;
      events.push(...claimed.events);
      if (hikari > 0) {
        const credit = creditWallet(economy, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'achievement-hikari',
          ),
          amount: hikari,
          nowUtcMs: envelope.nowUtcMs,
          reason: `achievement:${definition.id}`,
        });
        if (!credit.ok) return rejected(state, credit.error.code, credit.error.message, credit.error.details);
        economy = credit.state;
        events.push(...credit.events);
      }
      if (experience > 0) {
        const xp = grantExperience(progression, {
          commandId: deriveSystemCommandId(
            envelope.transactionId,
            'achievement-xp',
          ),
          amount: experience,
          nowUtcMs: envelope.nowUtcMs,
          reason: `achievement:${definition.id}`,
        });
        if (!xp.ok) return rejected(state, xp.error.code, xp.error.message, xp.error.details);
        progression = xp.state;
        events.push(...xp.events);
      }
      break;
    }
    default: {
      const exhaustive: never = command;
      return rejected(state, 'UNKNOWN_COMMAND', `Unsupported command: ${String(exhaustive)}`);
    }
  }

  const progress = withProgression(progression, events, envelope, achievements);
  if (!progress.ok) {
    return rejected(state, progress.error.code, progress.error.message, progress.error.details);
  }
  progression = progress.state;

  const revision = state.meta.revision + 1;
  if (!Number.isSafeInteger(revision)) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'The save revision cannot increase safely.');
  }
  const receipt: TransactionReceipt = {
    transactionId: envelope.transactionId,
    revision,
    commandType: envelope.command.type,
    committedAtUtcMs: envelope.nowUtcMs,
    commandFingerprint,
  };
  const next: GameState = {
    ...state,
    meta: {
      ...state.meta,
      revision,
      lastObservedUtcMs: Math.max(state.meta.lastObservedUtcMs, envelope.nowUtcMs),
      processedTransactions: {
        ...state.meta.processedTransactions,
        [envelope.transactionId]: receipt,
      },
    },
    economy,
    study,
    travel,
    clock,
    progression,
    extensions,
  };
  return accepted(next, { receipt, duplicate: false }, events);
}
