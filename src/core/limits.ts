import { isGridPoint } from "./projection";
import type { GridPoint } from "./types";

/** Shared runtime/persistence limits. One domain means successful commits save. */
export const WORLD_CORE_LIMITS = Object.freeze({
  maxIdLength: 128,
  maxVariantLength: 128,
  maxCoordinateMagnitude: 1_000_000,
  maxItems: 2_000,
  maxJsonDepth: 16,
  maxJsonNodes: 10_000,
  maxJsonCharacters: 1_000_000,
  maxSaveCharacters: 5_000_000,
});

export function isBoundedId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= WORLD_CORE_LIMITS.maxIdLength
  );
}

export function isPersistableGridPoint(value: unknown): value is GridPoint {
  return (
    isGridPoint(value) &&
    Math.abs(value.x) <= WORLD_CORE_LIMITS.maxCoordinateMagnitude &&
    Math.abs(value.y) <= WORLD_CORE_LIMITS.maxCoordinateMagnitude
  );
}
