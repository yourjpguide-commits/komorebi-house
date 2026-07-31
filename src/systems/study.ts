import {
  accepted,
  boundedInteger,
  gameplayEvent,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isSafeIdentifier,
  rejected,
  type GameplayEvent,
  type SystemResult,
} from './types';

export type StudyActivity = 'study' | 'read' | 'journal' | 'create';
export type StudySessionStatus = 'running' | 'paused';

export interface StudySession {
  id: string;
  activity: StudyActivity;
  locationId: string;
  status: StudySessionStatus;
  plannedDurationMs: number;
  accumulatedActiveMs: number;
  energyReserved: number;
  startedAtUtcMs: number;
  lastCheckpointAtUtcMs: number;
  locationBonusBps: number;
}

export interface StudyRewardReceipt {
  sessionId: string;
  completedAtUtcMs: number;
  completionDay: number;
  focusMinutes: number;
  hikari: number;
  rhythmBonus: number;
}

export interface StudyRewardLedgerBaseline {
  completedSessions: number;
  totalFocusMinutes: number;
  rewardDay: number;
  rewardedHikariOnRewardDay: number;
  focusedMinutesOnRewardDay: number;
  rhythmBonusClaimedDay: number | null;
}

export interface StudyRewardLedger {
  /**
   * Migration-only aggregate for sessions whose historical per-session
   * receipts predate this ledger.
   */
  baseline: StudyRewardLedgerBaseline;
  receipts: Record<string, StudyRewardReceipt>;
}

export interface StudyState {
  energy: number;
  maxEnergy: number;
  lastEnergyRefreshDay: number;
  streak: number;
  bestStreak: number;
  lastCompletedDay: number | null;
  totalFocusMinutes: number;
  completedSessions: number;
  rewardedHikariToday: number;
  focusedMinutesToday: number;
  rewardDay: number;
  dailyRhythmBonusClaimedDay: number | null;
  rewardLedger: StudyRewardLedger;
  activeSession: StudySession | null;
  completedSessionIds: string[];
}

export interface StudyRewardConfig {
  hikariPerMinuteNumerator: number;
  hikariPerMinuteDenominator: number;
  xpPerMinute: number;
  longSessionThresholdMinutes: number;
  longSessionBonusBps: number;
  deepSessionThresholdMinutes: number;
  deepSessionBonusBps: number;
  streakBonusPerDayBps: number;
  maximumStreakBonusDays: number;
  dailyHikariCap: number;
  dailyQualifyingMinutes: number;
  dailyRhythmBonusBase: number;
  dailyRhythmBonusPerPriorStreakDay: number;
  maximumRhythmBonusStreakDays: number;
}

export const DEFAULT_STUDY_REWARD_CONFIG: StudyRewardConfig = {
  // Mirrors the canonical catalog economy: one genuinely active minute earns
  // ten 灯, plus one qualifying daily rhythm bonus.
  hikariPerMinuteNumerator: 10,
  hikariPerMinuteDenominator: 1,
  xpPerMinute: 3,
  longSessionThresholdMinutes: 25,
  longSessionBonusBps: 10_000,
  deepSessionThresholdMinutes: 50,
  deepSessionBonusBps: 10_000,
  streakBonusPerDayBps: 0,
  maximumStreakBonusDays: 7,
  dailyHikariCap: 2_500,
  dailyQualifyingMinutes: 10,
  dailyRhythmBonusBase: 50,
  dailyRhythmBonusPerPriorStreakDay: 10,
  maximumRhythmBonusStreakDays: 5,
};

export interface StudyReward {
  focusMinutes: number;
  hikari: number;
  uncappedHikari: number;
  xp: number;
  streak: number;
  durationBonusBps: number;
  streakBonusBps: number;
  locationBonusBps: number;
  qualityPercent: number;
  dailyCapRemaining: number;
  rhythmBonus: number;
}

export interface StudyProgress {
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  isComplete: boolean;
}

export const JAPAN_UTC_OFFSET_MS = 9 * 60 * 60 * 1_000;
export const DAY_MS = 24 * 60 * 60 * 1_000;

export function japanDayIndex(nowUtcMs: number): number {
  if (
    !isNonNegativeSafeInteger(nowUtcMs) ||
    nowUtcMs > Number.MAX_SAFE_INTEGER - JAPAN_UTC_OFFSET_MS
  ) {
    throw new RangeError('UTC time must be a non-negative safe integer.');
  }
  return Math.floor((nowUtcMs + JAPAN_UTC_OFFSET_MS) / DAY_MS);
}

export function createStudyState(nowUtcMs: number, maxEnergy = 5): StudyState {
  if (!isPositiveSafeInteger(maxEnergy)) {
    throw new RangeError('Maximum energy must be a positive safe integer.');
  }
  const day = japanDayIndex(nowUtcMs);
  return {
    energy: maxEnergy,
    maxEnergy,
    lastEnergyRefreshDay: day,
    streak: 0,
    bestStreak: 0,
    lastCompletedDay: null,
    totalFocusMinutes: 0,
    completedSessions: 0,
    rewardedHikariToday: 0,
    focusedMinutesToday: 0,
    rewardDay: day,
    dailyRhythmBonusClaimedDay: null,
    rewardLedger: {
      baseline: {
        completedSessions: 0,
        totalFocusMinutes: 0,
        rewardDay: day,
        rewardedHikariOnRewardDay: 0,
        focusedMinutesOnRewardDay: 0,
        rhythmBonusClaimedDay: null,
      },
      receipts: {},
    },
    activeSession: null,
    completedSessionIds: [],
  };
}

function syncedForDay(state: StudyState, day: number): StudyState {
  if (day <= state.lastEnergyRefreshDay && day <= state.rewardDay) return state;
  return {
    ...state,
    energy: day > state.lastEnergyRefreshDay ? state.maxEnergy : state.energy,
    lastEnergyRefreshDay: Math.max(state.lastEnergyRefreshDay, day),
    rewardedHikariToday: day > state.rewardDay ? 0 : state.rewardedHikariToday,
    focusedMinutesToday: day > state.rewardDay ? 0 : state.focusedMinutesToday,
    rewardDay: Math.max(state.rewardDay, day),
  };
}

export function syncStudyDay(
  state: StudyState,
  input: { commandId: string; nowUtcMs: number },
): SystemResult<StudyState, { day: number; refreshed: boolean }> {
  if (!input.commandId || !isNonNegativeSafeInteger(input.nowUtcMs)) {
    return rejected(state, 'INVALID_DAILY_SYNC', 'Daily sync requires a command id and valid UTC time.');
  }
  const day = japanDayIndex(input.nowUtcMs);
  const next = syncedForDay(state, day);
  if (next === state) return accepted(state, { day, refreshed: false });
  return accepted(next, { day, refreshed: true }, [
    gameplayEvent(input.commandId, 'study.daily-refreshed', input.nowUtcMs, {
      day,
      energy: next.energy,
      maxEnergy: next.maxEnergy,
    }),
  ]);
}

export function energyCostForDuration(durationMinutes: number): number {
  if (!isPositiveSafeInteger(durationMinutes)) {
    throw new RangeError('Study duration must be a positive safe integer.');
  }
  return Math.min(4, Math.max(1, Math.ceil(durationMinutes / 25)));
}

export function startStudySession(
  state: StudyState,
  input: {
    commandId: string;
    sessionId?: string;
    activity: StudyActivity;
    locationId: string;
    durationMinutes: number;
    nowUtcMs: number;
    locationBonusBps?: number;
  },
): SystemResult<StudyState, StudySession> {
  if (state.activeSession) {
    return rejected(state, 'STUDY_ALREADY_ACTIVE', 'A focus session is already active.');
  }
  if (
    !isSafeIdentifier(input.commandId) ||
    !isSafeIdentifier(input.locationId) ||
    !isNonNegativeSafeInteger(input.nowUtcMs)
  ) {
    return rejected(state, 'INVALID_STUDY_START', 'Study start requires valid ids, location, and UTC time.');
  }
  if (!['study', 'read', 'journal', 'create'].includes(input.activity)) {
    return rejected(state, 'INVALID_STUDY_ACTIVITY', 'The selected focus activity is not supported.');
  }
  if (!isPositiveSafeInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 180) {
    return rejected(state, 'INVALID_STUDY_DURATION', 'Focus sessions must last between 5 and 180 whole minutes.');
  }
  const locationBonusBps = input.locationBonusBps ?? 10_000;
  if (!isPositiveSafeInteger(locationBonusBps) || locationBonusBps < 8_000 || locationBonusBps > 20_000) {
    return rejected(state, 'INVALID_LOCATION_BONUS', 'Location bonus must be between 80% and 200%.');
  }

  const day = japanDayIndex(input.nowUtcMs);
  const synced = syncedForDay(state, day);
  const energyReserved = energyCostForDuration(input.durationMinutes);
  if (synced.energy < energyReserved) {
    return rejected(state, 'NOT_ENOUGH_ENERGY', 'There is not enough focus energy for this session.', {
      available: synced.energy,
      required: energyReserved,
    });
  }
  const sessionId = input.sessionId ?? `${input.commandId}:session`;
  if (
    !isSafeIdentifier(sessionId) ||
    synced.completedSessionIds.includes(sessionId)
  ) {
    return rejected(state, 'STUDY_SESSION_REPLAY', 'This focus session id has already been completed.');
  }
  const session: StudySession = {
    id: sessionId,
    activity: input.activity,
    locationId: input.locationId,
    status: 'running',
    plannedDurationMs: input.durationMinutes * 60_000,
    accumulatedActiveMs: 0,
    energyReserved,
    startedAtUtcMs: input.nowUtcMs,
    lastCheckpointAtUtcMs: input.nowUtcMs,
    locationBonusBps,
  };
  const next: StudyState = {
    ...synced,
    energy: synced.energy - energyReserved,
    activeSession: session,
  };
  const events: GameplayEvent[] = [];
  if (synced !== state) {
    events.push(gameplayEvent(input.commandId, 'study.daily-refreshed', input.nowUtcMs, {
      day,
      energy: synced.energy,
      maxEnergy: synced.maxEnergy,
    }));
  }
  events.push(
    gameplayEvent(input.commandId, 'study.started', input.nowUtcMs, {
      sessionId,
      activity: input.activity,
      locationId: input.locationId,
      durationMinutes: input.durationMinutes,
      energyReserved,
      energyRemaining: next.energy,
    }, events.length),
  );
  return accepted(next, session, events);
}

export function checkpointStudySession(
  state: StudyState,
  input: {
    commandId: string;
    sessionId: string;
    activeElapsedMs: number;
    nowUtcMs: number;
  },
): SystemResult<StudyState, StudySession> {
  const session = state.activeSession;
  if (!session || session.id !== input.sessionId) {
    return rejected(state, 'STUDY_SESSION_NOT_FOUND', 'The focus session is not active.');
  }
  if (session.status !== 'running') {
    return rejected(state, 'STUDY_SESSION_PAUSED', 'Paused time cannot count toward focus progress.');
  }
  if (!isPositiveSafeInteger(input.activeElapsedMs) || !isNonNegativeSafeInteger(input.nowUtcMs)) {
    return rejected(state, 'INVALID_STUDY_ELAPSED', 'Active focus elapsed time must be a positive whole millisecond count.');
  }
  const availableWallMs = input.nowUtcMs - session.lastCheckpointAtUtcMs;
  if (
    !Number.isSafeInteger(availableWallMs) ||
    availableWallMs < input.activeElapsedMs
  ) {
    return rejected(
      state,
      'STUDY_ELAPSED_EXCEEDS_CLOCK',
      'Active focus time cannot exceed elapsed clock time.',
      {
        activeElapsedMs: input.activeElapsedMs,
        availableWallMs: Math.max(0, availableWallMs),
      },
    );
  }
  const accumulatedActiveMs = Math.min(
    session.plannedDurationMs,
    session.accumulatedActiveMs + input.activeElapsedMs,
  );
  const updated = {
    ...session,
    accumulatedActiveMs,
    lastCheckpointAtUtcMs: input.nowUtcMs,
  };
  return accepted({ ...state, activeSession: updated }, updated, [
    gameplayEvent(input.commandId, 'study.progressed', input.nowUtcMs, {
      sessionId: session.id,
      accumulatedActiveMs,
      plannedDurationMs: session.plannedDurationMs,
    }),
  ]);
}

export function pauseStudySession(
  state: StudyState,
  input: { commandId: string; sessionId: string; nowUtcMs: number },
): SystemResult<StudyState, StudySession> {
  const session = state.activeSession;
  if (!session || session.id !== input.sessionId) {
    return rejected(state, 'STUDY_SESSION_NOT_FOUND', 'The focus session is not active.');
  }
  if (session.status === 'paused') {
    return rejected(state, 'STUDY_ALREADY_PAUSED', 'The focus session is already paused.');
  }
  if (
    !isNonNegativeSafeInteger(input.nowUtcMs) ||
    input.nowUtcMs < session.lastCheckpointAtUtcMs
  ) {
    return rejected(state, 'STUDY_CLOCK_ROLLBACK', 'Pause time is before the last focus checkpoint.');
  }
  const updated: StudySession = {
    ...session,
    status: 'paused',
    lastCheckpointAtUtcMs: input.nowUtcMs,
  };
  return accepted({ ...state, activeSession: updated }, updated, [
    gameplayEvent(input.commandId, 'study.paused', input.nowUtcMs, { sessionId: session.id }),
  ]);
}

export function resumeStudySession(
  state: StudyState,
  input: { commandId: string; sessionId: string; nowUtcMs: number },
): SystemResult<StudyState, StudySession> {
  const session = state.activeSession;
  if (!session || session.id !== input.sessionId) {
    return rejected(state, 'STUDY_SESSION_NOT_FOUND', 'The focus session is not active.');
  }
  if (session.status === 'running') {
    return rejected(state, 'STUDY_ALREADY_RUNNING', 'The focus session is already running.');
  }
  if (
    !isNonNegativeSafeInteger(input.nowUtcMs) ||
    input.nowUtcMs < session.lastCheckpointAtUtcMs
  ) {
    return rejected(state, 'STUDY_CLOCK_ROLLBACK', 'Resume time is before the last focus checkpoint.');
  }
  const updated: StudySession = {
    ...session,
    status: 'running',
    lastCheckpointAtUtcMs: input.nowUtcMs,
  };
  return accepted({ ...state, activeSession: updated }, updated, [
    gameplayEvent(input.commandId, 'study.resumed', input.nowUtcMs, { sessionId: session.id }),
  ]);
}

export function getStudySessionProgress(
  session: StudySession,
  pendingActiveMs = 0,
): StudyProgress {
  const elapsedMs = Math.min(
    session.plannedDurationMs,
    session.accumulatedActiveMs + Math.max(0, Math.trunc(pendingActiveMs)),
  );
  return {
    elapsedMs,
    remainingMs: Math.max(0, session.plannedDurationMs - elapsedMs),
    progress: session.plannedDurationMs === 0 ? 1 : elapsedMs / session.plannedDurationMs,
    isComplete: elapsedMs >= session.plannedDurationMs,
  };
}

export function cancelStudySession(
  state: StudyState,
  input: { commandId: string; sessionId: string; nowUtcMs: number },
): SystemResult<StudyState, { refundedEnergy: number }> {
  const session = state.activeSession;
  if (!session || session.id !== input.sessionId) {
    return rejected(state, 'STUDY_SESSION_NOT_FOUND', 'The focus session is not active.');
  }
  const day = japanDayIndex(input.nowUtcMs);
  const synced = syncedForDay(state, day);
  const refundedEnergy = session.accumulatedActiveMs < 60_000 ? session.energyReserved : 0;
  const next: StudyState = {
    ...synced,
    energy: Math.min(synced.maxEnergy, synced.energy + refundedEnergy),
    activeSession: null,
  };
  return accepted(next, { refundedEnergy }, [
    gameplayEvent(input.commandId, 'study.cancelled', input.nowUtcMs, {
      sessionId: session.id,
      accumulatedActiveMs: session.accumulatedActiveMs,
      refundedEnergy,
      energy: next.energy,
    }),
  ]);
}

function applyBps(amount: number, basisPoints: number): number {
  return Math.floor((amount * basisPoints) / 10_000);
}

export function isStudyRewardConfigValid(
  config: StudyRewardConfig,
): boolean {
  const fieldsAreValid =
    isPositiveSafeInteger(config.hikariPerMinuteNumerator) &&
    isPositiveSafeInteger(config.hikariPerMinuteDenominator) &&
    isPositiveSafeInteger(config.xpPerMinute) &&
    isPositiveSafeInteger(config.longSessionThresholdMinutes) &&
    isPositiveSafeInteger(config.longSessionBonusBps) &&
    isPositiveSafeInteger(config.deepSessionThresholdMinutes) &&
    isPositiveSafeInteger(config.deepSessionBonusBps) &&
    isNonNegativeSafeInteger(config.streakBonusPerDayBps) &&
    isNonNegativeSafeInteger(config.maximumStreakBonusDays) &&
    isPositiveSafeInteger(config.dailyHikariCap) &&
    isPositiveSafeInteger(config.dailyQualifyingMinutes) &&
    isNonNegativeSafeInteger(config.dailyRhythmBonusBase) &&
    isNonNegativeSafeInteger(config.dailyRhythmBonusPerPriorStreakDay) &&
    isNonNegativeSafeInteger(config.maximumRhythmBonusStreakDays);
  if (!fieldsAreValid) return false;

  const maximum = BigInt(Number.MAX_SAFE_INTEGER);
  const bpsDivisor = 10_000n;
  const minutes = 180n;
  const numerator = BigInt(config.hikariPerMinuteNumerator);
  const denominator = BigInt(config.hikariPerMinuteDenominator);
  const rawBaseProduct = minutes * numerator;
  if (rawBaseProduct > maximum) return false;
  let maximumHikari = rawBaseProduct / denominator;
  const maximumDurationBps = BigInt(
    Math.max(
      10_000,
      config.longSessionThresholdMinutes <= 180
        ? config.longSessionBonusBps
        : 0,
      config.deepSessionThresholdMinutes <= 180
        ? config.deepSessionBonusBps
        : 0,
    ),
  );
  const maximumStreakBps =
    10_000n +
    BigInt(config.maximumStreakBonusDays) *
      BigInt(config.streakBonusPerDayBps);
  if (maximumStreakBps > maximum) return false;
  for (const basisPoints of [
    maximumDurationBps,
    maximumStreakBps,
    20_000n,
    10_000n,
  ]) {
    const product = maximumHikari * basisPoints;
    if (product > maximum) return false;
    maximumHikari = product / bpsDivisor;
  }
  const maximumRhythmBonus =
    BigInt(config.dailyRhythmBonusBase) +
    BigInt(config.maximumRhythmBonusStreakDays) *
      BigInt(config.dailyRhythmBonusPerPriorStreakDay);
  if (
    maximumRhythmBonus > maximum ||
    maximumHikari + maximumRhythmBonus > maximum
  ) {
    return false;
  }

  let maximumXp = minutes * BigInt(config.xpPerMinute);
  if (maximumXp > maximum) return false;
  for (const basisPoints of [maximumDurationBps, 10_000n]) {
    const product = maximumXp * basisPoints;
    if (product > maximum) return false;
    maximumXp = product / bpsDivisor;
  }
  return maximumXp <= maximum;
}

export function calculateStudyReward(input: {
  focusMinutes: number;
  streak: number;
  locationBonusBps?: number;
  qualityPercent?: number;
  rewardedHikariToday?: number;
  rhythmBonusAlreadyClaimed?: boolean;
  rhythmBonusEligible?: boolean;
  config?: StudyRewardConfig;
}): StudyReward {
  const config = input.config ?? DEFAULT_STUDY_REWARD_CONFIG;
  if (
    !isStudyRewardConfigValid(config) ||
    !isPositiveSafeInteger(input.focusMinutes) ||
    input.focusMinutes > 180 ||
    !isNonNegativeSafeInteger(input.streak) ||
    !isNonNegativeSafeInteger(input.rewardedHikariToday ?? 0) ||
    (input.qualityPercent !== undefined &&
      (!isNonNegativeSafeInteger(input.qualityPercent) ||
        input.qualityPercent > 100)) ||
    (input.locationBonusBps !== undefined &&
      (!isPositiveSafeInteger(input.locationBonusBps) ||
        input.locationBonusBps < 8_000 ||
        input.locationBonusBps > 20_000))
  ) {
    throw new RangeError('Study reward inputs must be non-negative safe integers.');
  }
  const qualityPercent = boundedInteger(input.qualityPercent ?? 100, 0, 100);
  const locationBonusBps = boundedInteger(input.locationBonusBps ?? 10_000, 8_000, 20_000);
  const durationBonusBps =
    input.focusMinutes >= config.deepSessionThresholdMinutes
      ? config.deepSessionBonusBps
      : input.focusMinutes >= config.longSessionThresholdMinutes
        ? config.longSessionBonusBps
        : 10_000;
  const streakDays = Math.min(input.streak, config.maximumStreakBonusDays);
  const streakBonusBps = 10_000 + streakDays * config.streakBonusPerDayBps;
  const qualityBps = 7_500 + qualityPercent * 25;
  const baseHikari = Math.floor(
    (input.focusMinutes * config.hikariPerMinuteNumerator) /
      config.hikariPerMinuteDenominator,
  );
  let baseReward = applyBps(baseHikari, durationBonusBps);
  baseReward = applyBps(baseReward, streakBonusBps);
  baseReward = applyBps(baseReward, locationBonusBps);
  baseReward = applyBps(baseReward, qualityBps);
  const rhythmBonus =
    !input.rhythmBonusAlreadyClaimed &&
    (input.rhythmBonusEligible ??
      input.focusMinutes >= config.dailyQualifyingMinutes)
      ? config.dailyRhythmBonusBase +
        Math.min(
          Math.max(0, input.streak - 1),
          config.maximumRhythmBonusStreakDays,
        ) *
          config.dailyRhythmBonusPerPriorStreakDay
      : 0;
  const uncappedHikari = baseReward + rhythmBonus;

  const rewardedToday = input.rewardedHikariToday ?? 0;
  const dailyCapRemaining = Math.max(0, config.dailyHikariCap - rewardedToday);
  const hikari = Math.min(uncappedHikari, dailyCapRemaining);
  const xp = applyBps(
    applyBps(input.focusMinutes * config.xpPerMinute, durationBonusBps),
    qualityBps,
  );
  return {
    focusMinutes: input.focusMinutes,
    hikari,
    uncappedHikari,
    xp,
    streak: input.streak,
    durationBonusBps,
    streakBonusBps,
    locationBonusBps,
    qualityPercent,
    dailyCapRemaining,
    rhythmBonus,
  };
}

function nextStreak(state: StudyState, completionDay: number): number {
  if (state.lastCompletedDay === null) return 1;
  if (completionDay <= state.lastCompletedDay) return state.streak;
  return completionDay === state.lastCompletedDay + 1 ? state.streak + 1 : 1;
}

export function completeStudySession(
  state: StudyState,
  input: {
    commandId: string;
    sessionId: string;
    nowUtcMs: number;
    qualityPercent?: number;
    rewardConfig?: StudyRewardConfig;
  },
): SystemResult<StudyState, StudyReward> {
  const session = state.activeSession;
  if (!session || session.id !== input.sessionId) {
    return rejected(state, 'STUDY_SESSION_NOT_FOUND', 'The focus session is not active.');
  }
  if (state.completedSessionIds.includes(input.sessionId)) {
    return rejected(state, 'STUDY_REWARD_ALREADY_CLAIMED', 'This focus session was already rewarded.');
  }
  if (session.accumulatedActiveMs < session.plannedDurationMs) {
    return rejected(state, 'STUDY_SESSION_INCOMPLETE', 'The planned active focus time has not elapsed.', {
      accumulatedActiveMs: session.accumulatedActiveMs,
      plannedDurationMs: session.plannedDurationMs,
    });
  }
  if (!isNonNegativeSafeInteger(input.nowUtcMs)) {
    return rejected(state, 'INVALID_TIME', 'Completion time must be a non-negative safe integer.');
  }
  if (input.nowUtcMs < session.lastCheckpointAtUtcMs) {
    return rejected(state, 'STUDY_CLOCK_ROLLBACK', 'Completion time is before the last focus checkpoint.');
  }

  const completionDay = japanDayIndex(input.nowUtcMs);
  const synced = syncedForDay(state, completionDay);
  const focusMinutes = Math.floor(session.plannedDurationMs / 60_000);
  const focusedMinutesToday = synced.focusedMinutesToday + focusMinutes;
  if (!Number.isSafeInteger(focusedMinutesToday)) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'Daily focus time is too large to store safely.');
  }
  const rewardConfig = input.rewardConfig ?? DEFAULT_STUDY_REWARD_CONFIG;
  const qualifiesToday =
    focusedMinutesToday >= rewardConfig.dailyQualifyingMinutes;
  const wasAlreadyQualifiedToday = synced.lastCompletedDay === completionDay;
  const streak = qualifiesToday
    ? nextStreak(synced, completionDay)
    : synced.streak;
  let reward: StudyReward;
  try {
    reward = calculateStudyReward({
      focusMinutes,
      streak,
      locationBonusBps: session.locationBonusBps,
      qualityPercent: input.qualityPercent,
      rewardedHikariToday: synced.rewardedHikariToday,
      rhythmBonusAlreadyClaimed:
        synced.dailyRhythmBonusClaimedDay !== null &&
        completionDay <= synced.dailyRhythmBonusClaimedDay,
      rhythmBonusEligible: qualifiesToday,
      config: rewardConfig,
    });
  } catch {
    return rejected(state, 'INVALID_REWARD_CONFIG', 'The study reward configuration is invalid.');
  }
  const totalFocusMinutes = synced.totalFocusMinutes + focusMinutes;
  const completedSessions = synced.completedSessions + 1;
  const rewardedHikariToday = synced.rewardedHikariToday + reward.hikari;
  if (
    !Number.isSafeInteger(totalFocusMinutes) ||
    !Number.isSafeInteger(completedSessions) ||
    !Number.isSafeInteger(rewardedHikariToday) ||
    !Number.isSafeInteger(streak)
  ) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'Lifetime focus time is too large to store safely.');
  }
  const next: StudyState = {
    ...synced,
    streak,
    bestStreak: Math.max(synced.bestStreak, streak),
    lastCompletedDay:
      !qualifiesToday
        ? synced.lastCompletedDay
        : synced.lastCompletedDay === null
          ? completionDay
          : Math.max(synced.lastCompletedDay, completionDay),
    totalFocusMinutes,
    completedSessions,
    rewardedHikariToday,
    focusedMinutesToday,
    dailyRhythmBonusClaimedDay:
      reward.rhythmBonus > 0
        ? completionDay
        : synced.dailyRhythmBonusClaimedDay,
    rewardLedger: {
      baseline: { ...synced.rewardLedger.baseline },
      receipts: {
        ...synced.rewardLedger.receipts,
        [session.id]: {
          sessionId: session.id,
          completedAtUtcMs: input.nowUtcMs,
          completionDay,
          focusMinutes,
          hikari: reward.hikari,
          rhythmBonus: reward.rhythmBonus,
        },
      },
    },
    activeSession: null,
    completedSessionIds: [...synced.completedSessionIds, session.id],
  };
  const events: GameplayEvent[] = [
    gameplayEvent(input.commandId, 'study.completed', input.nowUtcMs, {
      sessionId: session.id,
      activity: session.activity,
      locationId: session.locationId,
      focusMinutes,
      hikari: reward.hikari,
      xp: reward.xp,
      streak,
      qualityPercent: reward.qualityPercent,
      qualifiedNewDay: qualifiesToday && !wasAlreadyQualifiedToday,
    }),
  ];
  if (streak !== synced.streak) {
    events.push(gameplayEvent(input.commandId, 'study.streak-changed', input.nowUtcMs, {
      streak,
      bestStreak: next.bestStreak,
    }, 1));
  }
  return accepted(next, reward, events);
}

/**
 * Loading cannot know how long the browser was actually focused. A previously
 * running session is therefore restored paused with its checkpointed progress.
 */
export function pauseRunningSessionAfterLoad(state: StudyState): StudyState {
  if (state.activeSession?.status !== 'running') return state;
  return {
    ...state,
    activeSession: { ...state.activeSession, status: 'paused' },
  };
}
