import { describe, expect, it } from 'vitest';
import {
  CURRENT_GAME_STATE_VERSION,
  DEFAULT_STUDY_REWARD_CONFIG,
  advanceWorldTime,
  applyGameCommand,
  calculateStudyReward,
  checkpointStudySession,
  completeStudySession,
  createEconomyState,
  createInitialGameState,
  createQuoteFingerprint,
  createStudyState,
  createWorldClock,
  decodeAndMigrateGameState,
  encodeGameState,
  getOwnedQuantity,
  japanDayIndex,
  purchaseItem,
  startStudySession,
  syncStudyDay,
  validateGameState,
  type GameCatalog,
  type GameCommand,
  type GameState,
  type LocationDefinition,
} from '../src/systems';

const NOW = Date.UTC(2026, 6, 30, 3, 0, 0);

const locations: Record<string, LocationDefinition> = {
  room: {
    id: 'room',
    travelMinutes: 0,
    unlockedByDefault: true,
    routesFrom: ['garden', 'cafe', 'park'],
    studyRewardBps: 10_000,
  },
  garden: {
    id: 'garden',
    travelMinutes: 5,
    routesFrom: ['room', 'park'],
    studyRewardBps: 11_000,
  },
  cafe: {
    id: 'cafe',
    travelMinutes: 10,
    routesFrom: ['room', 'park'],
    studyRewardBps: 12_000,
  },
  park: {
    id: 'park',
    travelMinutes: 12,
    routesFrom: ['garden', 'cafe'],
    minimumLevel: 2,
    studyRewardBps: 10_500,
  },
};

const catalog: GameCatalog = {
  version: 'test-v1',
  getShopOffer(itemId) {
    if (itemId === 'paper-lamp') {
      return {
        offer: { offerId: 'shop:paper-lamp', itemId, unitPrice: 120 },
        policy: { storage: 'instance', maxOwned: 4 },
      };
    }
    if (itemId === 'tea') {
      return {
        offer: { offerId: 'shop:tea', itemId, unitPrice: 40, bundleSize: 2 },
        policy: { storage: 'stack', maxOwned: 20 },
      };
    }
    return undefined;
  },
  getLocation(locationId) {
    return locations[locationId];
  },
};

function initial(overrides: Partial<Parameters<typeof createInitialGameState>[0]> = {}) {
  return createInitialGameState({
    nowUtcMs: NOW,
    catalogVersion: catalog.version,
    initialBalance: 240,
    initialLocationId: 'room',
    unlockedLocationIds: ['room', 'garden', 'cafe'],
    ...overrides,
  });
}

function apply(
  state: GameState,
  transactionId: string,
  command: GameCommand,
  nowUtcMs = NOW,
  authority?: 'player' | 'system',
) {
  return applyGameCommand(
    state,
    {
      transactionId,
      expectedRevision: state.meta.revision,
      nowUtcMs,
      authority,
      command,
    },
    catalog,
  );
}

function expectAccepted<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
}

describe('economy and inventory', () => {
  it('commits wallet and instanced inventory atomically, including exact funds', () => {
    const economy = createEconomyState(120);
    const offer = { offerId: 'lamp', itemId: 'paper-lamp', unitPrice: 120 };
    const result = purchaseItem(economy, {
      commandId: 'buy-1',
      offer,
      policy: { storage: 'instance', unique: true },
      quoteFingerprint: createQuoteFingerprint(offer, 1, {
        storage: 'instance',
        unique: true,
      }),
      nowUtcMs: NOW,
    });
    expectAccepted(result);
    expect(result.state.wallet.balance).toBe(0);
    expect(result.state.wallet.lifetimeSpent).toBe(120);
    expect(getOwnedQuantity(result.state.inventory, 'paper-lamp')).toBe(1);
    expect(result.value.instanceIds).toEqual(['buy-1:paper-lamp:1']);
    expect(result.events.map((event) => event.type)).toEqual([
      'wallet.debited',
      'inventory.added',
      'shop.purchased',
    ]);
  });

  it('rejects insufficient funds, stale quotes, ownership overflow, and replay without mutation', () => {
    const economy = createEconomyState(119);
    const offer = { offerId: 'lamp', itemId: 'paper-lamp', unitPrice: 120 };
    const poor = purchaseItem(economy, {
      commandId: 'buy-poor',
      offer,
      policy: { storage: 'instance' },
      nowUtcMs: NOW,
    });
    expect(poor.ok).toBe(false);
    expect(poor.state).toBe(economy);
    expect(economy.wallet.balance).toBe(119);
    expect(getOwnedQuantity(economy.inventory, 'paper-lamp')).toBe(0);

    const stale = purchaseItem(createEconomyState(1_000), {
      commandId: 'buy-stale',
      offer,
      policy: { storage: 'instance' },
      quoteFingerprint: 'old-price',
      nowUtcMs: NOW,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('STALE_QUOTE');

    const bought = purchaseItem(createEconomyState(1_000), {
      commandId: 'buy-once',
      offer,
      policy: { storage: 'instance', unique: true },
      nowUtcMs: NOW,
    });
    expectAccepted(bought);
    const overflow = purchaseItem(bought.state, {
      commandId: 'buy-twice',
      offer,
      policy: { storage: 'instance', unique: true },
      nowUtcMs: NOW,
    });
    expect(overflow.ok).toBe(false);
    expect(overflow.state).toBe(bought.state);
    const replay = purchaseItem(bought.state, {
      commandId: 'buy-once',
      offer,
      policy: { storage: 'instance', unique: true },
      nowUtcMs: NOW,
    });
    expect(replay.ok).toBe(false);
    expect(replay.state).toBe(bought.state);
  });

  it('rejects prototype-key item ids and safe-integer stack overflow before debit', () => {
    for (const itemId of ['__proto__', 'constructor', 'toString']) {
      const state = createEconomyState(10);
      const result = purchaseItem(state, {
        commandId: `unsafe-${itemId.replaceAll('_', 'x')}`,
        offer: { offerId: `offer-${itemId}`, itemId, unitPrice: 1 },
        nowUtcMs: NOW,
      });
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
      expect(state.wallet.balance).toBe(10);
      expect(Object.keys(state.inventory.stacks)).toEqual([]);
    }

    const base = createEconomyState(10);
    const full = {
      ...base,
      inventory: {
        ...base.inventory,
        stacks: { tea: Number.MAX_SAFE_INTEGER },
        policies: { tea: { storage: 'stack' as const } },
      },
    };
    const overflow = purchaseItem(full, {
      commandId: 'overflow-stack',
      offer: { offerId: 'overflow-offer', itemId: 'tea', unitPrice: 1 },
      nowUtcMs: NOW,
    });
    expect(overflow.ok).toBe(false);
    expect(overflow.state).toBe(full);
    expect(full.wallet.balance).toBe(10);
    expect(full.inventory.stacks.tea).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('uses a trusted catalog quote and exactly-once aggregate receipt', () => {
    const state = initial();
    const quote = createQuoteFingerprint(
      catalog.getShopOffer('tea')!.offer,
      2,
      catalog.getShopOffer('tea')!.policy,
    );
    const purchase = apply(state, 'checkout-1', {
      type: 'purchase',
      itemId: 'tea',
      bundles: 2,
      quoteFingerprint: quote,
    });
    expectAccepted(purchase);
    expect(purchase.state.economy.wallet.balance).toBe(160);
    expect(purchase.state.economy.inventory.stacks.tea).toBe(4);
    expect(purchase.state.meta.revision).toBe(1);

    const replay = applyGameCommand(
      purchase.state,
      {
        transactionId: 'checkout-1',
        expectedRevision: 0,
        nowUtcMs: NOW,
        command: {
          type: 'purchase',
          itemId: 'tea',
          bundles: 2,
          quoteFingerprint: quote,
        },
      },
      catalog,
    );
    expectAccepted(replay);
    expect(replay.value.duplicate).toBe(true);
    expect(replay.state).toBe(purchase.state);
    expect(replay.events).toEqual([]);
  });

  it('rejects stale aggregate revisions without touching any subsystem', () => {
    const state = initial();
    const first = apply(state, 'first-command', {
      type: 'purchase',
      itemId: 'tea',
    });
    expectAccepted(first);
    const stale = applyGameCommand(
      first.state,
      {
        transactionId: 'stale-command',
        expectedRevision: 0,
        nowUtcMs: NOW,
        command: { type: 'purchase', itemId: 'tea' },
      },
      catalog,
    );
    expect(stale.ok).toBe(false);
    expect(stale.state).toBe(first.state);
    if (!stale.ok) expect(stale.error.code).toBe('STALE_REVISION');
  });

  it('enforces catalog focus, rhythm, and location-session unlock rules at checkout', () => {
    const state = createEconomyState(1_000);
    const offer = {
      offerId: 'earned-only',
      itemId: 'earned-only',
      unitPrice: 100,
      progressRequirements: [
        { kind: 'focus-minutes' as const, atLeast: 45 },
        { kind: 'rhythm-days' as const, atLeast: 2 },
        {
          kind: 'location-sessions' as const,
          locationId: 'kissaten-cafe',
          atLeast: 1,
        },
      ],
    };
    const locked = purchaseItem(state, {
      commandId: 'locked-checkout',
      offer,
      nowUtcMs: NOW,
      totalFocusMinutes: 44,
      progressCounters: {
        qualifyingRhythmDays: 2,
        'locationStudySessions:kissaten-cafe': 1,
      },
    });
    expect(locked.ok).toBe(false);
    expect(locked.state).toBe(state);
    if (!locked.ok) expect(locked.error.code).toBe('PROGRESS_LOCKED');

    const unlocked = purchaseItem(state, {
      commandId: 'earned-checkout',
      offer,
      nowUtcMs: NOW,
      totalFocusMinutes: 45,
      progressCounters: {
        qualifyingRhythmDays: 2,
        'locationStudySessions:kissaten-cafe': 1,
      },
    });
    expectAccepted(unlocked);
    expect(unlocked.state.wallet.balance).toBe(900);
  });

  it('commits owned disposition and the matching WorldCore snapshot atomically', () => {
    const bought = apply(initial(), 'placement-buy', {
      type: 'purchase',
      itemId: 'paper-lamp',
    });
    expectAccepted(bought);
    const instanceId = bought.state.economy.inventory.instances[
      'placement-buy:paper-lamp:1'
    ]!.instanceId;
    const mismatched = apply(bought.state, 'placement-bad', {
      type: 'inventory.mark-placed',
      instanceId,
      placementId: instanceId,
      locationId: 'room',
      worldExtension: {
        key: 'room',
        value: {
          schemaVersion: 1,
          worldId: 'room',
          revision: 1,
          items: [],
        },
      },
    });
    expect(mismatched.ok).toBe(false);
    expect(mismatched.state).toBe(bought.state);

    const roomWorld = {
      schemaVersion: 1,
      worldId: 'room',
      revision: 1,
      items: [
        {
          instanceId,
          itemId: 'paper-lamp',
          position: { x: 2, y: 3 },
          rotation: 0,
        },
      ],
    };
    const placed = apply(bought.state, 'placement-good', {
      type: 'inventory.mark-placed',
      instanceId,
      placementId: instanceId,
      locationId: 'room',
      worldExtension: { key: 'room', value: roomWorld },
    });
    expectAccepted(placed);
    expect(
      placed.state.economy.inventory.instances[instanceId]?.disposition,
    ).toEqual({
      kind: 'placed',
      placementId: instanceId,
      locationId: 'room',
    });
    expect(placed.state.extensions.room).toEqual(roomWorld);

    const stored = apply(placed.state, 'placement-store', {
      type: 'inventory.mark-stored',
      instanceId,
      worldExtension: {
        key: 'room',
        value: { ...roomWorld, revision: 2, items: [] },
      },
    });
    expectAccepted(stored);
    expect(
      stored.state.economy.inventory.instances[instanceId]?.disposition,
    ).toEqual({ kind: 'stored' });
  });
});

describe('focus study, energy, and streaks', () => {
  it('requires checkpointed active time and settles Hikari, XP, time, and achievements once', () => {
    const state = initial();
    const started = apply(state, 'focus-start', {
      type: 'study.start',
      sessionId: 'session-a',
      activity: 'study',
      durationMinutes: 10,
    });
    expectAccepted(started);
    expect(started.state.study.energy).toBe(4);

    const premature = apply(started.state, 'focus-too-soon', {
      type: 'study.complete',
      sessionId: 'session-a',
    });
    expect(premature.ok).toBe(false);
    expect(premature.state).toBe(started.state);

    const instantCheckpoint = apply(started.state, 'focus-instant-cheat', {
      type: 'study.checkpoint',
      sessionId: 'session-a',
      activeElapsedMs: 10 * 60_000,
    });
    expect(instantCheckpoint.ok).toBe(false);
    expect(instantCheckpoint.state).toBe(started.state);
    if (!instantCheckpoint.ok) {
      expect(instantCheckpoint.error.code).toBe('STUDY_ELAPSED_EXCEEDS_CLOCK');
    }

    const completedAt = NOW + 10 * 60_000;
    const checkpointed = apply(started.state, 'focus-tick', {
      type: 'study.checkpoint',
      sessionId: 'session-a',
      activeElapsedMs: 10 * 60_000,
    }, completedAt);
    expectAccepted(checkpointed);
    const completed = apply(checkpointed.state, 'focus-complete', {
      type: 'study.complete',
      sessionId: 'session-a',
    }, completedAt);
    expectAccepted(completed);
    // 10 * 10 base plus the first daily rhythm bonus of 50.
    expect(completed.state.economy.wallet.balance).toBe(390);
    expect(completed.state.progression.experience).toBe(30);
    expect(completed.state.study.totalFocusMinutes).toBe(10);
    expect(completed.state.study.streak).toBe(1);
    expect(completed.state.clock.worldMinute).toBe(state.clock.worldMinute + 10);
    expect(completed.state.progression.unlockedAchievementIds).toContain('first-light');

    const replay = applyGameCommand(
      completed.state,
      {
        transactionId: 'focus-complete',
        expectedRevision: 0,
        nowUtcMs: completedAt,
        command: { type: 'study.complete', sessionId: 'session-a' },
      },
      catalog,
    );
    expectAccepted(replay);
    expect(replay.value.duplicate).toBe(true);
    expect(replay.state.economy.wallet.balance).toBe(390);
    expect(replay.state.study.completedSessions).toBe(1);
  });

  it('calculates canonical deterministic rewards and only one daily rhythm bonus', () => {
    const first = calculateStudyReward({
      focusMinutes: 25,
      streak: 1,
      config: DEFAULT_STUDY_REWARD_CONFIG,
    });
    const repeated = calculateStudyReward({
      focusMinutes: 25,
      streak: 1,
      rhythmBonusAlreadyClaimed: true,
      config: DEFAULT_STUDY_REWARD_CONFIG,
    });
    expect(first.hikari).toBe(300);
    expect(first.rhythmBonus).toBe(50);
    expect(repeated.hikari).toBe(250);
    expect(repeated.rhythmBonus).toBe(0);
    expect(calculateStudyReward({
      focusMinutes: 25,
      streak: 1,
      config: DEFAULT_STUDY_REWARD_CONFIG,
    })).toEqual(first);
  });

  it('uses catalog-authoritative focus-minute house levels and grants each milestone once', () => {
    const state = initial();
    const started = apply(state, 'level-start', {
      type: 'study.start',
      sessionId: 'level-session',
      activity: 'create',
      durationMinutes: 45,
    });
    expectAccepted(started);
    const completedAt = NOW + 45 * 60_000;
    const checkpointed = apply(started.state, 'level-tick', {
      type: 'study.checkpoint',
      sessionId: 'level-session',
      activeElapsedMs: 45 * 60_000,
    }, completedAt);
    expectAccepted(checkpointed);
    const completed = apply(checkpointed.state, 'level-complete', {
      type: 'study.complete',
      sessionId: 'level-session',
    }, completedAt);
    expectAccepted(completed);
    expect(completed.state.progression.level).toBe(2);
    expect(completed.state.progression.claimedLevelGrantLevels).toEqual([1, 2]);
    // 450 focus reward + 50 daily rhythm + 100 level grant.
    expect(completed.state.economy.wallet.balance).toBe(840);

    const replay = applyGameCommand(
      completed.state,
      {
        transactionId: 'level-complete',
        expectedRevision: 0,
        nowUtcMs: completedAt,
        command: { type: 'study.complete', sessionId: 'level-session' },
      },
      catalog,
    );
    expectAccepted(replay);
    expect(replay.state.economy.wallet.balance).toBe(840);
    expect(replay.state.progression.claimedLevelGrantLevels).toEqual([1, 2]);
  });

  it('refreshes energy once per Japan day and handles same-day, next-day, and missed-day streaks', () => {
    const beforeMidnight = Date.UTC(2026, 0, 1, 14, 40);
    const afterMidnight = Date.UTC(2026, 0, 1, 15, 5);
    expect(japanDayIndex(afterMidnight)).toBe(japanDayIndex(beforeMidnight) + 1);

    let state = createStudyState(beforeMidnight, 5);
    const startOne = startStudySession(state, {
      commandId: 's1',
      sessionId: 's1',
      activity: 'read',
      locationId: 'room',
      durationMinutes: 10,
      nowUtcMs: beforeMidnight,
    });
    expectAccepted(startOne);
    const doneOneAt = beforeMidnight + 10 * 60_000;
    const tickOne = checkpointStudySession(startOne.state, {
      commandId: 't1',
      sessionId: 's1',
      activeElapsedMs: 10 * 60_000,
      nowUtcMs: doneOneAt,
    });
    expectAccepted(tickOne);
    const doneOne = completeStudySession(tickOne.state, {
      commandId: 'd1',
      sessionId: 's1',
      nowUtcMs: doneOneAt,
    });
    expectAccepted(doneOne);
    expect(doneOne.state.streak).toBe(1);
    expect(doneOne.state.energy).toBe(4);

    const nextDayStart = startStudySession(doneOne.state, {
      commandId: 's2',
      sessionId: 's2',
      activity: 'study',
      locationId: 'room',
      durationMinutes: 10,
      nowUtcMs: afterMidnight,
    });
    expectAccepted(nextDayStart);
    expect(nextDayStart.state.energy).toBe(4);
    const doneTwoAt = afterMidnight + 10 * 60_000;
    const tickTwo = checkpointStudySession(nextDayStart.state, {
      commandId: 't2',
      sessionId: 's2',
      activeElapsedMs: 10 * 60_000,
      nowUtcMs: doneTwoAt,
    });
    expectAccepted(tickTwo);
    const doneTwo = completeStudySession(tickTwo.state, {
      commandId: 'd2',
      sessionId: 's2',
      nowUtcMs: doneTwoAt,
    });
    expectAccepted(doneTwo);
    expect(doneTwo.state.streak).toBe(2);

    const missed = afterMidnight + 2 * 24 * 60 * 60 * 1_000;
    const synced = syncStudyDay(doneTwo.state, { commandId: 'sync', nowUtcMs: missed });
    expectAccepted(synced);
    expect(synced.state.energy).toBe(5);
    const repeatedSync = syncStudyDay(synced.state, {
      commandId: 'sync-again',
      nowUtcMs: missed,
    });
    expectAccepted(repeatedSync);
    expect(repeatedSync.value.refreshed).toBe(false);
    expect(repeatedSync.state).toBe(synced.state);
  });

  it('does not re-award a daily rhythm bonus after the device clock rolls backward', () => {
    const laterDay = Date.UTC(2026, 0, 10, 3);
    const earlierDay = Date.UTC(2026, 0, 9, 3);
    let state = createStudyState(laterDay);
    const firstStart = startStudySession(state, {
      commandId: 'rollback-start-1',
      sessionId: 'rollback-1',
      activity: 'study',
      locationId: 'room',
      durationMinutes: 10,
      nowUtcMs: laterDay,
    });
    expectAccepted(firstStart);
    const firstDoneAt = laterDay + 10 * 60_000;
    const firstTick = checkpointStudySession(firstStart.state, {
      commandId: 'rollback-tick-1',
      sessionId: 'rollback-1',
      activeElapsedMs: 10 * 60_000,
      nowUtcMs: firstDoneAt,
    });
    expectAccepted(firstTick);
    const firstDone = completeStudySession(firstTick.state, {
      commandId: 'rollback-done-1',
      sessionId: 'rollback-1',
      nowUtcMs: firstDoneAt,
    });
    expectAccepted(firstDone);
    expect(firstDone.value.rhythmBonus).toBe(50);
    state = firstDone.state;

    const secondStart = startStudySession(state, {
      commandId: 'rollback-start-2',
      sessionId: 'rollback-2',
      activity: 'study',
      locationId: 'room',
      durationMinutes: 10,
      nowUtcMs: earlierDay,
    });
    expectAccepted(secondStart);
    const secondDoneAt = earlierDay + 10 * 60_000;
    const secondTick = checkpointStudySession(secondStart.state, {
      commandId: 'rollback-tick-2',
      sessionId: 'rollback-2',
      activeElapsedMs: 10 * 60_000,
      nowUtcMs: secondDoneAt,
    });
    expectAccepted(secondTick);
    const secondDone = completeStudySession(secondTick.state, {
      commandId: 'rollback-done-2',
      sessionId: 'rollback-2',
      nowUtcMs: secondDoneAt,
    });
    expectAccepted(secondDone);
    expect(secondDone.value.rhythmBonus).toBe(0);
    expect(secondDone.value.hikari).toBe(100);
    expect(secondDone.state.streak).toBe(1);
  });

  it('lets multiple short sessions cross the daily qualifying threshold exactly once', () => {
    let state = createStudyState(NOW);
    let currentTime = NOW;
    for (let index = 1; index <= 2; index += 1) {
      const started = startStudySession(state, {
        commandId: `short-start-${index}`,
        sessionId: `short-${index}`,
        activity: 'read',
        locationId: 'room',
        durationMinutes: 5,
        nowUtcMs: currentTime,
      });
      expectAccepted(started);
      currentTime += 5 * 60_000;
      const ticked = checkpointStudySession(started.state, {
        commandId: `short-tick-${index}`,
        sessionId: `short-${index}`,
        activeElapsedMs: 5 * 60_000,
        nowUtcMs: currentTime,
      });
      expectAccepted(ticked);
      const completed = completeStudySession(ticked.state, {
        commandId: `short-done-${index}`,
        sessionId: `short-${index}`,
        nowUtcMs: currentTime,
      });
      expectAccepted(completed);
      if (index === 1) {
        expect(completed.value.rhythmBonus).toBe(0);
        expect(completed.state.streak).toBe(0);
      } else {
        expect(completed.value.rhythmBonus).toBe(50);
        expect(completed.state.streak).toBe(1);
      }
      state = completed.state;
    }
    expect(state.focusedMinutesToday).toBe(10);
    expect(state.dailyRhythmBonusClaimedDay).toBe(japanDayIndex(NOW));
  });
});

describe('travel, time, and weather', () => {
  it('rejects locked travel atomically, then advances location and world time after unlock', () => {
    const state = initial({ unlockedLocationIds: ['room'] });
    const blocked = apply(state, 'travel-locked', {
      type: 'travel',
      locationId: 'garden',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.state).toBe(state);
    expect(blocked.state.clock).toBe(state.clock);

    const unlocked = apply(state, 'unlock-garden', {
      type: 'location.unlock',
      locationId: 'garden',
    }, NOW, 'system');
    expectAccepted(unlocked);
    const travelled = apply(unlocked.state, 'travel-garden', {
      type: 'travel',
      locationId: 'garden',
    });
    expectAccepted(travelled);
    expect(travelled.state.travel.currentLocationId).toBe('garden');
    expect(travelled.state.travel.visitCounts.garden).toBe(1);
    expect(travelled.state.clock.worldMinute).toBe(state.clock.worldMinute + 5);
  });

  it('blocks travel while a focus session owns reserved energy', () => {
    const state = initial();
    const started = apply(state, 'travel-focus-start', {
      type: 'study.start',
      sessionId: 'travel-focus',
      activity: 'read',
      durationMinutes: 10,
    });
    expectAccepted(started);
    const blocked = apply(started.state, 'travel-during-focus', {
      type: 'travel',
      locationId: 'garden',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.state).toBe(started.state);
    if (!blocked.ok) expect(blocked.error.code).toBe('TRAVEL_DURING_STUDY');
  });

  it('produces the same final clock and weather for large and incremental advances', () => {
    const clock = createWorldClock({ weatherSeed: 42, startDay: 29, minuteOfDay: 1_400 });
    const total = 3 * 1_440 + 175;
    const large = advanceWorldTime(clock, {
      commandId: 'large',
      minutes: total,
      nowUtcMs: NOW,
    });
    expectAccepted(large);
    const first = advanceWorldTime(clock, {
      commandId: 'small-1',
      minutes: 1_440,
      nowUtcMs: NOW,
    });
    expectAccepted(first);
    const second = advanceWorldTime(first.state, {
      commandId: 'small-2',
      minutes: total - 1_440,
      nowUtcMs: NOW,
    });
    expectAccepted(second);
    expect(second.state).toEqual(large.state);
  });
});

describe('save codecs and migrations', () => {
  it('round-trips current state with checksum and preserves every authoritative slice', () => {
    const state = initial();
    const raw = encodeGameState(state, NOW);
    const loaded = decodeAndMigrateGameState(raw);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state).toEqual(state);
    expect(loaded.sourceVersion).toBe(CURRENT_GAME_STATE_VERSION);
    expect(loaded.migrated).toBe(false);
    expect(encodeGameState(loaded.state, NOW)).toBe(raw);
  });

  it('restores a running session paused so offline time never earns rewards', () => {
    const state = initial();
    const started = apply(state, 'save-focus-start', {
      type: 'study.start',
      sessionId: 'save-session',
      activity: 'journal',
      durationMinutes: 10,
    });
    expectAccepted(started);
    const loaded = decodeAndMigrateGameState(encodeGameState(started.state));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.study.activeSession?.status).toBe('paused');
    expect(loaded.state.study.activeSession?.accumulatedActiveMs).toBe(0);
    expect(loaded.warnings.map((warning) => warning.code)).toContain(
      'PAUSED_RUNNING_STUDY',
    );
  });

  it('rejects forged reward sessions and duplicate unique ownership', () => {
    const forged = initial();
    forged.study.activeSession = {
      id: 'forged-session',
      activity: 'study',
      locationId: 'room',
      status: 'paused',
      plannedDurationMs: 24 * 60 * 60_000,
      accumulatedActiveMs: 24 * 60 * 60_000,
      energyReserved: 1,
      startedAtUtcMs: NOW,
      lastCheckpointAtUtcMs: NOW + 24 * 60 * 60_000,
      locationBonusBps: 10_000,
    };
    expect(validateGameState(forged)).toBe(false);
    expect(() => encodeGameState(forged)).toThrow(/active study session/i);

    const duplicate = initial();
    duplicate.economy.inventory.policies['one-only'] = {
      storage: 'instance',
      unique: true,
    };
    duplicate.economy.inventory.instances.a = {
      instanceId: 'a',
      itemId: 'one-only',
      acquiredAtUtcMs: NOW,
      disposition: { kind: 'stored' },
    };
    duplicate.economy.inventory.instances.b = {
      instanceId: 'b',
      itemId: 'one-only',
      acquiredAtUtcMs: NOW,
      disposition: { kind: 'stored' },
    };
    expect(validateGameState(duplicate)).toBe(false);
    expect(() => encodeGameState(duplicate)).toThrow(/violates policy/i);
  });

  it('migrates legacy wallet, ownership, placement extension, and location without loss', () => {
    const legacy = JSON.stringify({
      version: 1,
      location: 'garden',
      coins: 175,
      ownedItems: { 'paper-lamp': 2, zabuton: 3 },
      placedDecor: [
        {
          instanceId: 'old-lamp',
          itemId: 'paper-lamp',
          location: 'room',
          x: 10,
          y: 20,
          rotation: 0,
        },
      ],
    });
    const loaded = decodeAndMigrateGameState(legacy, {
      catalogVersion: catalog.version,
      migrationUtcMs: NOW,
      knownLocationIds: Object.keys(locations),
      inventoryPolicyForItem: (itemId) =>
        itemId === 'paper-lamp'
          ? { storage: 'instance', maxOwned: 4 }
          : undefined,
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.economy.wallet.balance).toBe(175);
    expect(loaded.state.economy.inventory.stacks).toEqual({
      zabuton: 3,
    });
    expect(
      getOwnedQuantity(loaded.state.economy.inventory, 'paper-lamp'),
    ).toBe(2);
    expect(
      loaded.state.economy.inventory.instances['old-lamp']?.disposition,
    ).toEqual({
      kind: 'placed',
      placementId: 'old-lamp',
      locationId: 'room',
    });
    expect(
      loaded.state.economy.inventory.policies['paper-lamp'],
    ).toEqual({ storage: 'instance', maxOwned: 4 });
    expect(loaded.state.travel.currentLocationId).toBe('garden');
    expect(loaded.state.travel.unlockedLocationIds).toEqual(
      expect.arrayContaining(['garden', 'room']),
    );
    expect(loaded.state.extensions.legacyWorld).toBeTruthy();
    expect(loaded.migrated).toBe(true);
  });

  it('fails closed for corrupt, tampered, and future saves', () => {
    expect(decodeAndMigrateGameState('{bad json').ok).toBe(false);
    expect(
      decodeAndMigrateGameState(
        JSON.stringify({ meta: { schemaVersion: CURRENT_GAME_STATE_VERSION + 1 } }),
      ),
    ).toMatchObject({ ok: false, error: { code: 'FUTURE_VERSION' } });

    const parsed = JSON.parse(encodeGameState(initial())) as {
      state: { economy: { wallet: { balance: number } } };
    };
    parsed.state.economy.wallet.balance += 1;
    expect(decodeAndMigrateGameState(JSON.stringify(parsed))).toMatchObject({
      ok: false,
      error: { code: 'CHECKSUM_MISMATCH' },
    });

    const brokenLedger = initial();
    brokenLedger.economy.wallet.balance += 1;
    expect(() => encodeGameState(brokenLedger)).toThrow(/wallet ledger/i);
  });

  it('reconciles a valid current save to the injected catalog version', () => {
    const old = initial();
    const loaded = decodeAndMigrateGameState(encodeGameState(old), {
      catalogVersion: 'test-v2',
      knownLocationIds: Object.keys(locations),
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.meta.catalogVersion).toBe('test-v2');
    expect(loaded.warnings.map((warning) => warning.code)).toContain(
      'CATALOG_VERSION_RECONCILED',
    );
    const v2Catalog = { ...catalog, version: 'test-v2' };
    const command = applyGameCommand(
      loaded.state,
      {
        transactionId: 'after-catalog-upgrade',
        expectedRevision: loaded.state.meta.revision,
        nowUtcMs: NOW,
        command: { type: 'daily.sync' },
      },
      v2Catalog,
    );
    expectAccepted(command);

    const purchased = apply(old, 'catalog-old-purchase', {
      type: 'purchase',
      itemId: 'tea',
    });
    expectAccepted(purchased);
    const requiresPolicies = decodeAndMigrateGameState(
      encodeGameState(purchased.state),
      {
        catalogVersion: 'test-v2',
        knownLocationIds: Object.keys(locations),
      },
    );
    expect(requiresPolicies.ok).toBe(false);
    const reconciled = decodeAndMigrateGameState(
      encodeGameState(purchased.state),
      {
        catalogVersion: 'test-v2',
        knownLocationIds: Object.keys(locations),
        inventoryPolicyForItem: (itemId) =>
          itemId === 'tea'
            ? { storage: 'stack', maxOwned: 20 }
            : undefined,
      },
    );
    expect(reconciled.ok).toBe(true);
  });
});

describe('achievement determinism and reward safety', () => {
  it('orders simultaneous unlocks by code point instead of host locale', () => {
    const state = initial();
    const customCatalog: GameCatalog = {
      ...catalog,
      achievements: [
        { id: 'a-lower', title: 'Lower', description: '', conditions: [] },
        { id: 'Z-upper', title: 'Upper', description: '', conditions: [] },
      ],
    };
    const result = applyGameCommand(
      state,
      {
        transactionId: 'unlock-order',
        expectedRevision: 0,
        nowUtcMs: NOW,
        command: { type: 'daily.sync' },
      },
      customCatalog,
    );
    expectAccepted(result);
    expect(result.state.progression.unlockedAchievementIds).toEqual([
      'Z-upper',
      'a-lower',
    ]);
  });

  it('rejects invalid achievement rewards before recording the claim', () => {
    const state = initial();
    state.progression.unlockedAchievementIds = ['bad-reward'];
    const customCatalog: GameCatalog = {
      ...catalog,
      achievements: [
        {
          id: 'bad-reward',
          title: 'Bad Reward',
          description: '',
          conditions: [],
          reward: { hikari: -1 },
        },
      ],
    };
    const result = applyGameCommand(
      state,
      {
        transactionId: 'claim-invalid',
        expectedRevision: 0,
        nowUtcMs: NOW,
        command: { type: 'achievement.claim', achievementId: 'bad-reward' },
      },
      customCatalog,
    );
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(state.progression.claimedAchievementRewardIds).toEqual([]);
  });
});
