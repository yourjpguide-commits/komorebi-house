import {
  accepted,
  gameplayEvent,
  isNonNegativeSafeInteger,
  isPositiveSafeInteger,
  isSafeIdentifier,
  rejected,
  type DomainError,
  type GameplayEvent,
  type GameplayUnlockRequirement,
  type SystemResult,
} from './types';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'breeze';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface WorldClockState {
  /** Absolute fictional minutes, beginning at spring day one. */
  worldMinute: number;
  weatherSeed: number;
  climateId: string;
  weather: WeatherKind;
}

export interface WorldClockSnapshot {
  day: number;
  minuteOfDay: number;
  hour: number;
  minute: number;
  season: Season;
  weather: WeatherKind;
  timeOfDay: TimeOfDay;
}

export interface TravelState {
  currentLocationId: string;
  unlockedLocationIds: string[];
  visitCounts: Record<string, number>;
  lastTravelWorldMinute: number | null;
}

export interface LocationDefinition {
  id: string;
  travelMinutes: number;
  routesFrom?: readonly string[];
  unlockedByDefault?: boolean;
  minimumLevel?: number;
  requiredAchievementIds?: readonly string[];
  progressRequirements?: readonly GameplayUnlockRequirement[];
  climateId?: string;
  studyRewardBps?: number;
}

export interface TravelReceipt {
  fromLocationId: string;
  toLocationId: string;
  travelMinutes: number;
  firstVisit: boolean;
}

const MINUTES_PER_DAY = 1_440;
const DAYS_PER_SEASON = 30;

function unsignedHash(input: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function dayForWorldMinute(worldMinute: number): number {
  return Math.floor(worldMinute / MINUTES_PER_DAY) + 1;
}

export function seasonForDay(day: number): Season {
  const index = Math.floor((Math.max(1, day) - 1) / DAYS_PER_SEASON) % 4;
  return (['spring', 'summer', 'autumn', 'winter'] as const)[index] ?? 'spring';
}

function weatherWeights(season: Season): readonly [WeatherKind, number][] {
  switch (season) {
    case 'summer':
      return [['clear', 35], ['cloudy', 18], ['rain', 27], ['breeze', 20]];
    case 'autumn':
      return [['clear', 34], ['cloudy', 24], ['rain', 18], ['breeze', 24]];
    case 'winter':
      return [['clear', 28], ['cloudy', 24], ['rain', 8], ['snow', 24], ['breeze', 16]];
    case 'spring':
    default:
      return [['clear', 30], ['cloudy', 23], ['rain', 24], ['breeze', 23]];
  }
}

export function weatherForDay(
  weatherSeed: number,
  day: number,
  climateId = 'central',
): WeatherKind {
  if (!isNonNegativeSafeInteger(weatherSeed) || !isPositiveSafeInteger(day)) {
    throw new RangeError('Weather seed and day must be safe integers.');
  }
  const season = seasonForDay(day);
  const weights = weatherWeights(season);
  const total = weights.reduce((sum, entry) => sum + entry[1], 0);
  let roll = unsignedHash(`weather|${weatherSeed}|${climateId}|${day}`) % total;
  for (const [weather, weight] of weights) {
    if (roll < weight) return weather;
    roll -= weight;
  }
  return 'clear';
}

export function createWorldClock(input?: {
  weatherSeed?: number;
  startDay?: number;
  minuteOfDay?: number;
  climateId?: string;
}): WorldClockState {
  const weatherSeed = input?.weatherSeed ?? 12_071_995;
  const startDay = input?.startDay ?? 1;
  const minuteOfDay = input?.minuteOfDay ?? 8 * 60;
  const climateId = input?.climateId ?? 'central';
  if (
    !isNonNegativeSafeInteger(weatherSeed) ||
    !isPositiveSafeInteger(startDay) ||
    !isNonNegativeSafeInteger(minuteOfDay) ||
    minuteOfDay >= MINUTES_PER_DAY ||
    !isSafeIdentifier(climateId)
  ) {
    throw new RangeError('Invalid initial world clock.');
  }
  const worldMinute = (startDay - 1) * MINUTES_PER_DAY + minuteOfDay;
  if (!Number.isSafeInteger(worldMinute)) {
    throw new RangeError('Initial world time is too large.');
  }
  return {
    worldMinute,
    weatherSeed,
    climateId,
    weather: weatherForDay(weatherSeed, startDay, climateId),
  };
}

export function getWorldClockSnapshot(state: WorldClockState): WorldClockSnapshot {
  const day = dayForWorldMinute(state.worldMinute);
  const minuteOfDay = state.worldMinute % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  let timeOfDay: TimeOfDay;
  if (hour < 6) timeOfDay = 'night';
  else if (hour < 8) timeOfDay = 'dawn';
  else if (hour < 12) timeOfDay = 'morning';
  else if (hour < 17) timeOfDay = 'afternoon';
  else if (hour < 20) timeOfDay = 'evening';
  else timeOfDay = 'night';
  return {
    day,
    minuteOfDay,
    hour,
    minute,
    season: seasonForDay(day),
    weather: state.weather,
    timeOfDay,
  };
}

export function advanceWorldTime(
  state: WorldClockState,
  input: { commandId: string; minutes: number; nowUtcMs: number },
): SystemResult<WorldClockState, WorldClockSnapshot> {
  if (
    !isSafeIdentifier(input.commandId) ||
    !isPositiveSafeInteger(input.minutes) ||
    !isNonNegativeSafeInteger(input.nowUtcMs)
  ) {
    return rejected(state, 'INVALID_TIME_ADVANCE', 'World time must advance by a positive whole number of minutes.');
  }
  const worldMinute = state.worldMinute + input.minutes;
  if (!Number.isSafeInteger(worldMinute)) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'The world clock cannot safely advance that far.');
  }
  const previous = getWorldClockSnapshot(state);
  const day = dayForWorldMinute(worldMinute);
  const weather = weatherForDay(state.weatherSeed, day, state.climateId);
  const next = { ...state, worldMinute, weather };
  const snapshot = getWorldClockSnapshot(next);
  const events: GameplayEvent[] = [
    gameplayEvent(input.commandId, 'world.time-advanced', input.nowUtcMs, {
      minutes: input.minutes,
      worldMinute,
      day: snapshot.day,
      minuteOfDay: snapshot.minuteOfDay,
    }),
  ];
  if (snapshot.day !== previous.day) {
    events.push(gameplayEvent(input.commandId, 'world.day-changed', input.nowUtcMs, {
      previousDay: previous.day,
      day: snapshot.day,
      season: snapshot.season,
    }, events.length));
  }
  if (weather !== previous.weather) {
    events.push(gameplayEvent(input.commandId, 'world.weather-changed', input.nowUtcMs, {
      weather,
      previousWeather: previous.weather,
      climateId: state.climateId,
    }, events.length));
  }
  return accepted(next, snapshot, events);
}

export function setWorldClimate(
  state: WorldClockState,
  input: { commandId: string; climateId: string; nowUtcMs: number },
): SystemResult<WorldClockState, WorldClockSnapshot> {
  if (
    !isSafeIdentifier(input.commandId) ||
    !isSafeIdentifier(input.climateId) ||
    !isNonNegativeSafeInteger(input.nowUtcMs)
  ) {
    return rejected(state, 'INVALID_CLIMATE', 'Climate id may not be empty.');
  }
  const weather = weatherForDay(
    state.weatherSeed,
    dayForWorldMinute(state.worldMinute),
    input.climateId,
  );
  const next = { ...state, climateId: input.climateId, weather };
  const events =
    state.climateId === input.climateId && state.weather === weather
      ? []
      : [
          gameplayEvent(input.commandId, 'world.climate-changed', input.nowUtcMs, {
            climateId: input.climateId,
            weather,
          }),
        ];
  return accepted(next, getWorldClockSnapshot(next), events);
}

export function createTravelState(
  initialLocationId: string,
  unlockedLocationIds: readonly string[] = [initialLocationId],
): TravelState {
  if (
    !isSafeIdentifier(initialLocationId) ||
    unlockedLocationIds.some((id) => !isSafeIdentifier(id))
  ) {
    throw new RangeError('Initial location ids are invalid.');
  }
  const unlocked = [...new Set([initialLocationId, ...unlockedLocationIds])];
  return {
    currentLocationId: initialLocationId,
    unlockedLocationIds: unlocked,
    visitCounts: { [initialLocationId]: 1 },
    lastTravelWorldMinute: null,
  };
}

export function getTravelError(
  state: TravelState,
  destination: LocationDefinition,
  context: {
    playerLevel: number;
    unlockedAchievementIds: readonly string[];
    totalFocusMinutes?: number;
    progressCounters?: Readonly<Record<string, number>>;
  },
): DomainError | null {
  if (
    !isSafeIdentifier(destination.id) ||
    !isNonNegativeSafeInteger(destination.travelMinutes) ||
    (destination.routesFrom !== undefined &&
      (new Set(destination.routesFrom).size !== destination.routesFrom.length ||
        destination.routesFrom.some((id) => !isSafeIdentifier(id)))) ||
    (destination.minimumLevel !== undefined &&
      !isPositiveSafeInteger(destination.minimumLevel)) ||
    (destination.requiredAchievementIds !== undefined &&
      (new Set(destination.requiredAchievementIds).size !==
        destination.requiredAchievementIds.length ||
        destination.requiredAchievementIds.some(
          (id) => !isSafeIdentifier(id),
        ))) ||
    (destination.climateId !== undefined &&
      !isSafeIdentifier(destination.climateId)) ||
    (destination.studyRewardBps !== undefined &&
      (!isPositiveSafeInteger(destination.studyRewardBps) ||
        destination.studyRewardBps < 8_000 ||
        destination.studyRewardBps > 20_000))
  ) {
    return { code: 'INVALID_LOCATION', message: 'The destination definition is invalid.' };
  }
  if (destination.id === state.currentLocationId) {
    return { code: 'ALREADY_THERE', message: 'The player is already at this location.' };
  }
  if (
    !destination.unlockedByDefault &&
    !state.unlockedLocationIds.includes(destination.id)
  ) {
    return { code: 'LOCATION_LOCKED', message: 'The destination is still locked.' };
  }
  if (
    destination.routesFrom &&
    !destination.routesFrom.includes(state.currentLocationId)
  ) {
    return { code: 'ROUTE_UNAVAILABLE', message: 'There is no route from the current location.' };
  }
  if (context.playerLevel < (destination.minimumLevel ?? 1)) {
    return {
      code: 'LEVEL_LOCKED',
      message: 'The destination requires a higher player level.',
      details: { requiredLevel: destination.minimumLevel ?? 1 },
    };
  }
  const unlocked = new Set(context.unlockedAchievementIds);
  const missing = (destination.requiredAchievementIds ?? []).find((id) => !unlocked.has(id));
  if (missing) {
    return {
      code: 'ACHIEVEMENT_LOCKED',
      message: 'The destination requires another achievement.',
      details: { achievementId: missing },
    };
  }
  for (const requirement of destination.progressRequirements ?? []) {
    if (
      !['focus-minutes', 'rhythm-days', 'location-sessions'].includes(
        requirement.kind,
      ) ||
      !isNonNegativeSafeInteger(requirement.atLeast) ||
      (requirement.kind === 'location-sessions' &&
        !isSafeIdentifier(requirement.locationId))
    ) {
      return { code: 'INVALID_UNLOCK_REQUIREMENT', message: 'The destination unlock rule is invalid.' };
    }
    const actual =
      requirement.kind === 'focus-minutes'
        ? context.totalFocusMinutes ?? 0
        : requirement.kind === 'rhythm-days'
          ? context.progressCounters?.qualifyingRhythmDays ?? 0
          : context.progressCounters?.[
              `locationStudySessions:${requirement.locationId}`
            ] ?? 0;
    if (actual < requirement.atLeast) {
      return {
        code: 'PROGRESS_LOCKED',
        message: 'The destination has not been unlocked by focus progress.',
        details: {
          requirement: requirement.kind,
          required: requirement.atLeast,
          actual,
        },
      };
    }
  }
  return null;
}

export function travelTo(
  state: TravelState,
  input: {
    commandId: string;
    destination: LocationDefinition;
    worldMinute: number;
    nowUtcMs: number;
    playerLevel?: number;
    unlockedAchievementIds?: readonly string[];
    totalFocusMinutes?: number;
    progressCounters?: Readonly<Record<string, number>>;
  },
): SystemResult<TravelState, TravelReceipt> {
  const error = getTravelError(state, input.destination, {
    playerLevel: input.playerLevel ?? 1,
    unlockedAchievementIds: input.unlockedAchievementIds ?? [],
    totalFocusMinutes: input.totalFocusMinutes,
    progressCounters: input.progressCounters,
  });
  if (error) return rejected(state, error.code, error.message, error.details);
  if (
    !isSafeIdentifier(input.commandId) ||
    !isNonNegativeSafeInteger(input.worldMinute) ||
    !isNonNegativeSafeInteger(input.nowUtcMs)
  ) {
    return rejected(state, 'INVALID_TRAVEL', 'Travel requires a command id and valid world time.');
  }
  const visits = state.visitCounts[input.destination.id] ?? 0;
  const nextVisitCount = visits + 1;
  const lastTravelWorldMinute =
    input.worldMinute + input.destination.travelMinutes;
  if (
    !Number.isSafeInteger(nextVisitCount) ||
    !Number.isSafeInteger(lastTravelWorldMinute)
  ) {
    return rejected(state, 'NUMERIC_OVERFLOW', 'Travel counters cannot increase safely.');
  }
  const firstVisit = visits === 0;
  const next: TravelState = {
    ...state,
    currentLocationId: input.destination.id,
    unlockedLocationIds: input.destination.unlockedByDefault
      ? [...new Set([...state.unlockedLocationIds, input.destination.id])]
      : [...state.unlockedLocationIds],
    visitCounts: { ...state.visitCounts, [input.destination.id]: nextVisitCount },
    lastTravelWorldMinute,
  };
  const receipt: TravelReceipt = {
    fromLocationId: state.currentLocationId,
    toLocationId: input.destination.id,
    travelMinutes: input.destination.travelMinutes,
    firstVisit,
  };
  return accepted(next, receipt, [
    gameplayEvent(input.commandId, 'travel.completed', input.nowUtcMs, {
      ...receipt,
      visitCount: nextVisitCount,
    }),
  ]);
}

export function unlockLocation(
  state: TravelState,
  input: { commandId: string; locationId: string; nowUtcMs: number },
): SystemResult<TravelState, { locationId: string; newlyUnlocked: boolean }> {
  if (
    !isSafeIdentifier(input.commandId) ||
    !isSafeIdentifier(input.locationId) ||
    !isNonNegativeSafeInteger(input.nowUtcMs)
  ) {
    return rejected(state, 'INVALID_LOCATION_UNLOCK', 'Location unlock ids may not be empty.');
  }
  if (state.unlockedLocationIds.includes(input.locationId)) {
    return accepted(state, { locationId: input.locationId, newlyUnlocked: false });
  }
  const next = {
    ...state,
    unlockedLocationIds: [...state.unlockedLocationIds, input.locationId],
  };
  return accepted(next, { locationId: input.locationId, newlyUnlocked: true }, [
    gameplayEvent(input.commandId, 'travel.location-unlocked', input.nowUtcMs, {
      locationId: input.locationId,
    }),
  ]);
}
