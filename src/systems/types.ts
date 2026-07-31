/**
 * Small, serialisable contracts shared by every gameplay system.
 *
 * Systems never read the ambient clock, random number generator, browser
 * storage, or renderer. Callers inject command ids and timestamps.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type GameplayUnlockRequirement =
  | { kind: 'focus-minutes'; atLeast: number }
  | { kind: 'rhythm-days'; atLeast: number }
  | { kind: 'location-sessions'; locationId: string; atLeast: number };

export interface GameplayEvent<TData = Record<string, JsonValue>> {
  id: string;
  type: string;
  commandId: string;
  atUtcMs: number;
  data: TData;
}

export interface DomainError {
  code: string;
  message: string;
  details?: Record<string, JsonValue>;
}

export type SystemResult<TState, TValue> =
  | {
      ok: true;
      state: TState;
      value: TValue;
      events: GameplayEvent[];
    }
  | {
      ok: false;
      state: TState;
      error: DomainError;
      events: [];
    };

export function accepted<TState, TValue>(
  state: TState,
  value: TValue,
  events: GameplayEvent[] = [],
): SystemResult<TState, TValue> {
  return { ok: true, state, value, events };
}

export function rejected<TState>(
  state: TState,
  code: string,
  message: string,
  details?: Record<string, JsonValue>,
): SystemResult<TState, never> {
  return {
    ok: false,
    state,
    error: details ? { code, message, details } : { code, message },
    events: [],
  };
}

export function gameplayEvent<TData>(
  commandId: string,
  type: string,
  atUtcMs: number,
  data: TData,
  sequence = 0,
): GameplayEvent<TData> {
  return {
    id: `${commandId}:${sequence}:${type}`,
    type,
    commandId,
    atUtcMs,
    data,
  };
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * Identifiers become keys in JSON records. Reject prototype names as well as
 * whitespace/control characters so an item id can never mutate object shape.
 */
export function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    IDENTIFIER_PATTERN.test(value) &&
    !Object.prototype.hasOwnProperty.call(Object.prototype, value) &&
    value !== '__proto__'
  );
}

export function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

export function appendReceipt(receipts: readonly string[], receipt: string): string[] {
  return receipts.includes(receipt) ? [...receipts] : [...receipts, receipt];
}
