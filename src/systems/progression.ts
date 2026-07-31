import {
  accepted,
  gameplayEvent,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isSafeIdentifier,
  rejected,
  type GameplayEvent,
  type JsonValue,
  type SystemResult,
} from './types';

export interface ProgressionState {
  experience: number;
  experienceLevel: number;
  /** House level is the catalog-facing level derived from active focus minutes. */
  level: number;
  maxLevelReached: number;
  claimedLevelGrantLevels: number[];
  counters: Record<string, number>;
  unlockedAchievementIds: string[];
  achievementDefinitionFingerprints: Record<string, string>;
  claimedAchievementRewardIds: string[];
}

export type AchievementCondition =
  | { kind: 'counter'; counter: string; atLeast: number }
  | { kind: 'level'; atLeast: number };

export interface AchievementReward {
  hikari?: number;
  experience?: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  hidden?: boolean;
  conditions: readonly AchievementCondition[];
  /** Metadata for an explicit, separately receipted reward claim command. */
  reward?: AchievementReward;
}

export interface ProgressionUpdate {
  newlyUnlockedAchievementIds: string[];
  countersChanged: Record<string, number>;
}

export interface HouseLevelMilestone {
  level: number;
  focusMinutes: number;
  hikariGrant: number;
}

/** Canonical furnishing/location unlock curve shared with the item catalog. */
export const HOUSE_LEVEL_MILESTONES: readonly HouseLevelMilestone[] = [
  { level: 1, focusMinutes: 0, hikariGrant: 0 },
  { level: 2, focusMinutes: 45, hikariGrant: 100 },
  { level: 3, focusMinutes: 120, hikariGrant: 150 },
  { level: 4, focusMinutes: 240, hikariGrant: 200 },
  { level: 5, focusMinutes: 420, hikariGrant: 250 },
  { level: 6, focusMinutes: 660, hikariGrant: 300 },
  { level: 7, focusMinutes: 900, hikariGrant: 350 },
] as const;

export const DEFAULT_ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    description: 'Complete your first focus session.',
    conditions: [{ kind: 'counter', counter: 'focusSessions', atLeast: 1 }],
  },
  {
    id: 'quiet-routine',
    title: 'Quiet Routine',
    description: 'Complete ten focus sessions.',
    conditions: [{ kind: 'counter', counter: 'focusSessions', atLeast: 10 }],
  },
  {
    id: 'hundred-minutes',
    title: 'A Hundred Quiet Minutes',
    description: 'Focus for one hundred minutes in total.',
    conditions: [{ kind: 'counter', counter: 'focusMinutes', atLeast: 100 }],
  },
  {
    id: 'thoughtful-collector',
    title: 'Thoughtful Collector',
    description: 'Bring home ten items.',
    conditions: [{ kind: 'counter', counter: 'itemsPurchased', atLeast: 10 }],
  },
  {
    id: 'neighborly',
    title: 'Neighborly',
    description: 'Visit four different places.',
    conditions: [{ kind: 'counter', counter: 'uniqueLocationsVisited', atLeast: 4 }],
  },
  {
    id: 'seasoned-student',
    title: 'Seasoned Student',
    description: 'Reach level five.',
    conditions: [{ kind: 'level', atLeast: 5 }],
  },
] as const;

export function createProgressionState(): ProgressionState {
  return {
    experience: 0,
    experienceLevel: 1,
    level: 1,
    maxLevelReached: 1,
    claimedLevelGrantLevels: [1],
    counters: {},
    unlockedAchievementIds: [],
    achievementDefinitionFingerprints: {},
    claimedAchievementRewardIds: [],
  };
}

/**
 * Cumulative XP threshold. Level 2 begins at 100 XP; later levels widen
 * gradually without a separate mutable level table.
 */
export function experienceRequiredForLevel(level: number): number {
  if (!isPositiveSafeInteger(level)) {
    throw new RangeError('Level must be a positive safe integer.');
  }
  if (level === 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.45));
}

export function levelForExperience(experience: number, maximumLevel = 99): number {
  if (!isNonNegativeSafeInteger(experience) || !isPositiveSafeInteger(maximumLevel)) {
    throw new RangeError('Experience and maximum level must be safe integers.');
  }
  let level = 1;
  while (
    level < maximumLevel &&
    experience >= experienceRequiredForLevel(level + 1)
  ) {
    level += 1;
  }
  return level;
}

export function houseLevelForFocusMinutes(focusMinutes: number): number {
  if (!isNonNegativeSafeInteger(focusMinutes)) {
    throw new RangeError('Focus minutes must be a non-negative safe integer.');
  }
  let level = 1;
  for (const milestone of HOUSE_LEVEL_MILESTONES) {
    if (focusMinutes >= milestone.focusMinutes) level = milestone.level;
  }
  return level;
}

export function applyHouseLevelProgress(
  state: ProgressionState,
  input: { commandId: string; totalFocusMinutes: number; nowUtcMs: number },
): SystemResult<
  ProgressionState,
  { level: number; levelsGained: number[]; hikariGrant: number }
> {
  if (!input.commandId || !isNonNegativeSafeInteger(input.totalFocusMinutes)) {
    return rejected(state, 'INVALID_HOUSE_LEVEL_PROGRESS', 'House progression requires valid focus minutes.');
  }
  const targetLevel = houseLevelForFocusMinutes(input.totalFocusMinutes);
  const claimed = new Set(state.claimedLevelGrantLevels);
  const earnedMilestones = HOUSE_LEVEL_MILESTONES.filter(
    (milestone) =>
      milestone.level <= targetLevel &&
      milestone.level > 1 &&
      !claimed.has(milestone.level),
  );
  const hikariGrant = earnedMilestones.reduce(
    (total, milestone) => total + milestone.hikariGrant,
    0,
  );
  for (const milestone of earnedMilestones) claimed.add(milestone.level);
  const level = Math.max(state.level, targetLevel);
  const next: ProgressionState = {
    ...state,
    level,
    maxLevelReached: Math.max(state.maxLevelReached, level),
    claimedLevelGrantLevels: [...claimed].sort((a, b) => a - b),
  };
  const events: GameplayEvent[] = [];
  if (level > state.level) {
    events.push(gameplayEvent(input.commandId, 'progression.level-up', input.nowUtcMs, {
      previousLevel: state.level,
      level,
      totalFocusMinutes: input.totalFocusMinutes,
    }));
  }
  earnedMilestones.forEach((milestone, index) => {
    events.push(gameplayEvent(input.commandId, 'progression.level-grant-earned', input.nowUtcMs, {
      level: milestone.level,
      hikari: milestone.hikariGrant,
    }, index + 1));
  });
  return accepted(next, {
    level,
    levelsGained: earnedMilestones.map((milestone) => milestone.level),
    hikariGrant,
  }, events);
}

export function grantExperience(
  state: ProgressionState,
  input: { commandId: string; amount: number; nowUtcMs: number; reason: string },
): SystemResult<ProgressionState, { amount: number; level: number }> {
  if (!input.commandId || !input.reason || !isPositiveSafeInteger(input.amount)) {
    return rejected(state, 'INVALID_EXPERIENCE_GRANT', 'Experience grants require an id, reason, and positive amount.');
  }
  const experience = state.experience + input.amount;
  if (!Number.isSafeInteger(experience)) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'Experience cannot safely hold this grant.');
  }
  const experienceLevel = levelForExperience(experience);
  const next: ProgressionState = {
    ...state,
    experience,
    experienceLevel,
  };
  const events: GameplayEvent[] = [
    gameplayEvent(input.commandId, 'progression.experience-granted', input.nowUtcMs, {
      amount: input.amount,
      experience,
      reason: input.reason,
    }),
  ];
  if (experienceLevel > state.experienceLevel) {
    events.push(gameplayEvent(input.commandId, 'progression.experience-level-up', input.nowUtcMs, {
      previousLevel: state.experienceLevel,
      level: experienceLevel,
    }, 1));
  }
  return accepted(next, { amount: input.amount, level: experienceLevel }, events);
}

function numericEventData(event: GameplayEvent, key: string): number {
  if (!event.data || typeof event.data !== 'object') return 0;
  const value = (event.data as Record<string, unknown>)[key];
  return isNonNegativeSafeInteger(value) ? value : 0;
}

function booleanEventData(event: GameplayEvent, key: string): boolean {
  if (!event.data || typeof event.data !== 'object') return false;
  return (event.data as Record<string, unknown>)[key] === true;
}

function stringEventData(event: GameplayEvent, key: string): string | null {
  if (!event.data || typeof event.data !== 'object') return null;
  const value = (event.data as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function countersForGameplayEvents(
  events: readonly GameplayEvent[],
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const increment = (key: string, amount: number) => {
    if (amount > 0) deltas[key] = (deltas[key] ?? 0) + amount;
  };
  for (const event of events) {
    switch (event.type) {
      case 'study.completed':
        increment('focusSessions', 1);
        increment('focusMinutes', numericEventData(event, 'focusMinutes'));
        increment('hikariFromStudy', numericEventData(event, 'hikari'));
        if (booleanEventData(event, 'qualifiedNewDay')) {
          increment('qualifyingRhythmDays', 1);
        }
        {
          const locationId = stringEventData(event, 'locationId');
          if (locationId) increment(`locationStudySessions:${locationId}`, 1);
        }
        break;
      case 'shop.purchased':
        increment('purchases', 1);
        increment('itemsPurchased', numericEventData(event, 'quantity'));
        increment('hikariSpent', numericEventData(event, 'totalPrice'));
        break;
      case 'travel.completed':
        increment('journeys', 1);
        if (booleanEventData(event, 'firstVisit')) increment('uniqueLocationsVisited', 1);
        break;
      case 'inventory.placed':
        increment('itemsPlaced', 1);
        break;
      default:
        break;
    }
  }
  return deltas;
}

function achievementSatisfied(
  state: ProgressionState,
  achievement: AchievementDefinition,
): boolean {
  return achievement.conditions.every((condition) => {
    if (condition.kind === 'level') return state.level >= condition.atLeast;
    return (state.counters[condition.counter] ?? 0) >= condition.atLeast;
  });
}

export function achievementDefinitionFingerprint(
  achievement: AchievementDefinition,
): string {
  const conditions = [...achievement.conditions]
    .map((condition) =>
      condition.kind === 'counter'
        ? `counter:${condition.counter}:${condition.atLeast}`
        : `level:${condition.atLeast}`,
    )
    .sort()
    .join('|');
  const source = [
    achievement.id,
    conditions,
    achievement.reward?.hikari ?? 0,
    achievement.reward?.experience ?? 0,
  ].join('||');
  let hash = 2_166_136_261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function achievementDefinitionIssues(
  achievements: readonly AchievementDefinition[],
): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const achievement of achievements) {
    if (!isSafeIdentifier(achievement.id) || ids.has(achievement.id)) {
      issues.push(`invalid or duplicate achievement id: ${achievement.id}`);
    }
    ids.add(achievement.id);
    if (
      !isNonNegativeSafeInteger(achievement.reward?.hikari ?? 0) ||
      !isNonNegativeSafeInteger(achievement.reward?.experience ?? 0)
    ) {
      issues.push(`invalid achievement reward: ${achievement.id}`);
    }
    if (achievement.conditions.length === 0) continue;
    for (const condition of achievement.conditions) {
      if (
        (condition.kind !== 'counter' && condition.kind !== 'level') ||
        !isPositiveSafeInteger(condition.atLeast) ||
        (condition.kind === 'counter' &&
          !isSafeIdentifier(condition.counter))
      ) {
        issues.push(`invalid achievement condition: ${achievement.id}`);
      }
    }
  }
  return issues;
}

export function recordProgressionEvents(
  state: ProgressionState,
  input: {
    commandId: string;
    events: readonly GameplayEvent[];
    nowUtcMs: number;
    achievements?: readonly AchievementDefinition[];
  },
): SystemResult<ProgressionState, ProgressionUpdate> {
  const deltas = countersForGameplayEvents(input.events);
  const definitions = [...(input.achievements ?? DEFAULT_ACHIEVEMENTS)];
  const definitionIssues = achievementDefinitionIssues(definitions);
  if (definitionIssues.length > 0) {
    return rejected(
      state,
      'INVALID_ACHIEVEMENT_DEFINITION',
      definitionIssues.join('; '),
    );
  }
  const counters = { ...state.counters };
  for (const [key, delta] of Object.entries(deltas)) {
    const nextValue = (counters[key] ?? 0) + delta;
    if (!Number.isSafeInteger(nextValue)) {
      return rejected(state, 'NUMERIC_OVERFLOW', `Progress counter "${key}" overflowed.`);
    }
    counters[key] = nextValue;
  }
  let next: ProgressionState = { ...state, counters };
  const unlocked = new Set(state.unlockedAchievementIds);
  const fingerprints = { ...state.achievementDefinitionFingerprints };
  const newlyUnlockedAchievementIds: string[] = [];
  definitions.sort(
    (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const achievement of definitions) {
    if (!achievement.id || unlocked.has(achievement.id)) continue;
    if (achievementSatisfied(next, achievement)) {
      unlocked.add(achievement.id);
      fingerprints[achievement.id] =
        achievementDefinitionFingerprint(achievement);
      newlyUnlockedAchievementIds.push(achievement.id);
    }
  }
  next = {
    ...next,
    unlockedAchievementIds: [...unlocked],
    achievementDefinitionFingerprints: fingerprints,
  };
  const events = newlyUnlockedAchievementIds.map((achievementId, index) => {
    const definition = definitions.find((candidate) => candidate.id === achievementId);
    return gameplayEvent(input.commandId, 'achievement.unlocked', input.nowUtcMs, {
      achievementId,
      title: definition?.title ?? achievementId,
    }, index);
  });
  return accepted(next, { newlyUnlockedAchievementIds, countersChanged: deltas }, events);
}

export function markAchievementRewardClaimed(
  state: ProgressionState,
  input: { commandId: string; achievementId: string; nowUtcMs: number },
): SystemResult<ProgressionState, { achievementId: string }> {
  if (!state.unlockedAchievementIds.includes(input.achievementId)) {
    return rejected(state, 'ACHIEVEMENT_LOCKED', 'The achievement has not been unlocked.');
  }
  if (state.claimedAchievementRewardIds.includes(input.achievementId)) {
    return rejected(state, 'ACHIEVEMENT_REWARD_CLAIMED', 'This achievement reward was already claimed.');
  }
  const next = {
    ...state,
    claimedAchievementRewardIds: [
      ...state.claimedAchievementRewardIds,
      input.achievementId,
    ],
  };
  return accepted(next, { achievementId: input.achievementId }, [
    gameplayEvent(input.commandId, 'achievement.reward-claimed', input.nowUtcMs, {
      achievementId: input.achievementId,
    }),
  ]);
}

export function achievementRewardAsJson(
  definition: AchievementDefinition,
): Record<string, JsonValue> {
  return {
    achievementId: definition.id,
    hikari: definition.reward?.hikari ?? 0,
    experience: definition.reward?.experience ?? 0,
  };
}
