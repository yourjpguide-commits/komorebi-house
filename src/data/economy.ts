import type {
  ItemDefinition,
  LocationId,
  UnlockContext,
  UnlockRequirement,
} from "./types";

export const ECONOMY_CONFIG = {
  currency: {
    id: "hikari",
    name: { ja: "ひかり", en: "Hikari" },
    symbol: "光",
    purchasableWithMoney: false,
  },
  startingBalance: 240,
  hikariPerActiveMinute: 10,
  qualifyingDailyMinutes: 10,
  dailyRhythmBase: 50,
  dailyRhythmStep: 10,
  dailyRhythmCapDays: 5,
  resaleRate: 0.5,
  levelMilestones: [
    { level: 1, focusMinutes: 0, grant: 0 },
    { level: 2, focusMinutes: 45, grant: 100 },
    { level: 3, focusMinutes: 120, grant: 150 },
    { level: 4, focusMinutes: 240, grant: 200 },
    { level: 5, focusMinutes: 420, grant: 250 },
    { level: 6, focusMinutes: 660, grant: 300 },
    { level: 7, focusMinutes: 900, grant: 350 },
  ],
} as const;

export interface StudyRewardInput {
  /** Newly settled whole active minutes, not wall-clock elapsed minutes. */
  readonly activeMinutes: number;
  /** Active minutes already persisted for the current local calendar day. */
  readonly dailyActiveMinutesBefore?: number;
  /** Persisted idempotency flag for the current local calendar day. */
  readonly dailyRhythmAlreadyAwarded?: boolean;
  /** True when this transition is allowed to cross the daily reward threshold. */
  readonly awardDailyRhythmBonus?: boolean;
  /** Qualifying days among the prior six local calendar days. */
  readonly qualifyingDaysInPreviousSix?: number;
}

export interface StudyRewardBreakdown {
  readonly settledMinutes: number;
  readonly dailyActiveMinutesAfter: number;
  readonly base: number;
  readonly dailyRhythm: number;
  readonly total: number;
}

const nonNegativeWhole = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/**
 * A pure balance estimate. Runtime code remains responsible for settling each
 * active minute and daily bonus exactly once.
 */
export function estimateStudyReward(
  input: StudyRewardInput,
): StudyRewardBreakdown {
  const settledMinutes = nonNegativeWhole(input.activeMinutes);
  const base = settledMinutes * ECONOMY_CONFIG.hikariPerActiveMinute;
  const dailyActiveMinutesAfter =
    nonNegativeWhole(input.dailyActiveMinutesBefore ?? 0) + settledMinutes;
  const priorDays = Math.min(
    ECONOMY_CONFIG.dailyRhythmCapDays,
    nonNegativeWhole(input.qualifyingDaysInPreviousSix ?? 0),
  );
  const qualifies =
    input.awardDailyRhythmBonus === true &&
    input.dailyRhythmAlreadyAwarded !== true &&
    dailyActiveMinutesAfter >= ECONOMY_CONFIG.qualifyingDailyMinutes;
  const dailyRhythm = qualifies
    ? ECONOMY_CONFIG.dailyRhythmBase +
      priorDays * ECONOMY_CONFIG.dailyRhythmStep
    : 0;

  return {
    settledMinutes,
    dailyActiveMinutesAfter,
    base,
    dailyRhythm,
    total: base + dailyRhythm,
  };
}

/** Compatibility name for callers that treat this as a balance calculator. */
export const calculateStudyReward = estimateStudyReward;

export function levelFromStudyMinutes(focusMinutes: number): number {
  const minutes = nonNegativeWhole(focusMinutes);
  return ECONOMY_CONFIG.levelMilestones.reduce(
    (level, milestone) =>
      minutes >= milestone.focusMinutes ? milestone.level : level,
    1,
  );
}

export function grantsEarnedThroughMinutes(focusMinutes: number): number {
  const minutes = nonNegativeWhole(focusMinutes);
  return ECONOMY_CONFIG.levelMilestones.reduce(
    (sum, milestone) =>
      minutes >= milestone.focusMinutes ? sum + milestone.grant : sum,
    0,
  );
}

/**
 * One transition's newly crossed level grants. Persist the new focus total and
 * transaction receipt atomically; the cumulative helper above is reporting-only.
 */
export function levelGrantsBetween(
  previousFocusMinutes: number,
  nextFocusMinutes: number,
): number {
  const previous = nonNegativeWhole(previousFocusMinutes);
  const next = nonNegativeWhole(nextFocusMinutes);
  if (next <= previous) return 0;

  return ECONOMY_CONFIG.levelMilestones.reduce(
    (sum, milestone) =>
      milestone.focusMinutes > previous &&
      milestone.focusMinutes <= next
        ? sum + milestone.grant
        : sum,
    0,
  );
}

export function unlockRequirementMet(
  requirement: UnlockRequirement,
  context: UnlockContext,
): boolean {
  switch (requirement.type) {
    case "starter":
      return true;
    case "focus-minutes":
      return context.focusMinutes >= requirement.minutes;
    case "rhythm-days":
      return context.qualifyingRhythmDays >= requirement.days;
    case "location-sessions":
      return (
        (context.locationStudySessions[requirement.locationId] ?? 0) >=
        requirement.sessions
      );
  }
}

export function isItemUnlocked(
  item: ItemDefinition,
  context: UnlockContext,
): boolean {
  return unlockRequirementMet(item.unlock, context);
}

export function makeUnlockContext(
  focusMinutes = 0,
  qualifyingRhythmDays = 0,
  locationStudySessions: Partial<Readonly<Record<LocationId, number>>> = {},
): UnlockContext {
  return { focusMinutes, qualifyingRhythmDays, locationStudySessions };
}

export function resaleValue(price: number): number {
  return Math.floor(nonNegativeWhole(price) * ECONOMY_CONFIG.resaleRate);
}
