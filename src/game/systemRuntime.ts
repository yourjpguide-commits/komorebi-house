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
  resolveTabletopSupport,
  rotateTabletopOffset,
  savedTabletopSupportIsValid,
} from '../systems/tabletopSupport';
import { worldFurnitureSupportSocket } from './worldAssets';
import {
  LOCATION_IDS,
  type LocationId,
  type PlacedDecor,
  type SavedWorldState,
} from './types';

function bindTabletopPlacement(
  placement: PlacedDecor,
  placements: readonly PlacedDecor[],
): { placement: PlacedDecor; occupied: boolean } {
  const resolved = resolveTabletopSupport(placements, placement);
  if (resolved.status !== 'supported') return {
    placement: { ...placement, support: undefined },
    occupied: resolved.status === 'occupied',
  };
  return { occupied: false, placement: {
    ...placement,
    x: resolved.support.x,
    y: resolved.support.y,
    rotation: resolved.support.rotation,
    support: {
      parentInstanceId: resolved.support.parentInstanceId,
      socket: resolved.support.socket,
      offset: { ...resolved.support.offset },
    },
  } };
}

function isExactLegacyStarterPlacement(placement: PlacedDecor): boolean {
  return (
    placement.instanceId === 'starter-notebook' && placement.itemId === 'seigaiha-notebook' &&
    placement.location === 'room' && placement.x === 282 && placement.y === 178
  ) || (
    placement.instanceId === 'starter-lamp' && placement.itemId === 'milk-glass-desk-lamp' &&
    placement.location === 'room' && placement.x === 306 && placement.y === 178
  );
}

function isExactCanonicalStarterPlacement(placement: PlacedDecor): boolean {
  return (
    placement.instanceId === 'starter-notebook' && placement.itemId === 'seigaiha-notebook' &&
    placement.location === 'room' && placement.x === 285 && placement.y === 169 && placement.rotation === 270
  ) || (
    placement.instanceId === 'starter-lamp' && placement.itemId === 'milk-glass-desk-lamp' &&
    placement.location === 'room' && placement.x === 297.5 && placement.y === 169.5
  );
}

function restoreTabletopPlacement(
  placement: PlacedDecor,
  placements: readonly PlacedDecor[],
  reserved: Set<string>,
  allowLegacyInference: boolean,
  storedDuplicateIds: Set<string>,
): PlacedDecor {
  if (placement.support && savedTabletopSupportIsValid(placements, placement)) {
    const reservation = `${placement.support.parentInstanceId}:${placement.support.socket}`;
    if (reserved.has(reservation)) {
      storedDuplicateIds.add(placement.instanceId);
      return placement;
    }
    const parent = placements.find((candidate) =>
      candidate.instanceId === placement.support!.parentInstanceId)!;
    const offset = rotateTabletopOffset(placement.support.offset, parent.rotation);
    reserved.add(reservation);
    return { ...placement, x: parent.x + offset.x, y: parent.y + offset.y };
  }
  if (allowLegacyInference && !placement.support &&
    (isExactLegacyStarterPlacement(placement) || isExactCanonicalStarterPlacement(placement))) {
    const parent = placements.find((candidate) =>
      candidate.instanceId === 'starter-table' && candidate.itemId === 'round-chabudai' &&
      candidate.location === 'room' && candidate.x === 294 && candidate.y === 190 && candidate.rotation === 0);
    if (parent) {
      const socket = worldFurnitureSupportSocket(parent.itemId, placement.itemId);
      if (socket) {
        const reservation = `${parent.instanceId}:${socket.id}`;
        if (reserved.has(reservation)) return placement;
        const offset = rotateTabletopOffset(socket.offset, parent.rotation);
        reserved.add(reservation);
        return {
          ...placement,
          x: parent.x + offset.x,
          y: parent.y + offset.y,
          rotation: socket.rotation ?? placement.rotation,
          support: {
            parentInstanceId: parent.instanceId,
            socket: socket.id,
            offset: { ...socket.offset },
          },
        };
      }
    }
  }
  return placement.support ? { ...placement, support: undefined } : placement;
}

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
    const supportCandidate = isRecord(candidate.support) ? candidate.support : null;
    const offset = supportCandidate && isRecord(supportCandidate.offset)
      ? supportCandidate.offset
      : null;
    const support = supportCandidate &&
      typeof supportCandidate.parentInstanceId === 'string' &&
      typeof supportCandidate.socket === 'string' &&
      supportCandidate.socket.length > 0 && offset &&
      typeof offset.x === 'number' && Number.isFinite(offset.x) &&
      typeof offset.y === 'number' && Number.isFinite(offset.y)
      ? {
          parentInstanceId: supportCandidate.parentInstanceId,
          socket: supportCandidate.socket,
          offset: { x: offset.x, y: offset.y },
        }
      : undefined;
    placements.push({
      instanceId: candidate.instanceId,
      itemId: candidate.itemId,
      location,
      x,
      y,
      rotation,
      ...(support ? { support } : {}),
    });
  }
  return placements;
}

export function placementsFromState(state: Readonly<GameState>): PlacedDecor[] {
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
      ...(placement.support ? {
        support: {
          parentInstanceId: placement.support.parentInstanceId,
          socket: placement.support.socket,
          offset: {
            x: placement.support.offset.x,
            y: placement.support.offset.y,
          },
        },
      } : {}),
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
export function normalizeLoadedState(input: GameState): GameState {
  const parsedPlacements = placementsFromState(input);
  const reservedSupports = new Set<string>();
  const storedDuplicateIds = new Set<string>();
  const allowLegacyInference = input.extensions.tabletopSupportMigration !== 1;
  const placements = parsedPlacements.map((placement) =>
    restoreTabletopPlacement(
      placement,
      parsedPlacements,
      reservedSupports,
      allowLegacyInference,
      storedDuplicateIds,
    )).filter((placement) => !storedDuplicateIds.has(placement.instanceId));
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
  for (const instanceId of storedDuplicateIds) {
    const instance = instances[instanceId];
    if (instance) instances[instanceId] = { ...instance, disposition: { kind: 'stored' } };
  }

  const extensions = { ...input.extensions };
  extensions.tabletopSupportMigration = 1;
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
      const unboundPlacement: PlacedDecor = {
        ...draft,
        instanceId: existingInstanceId,
        support: undefined,
      };
      const afterStore = placementsFromState(stored.state);
      const binding = bindTabletopPlacement(unboundPlacement, afterStore);
      if (binding.occupied) return {
        ok: false,
        code: 'TABLETOP_SOCKET_OCCUPIED',
        message: 'That tabletop spot is already occupied.',
      };
      const placement = binding.placement;
      const movedChildren = current
        .filter((candidate) => candidate.support?.parentInstanceId === existingInstanceId)
        .map((child) => {
          const offset = rotateTabletopOffset(child.support!.offset, placement.rotation);
          return {
            ...child,
            location: placement.location,
            x: placement.x + offset.x,
            y: placement.y + offset.y,
          };
        });
      const movedChildIds = new Set(movedChildren.map((child) => child.instanceId));
      const nextPlacements = [
        ...afterStore.filter((candidate) => !movedChildIds.has(candidate.instanceId)),
        ...movedChildren,
        placement,
      ];
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
              nextPlacements,
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
    const unboundPlacement: PlacedDecor = {
      ...draft,
      instanceId: instance.instanceId,
      support: undefined,
    };
    const binding = bindTabletopPlacement(unboundPlacement, current);
    if (binding.occupied) return {
      ok: false,
      code: 'TABLETOP_SOCKET_OCCUPIED',
      message: 'That tabletop spot is already occupied.',
    };
    const placement = binding.placement;
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
    const affectedIds = new Set([
      instanceId,
      ...current
        .filter((placement) => placement.support?.parentInstanceId === instanceId)
        .map((placement) => placement.instanceId),
    ]);
    let nextState = state;
    for (const affectedId of affectedIds) {
      const remaining = placementsFromState(nextState).filter(
        (placement) => placement.instanceId !== affectedId,
      );
      const result = this.applyTo(
        nextState,
        {
          type: 'inventory.mark-stored',
          instanceId: affectedId,
          worldExtension: {
            key: existing.location,
            value: worldExtension(
              existing.location,
              remaining,
              nextWorldRevision(nextState, existing.location),
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
      nextState = result.state;
    }
    this.commit(nextState);
    return { ok: true, placement: existing };
  }

  seedLegacyTabletopFixtureForQa(): boolean {
    const state = structuredClone(this.getState()) as GameState;
    const room = state.extensions.room;
    if (!isRecord(room) || !Array.isArray(room.items)) return false;
    const notebook = room.items.find((item) =>
      isRecord(item) && item.instanceId === 'starter-notebook');
    const lamp = room.items.find((item) =>
      isRecord(item) && item.instanceId === 'starter-lamp');
    if (!isRecord(notebook) || !isRecord(lamp)) return false;
    notebook.position = { x: 282, y: 178 };
    delete notebook.support;
    lamp.position = { x: 305, y: 178 };
    delete lamp.support;
    delete state.extensions.tabletopSupportMigration;
    this.commit(normalizeLoadedState(state));
    return true;
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
