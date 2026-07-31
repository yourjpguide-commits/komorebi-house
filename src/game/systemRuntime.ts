import { ITEM_CATALOG, STARTER_ITEM_IDS } from '../data';
import {
  applyGameCommand,
  calculateStudyReward,
  creditWallet,
  createInitialGameState,
  decodeAndMigrateGameState,
  encodeGameState,
  fingerprintGameCommand,
  japanDayIndex,
  toOwnedItemCounts,
  type AppliedCommand,
  type GameCatalog,
  type GameCommand,
  type GameState,
  type JsonValue,
  type SystemResult,
} from '../systems';
import { FALLBACK_DECOR_CATALOG } from './catalogFallback';
import { DEFAULT_SAVE_KEY } from './constants';
import { createDefaultWorldState } from './storage';
import {
  LOCATION_IDS,
  type LocationId,
  type PlacedDecor,
  type SavedWorldState,
} from './types';

export const RUNTIME_CATALOG_VERSION = 'komorebi-browser-v1';
export const AUTHORITY_EVENT = 'komorebi:authority-state';

type AuthorityListener = (state: Readonly<GameState>) => void;

export interface AuthorityLoadResult {
  recovered: boolean;
  migrated: boolean;
  warnings: readonly string[];
}

export interface PlacementCommitResult {
  ok: boolean;
  placement?: PlacedDecor;
  code?: string;
  message?: string;
}

const locationDefinitions: Readonly<Record<LocationId, {
  id: LocationId;
  travelMinutes: number;
  unlockedByDefault: true;
  climateId: string;
  studyRewardBps: number;
}>> = {
  room: {
    id: 'room',
    travelMinutes: 4,
    unlockedByDefault: true,
    climateId: 'home',
    studyRewardBps: 10_000,
  },
  garden: {
    id: 'garden',
    travelMinutes: 2,
    unlockedByDefault: true,
    climateId: 'home',
    studyRewardBps: 10_000,
  },
  cafe: {
    id: 'cafe',
    travelMinutes: 8,
    unlockedByDefault: true,
    climateId: 'town',
    studyRewardBps: 10_000,
  },
  park: {
    id: 'park',
    travelMinutes: 10,
    unlockedByDefault: true,
    climateId: 'riverside',
    studyRewardBps: 10_000,
  },
};

export const RUNTIME_CATALOG: GameCatalog = {
  version: RUNTIME_CATALOG_VERSION,
  getShopOffer: (itemId) => {
    const definition =
      ITEM_CATALOG.find((item) => item.id === itemId) ??
      FALLBACK_DECOR_CATALOG.find((item) => item.id === itemId);
    if (!definition) return undefined;
    return {
      offer: {
        offerId: `offer:${itemId}`,
        itemId,
        unitPrice: Math.max(0, Math.floor(definition.price ?? 0)),
        active: true,
      },
      policy: { storage: 'instance', maxOwned: 99 },
    };
  },
  getLocation: (locationId) =>
    LOCATION_IDS.includes(locationId as LocationId)
      ? locationDefinitions[locationId as LocationId]
      : undefined,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parsePlacedDecor(
  value: unknown,
  extensionLocation?: LocationId,
): PlacedDecor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const placements: PlacedDecor[] = [];
  for (const candidate of value) {
    const position = isRecord(candidate) && isRecord(candidate.position)
      ? candidate.position
      : null;
    const location =
      extensionLocation ??
      (isRecord(candidate) &&
      LOCATION_IDS.includes(candidate.location as LocationId)
        ? (candidate.location as LocationId)
        : null);
    const x =
      position && typeof position.x === 'number'
        ? position.x
        : isRecord(candidate) && typeof candidate.x === 'number'
          ? candidate.x
          : Number.NaN;
    const y =
      position && typeof position.y === 'number'
        ? position.y
        : isRecord(candidate) && typeof candidate.y === 'number'
          ? candidate.y
          : Number.NaN;
    if (
      !isRecord(candidate) ||
      typeof candidate.instanceId !== 'string' ||
      typeof candidate.itemId !== 'string' ||
      !location ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      seen.has(candidate.instanceId)
    ) {
      continue;
    }
    seen.add(candidate.instanceId);
    const rotation =
      candidate.rotation === 90 ||
      candidate.rotation === 180 ||
      candidate.rotation === 270
        ? candidate.rotation
        : 0;
    placements.push({
      instanceId: candidate.instanceId,
      itemId: candidate.itemId,
      location,
      x,
      y,
      rotation,
    });
  }
  return placements;
}

function placementsFromState(state: Readonly<GameState>): PlacedDecor[] {
  const placements: PlacedDecor[] = [];
  for (const location of LOCATION_IDS) {
    const extension = state.extensions[location];
    if (
      isRecord(extension) &&
      extension.worldId === location &&
      Array.isArray(extension.items)
    ) {
      placements.push(...parsePlacedDecor(extension.items, location));
    }
  }
  if (placements.length > 0) return placements;

  const world = state.extensions.world;
  if (isRecord(world)) {
    const legacyPlacements = parsePlacedDecor(world.items);
    if (legacyPlacements.length > 0 || Array.isArray(world.items)) {
      return legacyPlacements;
    }
  }
  const legacyWorld = state.extensions.legacyWorld;
  return isRecord(legacyWorld)
    ? parsePlacedDecor(legacyWorld.placedDecor)
    : [];
}

function worldExtension(
  location: LocationId,
  placements: readonly PlacedDecor[],
  revision: number,
): JsonValue {
  return {
    schemaVersion: 1,
    worldId: location,
    revision,
    items: placements
      .filter((placement) => placement.location === location)
      .map((placement) => ({
      instanceId: placement.instanceId,
      itemId: placement.itemId,
      position: { x: placement.x, y: placement.y },
      rotation: placement.rotation,
    })),
  };
}

function nextWorldRevision(
  state: Readonly<GameState>,
  location: LocationId,
): number {
  const extension = state.extensions[location];
  return isRecord(extension) &&
    typeof extension.revision === 'number' &&
    Number.isSafeInteger(extension.revision)
    ? extension.revision + 1
    : 1;
}

function unusedInstanceId(
  state: Readonly<GameState>,
  prefix: string,
  startAt = 1,
): string {
  let index = startAt;
  let candidate = `${prefix}:${index}`;
  while (state.economy.inventory.instances[candidate]) {
    index += 1;
    candidate = `${prefix}:${index}`;
  }
  return candidate;
}

/**
 * Legacy v1 saves represented unplaced furniture as stacks. The production
 * placement transaction intentionally requires durable instance identities,
 * so loading upgrades every stack once before play begins.
 */
function normalizeLoadedState(input: GameState): GameState {
  const placements = placementsFromState(input);
  const instances = { ...input.economy.inventory.instances };
  const policies = { ...input.economy.inventory.policies };

  for (const [itemId, quantity] of Object.entries(
    input.economy.inventory.stacks,
  )) {
    for (let index = 0; index < quantity; index += 1) {
      const instanceId = unusedInstanceId(
        { ...input, economy: { ...input.economy, inventory: { ...input.economy.inventory, instances } } },
        `stock:${itemId}`,
        index + 1,
      );
      instances[instanceId] = {
        instanceId,
        itemId,
        acquiredAtUtcMs: input.meta.createdAtUtcMs,
        disposition: { kind: 'stored' },
      };
    }
    policies[itemId] = { storage: 'instance', maxOwned: 99 };
  }

  for (const itemId of STARTER_ITEM_IDS) {
    const owned = Object.values(instances).some(
      (instance) => instance.itemId === itemId,
    );
    if (!owned) {
      const instanceId = unusedInstanceId(
        { ...input, economy: { ...input.economy, inventory: { ...input.economy.inventory, instances } } },
        `starter:${itemId}`,
      );
      instances[instanceId] = {
        instanceId,
        itemId,
        acquiredAtUtcMs: input.meta.createdAtUtcMs,
        disposition: { kind: 'stored' },
      };
    }
    policies[itemId] = { storage: 'instance', maxOwned: 99 };
  }

  for (const instance of Object.values(instances)) {
    policies[instance.itemId] = { storage: 'instance', maxOwned: 99 };
  }

  const extensions = { ...input.extensions };
  delete extensions.legacyWorld;
  delete extensions.world;
  for (const location of LOCATION_IDS) {
    extensions[location] = worldExtension(location, placements, 0);
  }
  return {
    ...input,
    economy: {
      ...input.economy,
      inventory: {
        stacks: {},
        instances,
        policies,
      },
    },
    extensions,
  };
}

function locationFromState(state: Readonly<GameState>): LocationId {
  return LOCATION_IDS.includes(state.travel.currentLocationId as LocationId)
    ? (state.travel.currentLocationId as LocationId)
    : 'room';
}

class SystemRuntime {
  private state: GameState | null = null;
  private listeners = new Set<AuthorityListener>();
  private transactionSerial = 0;
  private clockOffsetMs = 0;
  private lastPersistedAt: number | null = null;
  private persistenceError: string | null = null;

  initialize(): AuthorityLoadResult {
    if (this.state) {
      return { recovered: false, migrated: false, warnings: [] };
    }
    const nowUtcMs = Date.now();
    let raw: string | null = null;
    try {
      raw =
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(DEFAULT_SAVE_KEY);
    } catch {
      raw = null;
    }

    const source = raw ?? JSON.stringify(createDefaultWorldState());
    const decoded = decodeAndMigrateGameState(source, {
      catalogVersion: RUNTIME_CATALOG_VERSION,
      migrationUtcMs: nowUtcMs,
      defaultPlayerName: 'Haru',
      weatherSeed: 8_817,
      inventoryPolicyForItem: () => ({
        storage: 'instance',
        maxOwned: 99,
      }),
      knownLocationIds: LOCATION_IDS,
    });
    const recovered = !decoded.ok && raw !== null;
    const fallback = decodeAndMigrateGameState(
      JSON.stringify(createDefaultWorldState()),
      {
        catalogVersion: RUNTIME_CATALOG_VERSION,
        migrationUtcMs: nowUtcMs,
        defaultPlayerName: 'Haru',
        weatherSeed: 8_817,
        inventoryPolicyForItem: () => ({
          storage: 'instance',
          maxOwned: 99,
        }),
        knownLocationIds: LOCATION_IDS,
      },
    );
    if (!decoded.ok && !fallback.ok) {
      this.state = normalizeLoadedState(
        createInitialGameState({
          nowUtcMs,
          playerName: 'Haru',
          initialBalance: 1_260,
          initialLocationId: 'room',
          unlockedLocationIds: LOCATION_IDS,
          catalogVersion: RUNTIME_CATALOG_VERSION,
          weatherSeed: 8_817,
          extensions: Object.fromEntries(
            LOCATION_IDS.map((location) => [
              location,
              worldExtension(location, [], 0),
            ]),
          ),
        }),
      );
    } else if (decoded.ok) {
      this.state = normalizeLoadedState(decoded.state);
    } else if (fallback.ok) {
      this.state = normalizeLoadedState(fallback.state);
    }
    this.persist();
    return {
      recovered,
      migrated: decoded.ok ? decoded.migrated : true,
      warnings: decoded.ok
        ? decoded.warnings.map((warning) => warning.message)
        : [decoded.error.message],
    };
  }

  getState(): Readonly<GameState> {
    if (!this.state) this.initialize();
    return this.state!;
  }

  getWorldState(): SavedWorldState {
    const state = this.getState();
    return {
      version: 1,
      location: locationFromState(state),
      coins: state.economy.wallet.balance,
      ownedItems: toOwnedItemCounts(state.economy.inventory),
      placedDecor: placementsFromState(state),
    };
  }

  getLastPersistedAt(): number | null {
    return this.lastPersistedAt;
  }

  getPersistenceError(): string | null {
    return this.persistenceError;
  }

  getPendingFocusReward(): number {
    const state = this.getState();
    const session = state.study.activeSession;
    if (!session) return 0;
    const focusMinutes = Math.floor(session.plannedDurationMs / 60_000);
    const completionDay = japanDayIndex(this.commandTime(state));
    const focusedMinutesToday =
      state.study.focusedMinutesToday + focusMinutes;
    const qualifiesToday = focusedMinutesToday >= 10;
    let streak = state.study.streak;
    if (qualifiesToday) {
      if (state.study.lastCompletedDay === null) streak = 1;
      else if (completionDay <= state.study.lastCompletedDay) {
        streak = state.study.streak;
      } else {
        streak =
          completionDay === state.study.lastCompletedDay + 1
            ? state.study.streak + 1
            : 1;
      }
    }
    return calculateStudyReward({
      focusMinutes,
      streak,
      locationBonusBps: session.locationBonusBps,
      rewardedHikariToday: state.study.rewardedHikariToday,
      rhythmBonusAlreadyClaimed:
        state.study.dailyRhythmBonusClaimedDay !== null &&
        completionDay <= state.study.dailyRhythmBonusClaimedDay,
      rhythmBonusEligible: qualifiesToday,
    }).hikari;
  }

  subscribe(listener: AuthorityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(
    command: GameCommand,
    prefix: string = command.type,
  ): SystemResult<GameState, AppliedCommand> {
    const state = this.getState() as GameState;
    const result = this.applyTo(
      state,
      command,
      this.transactionId(prefix),
      this.commandTime(state),
    );
    if (result.ok && !result.value.duplicate) this.commit(result.state);
    return result;
  }

  purchase(itemId: string): SystemResult<GameState, AppliedCommand> {
    return this.dispatch({ type: 'purchase', itemId }, 'purchase');
  }

  travel(location: LocationId): SystemResult<GameState, AppliedCommand> {
    return this.dispatch(
      { type: 'travel', locationId: location },
      'travel',
    );
  }

  commitPlacement(
    draft: Omit<PlacedDecor, 'instanceId'>,
    existingInstanceId?: string,
  ): PlacementCommitResult {
    const state = this.getState() as GameState;
    const current = placementsFromState(state);
    const nowUtcMs = this.commandTime(state);

    if (existingInstanceId) {
      const existing = current.find(
        (placement) => placement.instanceId === existingInstanceId,
      );
      if (!existing) {
        return {
          ok: false,
          code: 'PLACEMENT_NOT_FOUND',
          message: 'That decoration is no longer placed.',
        };
      }
      const without = current.filter(
        (placement) => placement.instanceId !== existingInstanceId,
      );
      const storedLocation = existing.location;
      const stored = this.applyTo(
        state,
        {
          type: 'inventory.mark-stored',
          instanceId: existingInstanceId,
          worldExtension: {
            key: storedLocation,
            value: worldExtension(
              storedLocation,
              without,
              nextWorldRevision(state, storedLocation),
            ),
          },
        },
        this.transactionId('placement.store-for-move'),
        nowUtcMs,
      );
      if (!stored.ok) {
        return {
          ok: false,
          code: stored.error.code,
          message: stored.error.message,
        };
      }
      const placement: PlacedDecor = {
        ...draft,
        instanceId: existingInstanceId,
      };
      const afterStore = placementsFromState(stored.state);
      const placed = this.applyTo(
        stored.state,
        {
          type: 'inventory.mark-placed',
          instanceId: existingInstanceId,
          placementId: existingInstanceId,
          locationId: draft.location,
          worldExtension: {
            key: draft.location,
            value: worldExtension(
              draft.location,
              [...afterStore, placement],
              nextWorldRevision(stored.state, draft.location),
            ),
          },
        },
        this.transactionId('placement.move'),
        nowUtcMs,
      );
      if (!placed.ok) {
        return {
          ok: false,
          code: placed.error.code,
          message: placed.error.message,
        };
      }
      this.commit(placed.state);
      return { ok: true, placement };
    }

    const instance = Object.values(state.economy.inventory.instances).find(
      (candidate) =>
        candidate.itemId === draft.itemId &&
        candidate.disposition.kind === 'stored',
    );
    if (!instance) {
      return {
        ok: false,
        code: 'ITEM_NOT_AVAILABLE',
        message: 'There is no free copy of that item in storage.',
      };
    }
    const placement: PlacedDecor = {
      ...draft,
      instanceId: instance.instanceId,
    };
    const result = this.applyTo(
      state,
      {
        type: 'inventory.mark-placed',
        instanceId: instance.instanceId,
        placementId: instance.instanceId,
        locationId: draft.location,
        worldExtension: {
          key: draft.location,
          value: worldExtension(
            draft.location,
            [...current, placement],
            nextWorldRevision(state, draft.location),
          ),
        },
      },
      this.transactionId('placement.place'),
      nowUtcMs,
    );
    if (!result.ok) {
      return {
        ok: false,
        code: result.error.code,
        message: result.error.message,
      };
    }
    this.commit(result.state);
    return { ok: true, placement };
  }

  storePlacement(instanceId: string): PlacementCommitResult {
    const state = this.getState() as GameState;
    const current = placementsFromState(state);
    const existing = current.find(
      (placement) => placement.instanceId === instanceId,
    );
    if (!existing) {
      return {
        ok: false,
        code: 'PLACEMENT_NOT_FOUND',
        message: 'That decoration is no longer placed.',
      };
    }
    const result = this.applyTo(
      state,
      {
        type: 'inventory.mark-stored',
        instanceId,
        worldExtension: {
          key: existing.location,
          value: worldExtension(
            existing.location,
            current.filter((placement) => placement.instanceId !== instanceId),
            nextWorldRevision(state, existing.location),
          ),
        },
      },
      this.transactionId('placement.store'),
      this.commandTime(state),
    );
    if (!result.ok) {
      return {
        ok: false,
        code: result.error.code,
        message: result.error.message,
      };
    }
    this.commit(result.state);
    return { ok: true, placement: existing };
  }

  grantCoins(amount: number): boolean {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    const state = this.getState() as GameState;
    const nowUtcMs = this.commandTime(state);
    const transactionId = this.transactionId('qa.grant');
    const credited = creditWallet(state.economy, {
      commandId: transactionId,
      amount,
      nowUtcMs,
      reason: 'qa',
    });
    if (!credited.ok) return false;
    const revision = state.meta.revision + 1;
    const receiptCommand: GameCommand = {
      type: 'world.advance',
      minutes: 0,
    };
    this.commit({
      ...state,
      meta: {
        ...state.meta,
        revision,
        lastObservedUtcMs: nowUtcMs,
        processedTransactions: {
          ...state.meta.processedTransactions,
          [transactionId]: {
            transactionId,
            revision,
            commandType: receiptCommand.type,
            committedAtUtcMs: nowUtcMs,
            commandFingerprint: fingerprintGameCommand(receiptCommand),
          },
        },
      },
      economy: credited.state,
    });
    return true;
  }

  advanceClock(milliseconds: number): boolean {
    if (
      !Number.isSafeInteger(milliseconds) ||
      milliseconds < 0 ||
      !Number.isSafeInteger(this.clockOffsetMs + milliseconds)
    ) {
      return false;
    }
    this.clockOffsetMs += milliseconds;
    const active = this.getState().study.activeSession;
    if (
      !active ||
      active.status !== 'running' ||
      milliseconds === 0
    ) {
      return true;
    }
    const remaining =
      active.plannedDurationMs - active.accumulatedActiveMs;
    const elapsed = Math.min(remaining, milliseconds);
    if (elapsed <= 0) return true;
    const result = this.dispatch(
      {
        type: 'study.checkpoint',
        sessionId: active.id,
        activeElapsedMs: elapsed,
      },
      'focus.qa-clock',
    );
    return result.ok;
  }

  reset(): void {
    this.state = null;
    this.clockOffsetMs = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DEFAULT_SAVE_KEY);
      }
    } catch {
      // An in-memory reset still succeeds when storage is unavailable.
    }
    this.initialize();
    this.notify();
  }

  private applyTo(
    state: GameState,
    command: GameCommand,
    transactionId: string,
    nowUtcMs: number,
  ): SystemResult<GameState, AppliedCommand> {
    return applyGameCommand(
      state,
      {
        transactionId,
        expectedRevision: state.meta.revision,
        nowUtcMs,
        command,
      },
      RUNTIME_CATALOG,
    );
  }

  private commandTime(state: Readonly<GameState>): number {
    return Math.max(
      Date.now() + this.clockOffsetMs,
      state.meta.lastObservedUtcMs,
    );
  }

  private transactionId(prefix: string): string {
    this.transactionSerial += 1;
    const safePrefix =
      prefix.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 72) || 'command';
    return `${safePrefix}:${Date.now().toString(36)}:${this.transactionSerial.toString(36)}`;
  }

  private commit(state: GameState): void {
    this.state = state;
    this.persist();
    this.notify();
  }

  private persist(): void {
    if (!this.state) return;
    const savedAtUtcMs = Math.max(
      Date.now(),
      this.state.meta.lastObservedUtcMs,
    );
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          DEFAULT_SAVE_KEY,
          encodeGameState(this.state, savedAtUtcMs),
        );
      }
      this.lastPersistedAt = savedAtUtcMs;
      this.persistenceError = null;
    } catch (error) {
      this.persistenceError =
        error instanceof Error ? error.message : 'Save storage is unavailable.';
    }
  }

  private notify(): void {
    if (!this.state) return;
    this.listeners.forEach((listener) => listener(this.state!));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(AUTHORITY_EVENT, { detail: this.state }),
      );
    }
  }
}

export const systemRuntime = new SystemRuntime();
