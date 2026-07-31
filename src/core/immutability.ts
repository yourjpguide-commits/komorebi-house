import { compareStableStrings } from "./projection";
import { isRotation } from "./projection";
import {
  WORLD_CORE_LIMITS,
  isBoundedId,
  isPersistableGridPoint,
} from "./limits";
import type {
  JsonObject,
  JsonValue,
  PlacedItem,
  WorldState,
} from "./types";

export const DEFAULT_WORLD_JSON_MAX_DEPTH =
  WORLD_CORE_LIMITS.maxJsonDepth;
export const DEFAULT_WORLD_JSON_MAX_NODES =
  WORLD_CORE_LIMITS.maxJsonNodes;
export const DEFAULT_WORLD_JSON_MAX_CHARACTERS =
  WORLD_CORE_LIMITS.maxJsonCharacters;
export const UNSAFE_WORLD_STATE_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

interface CloneBudget {
  nodes: number;
  characters: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxCharacters: number;
}

export interface FreezeWorldStateOptions {
  readonly maxItems?: number;
  readonly maxJsonNodes?: number;
  readonly maxJsonDepth?: number;
  readonly maxJsonCharacters?: number;
}

function cloneAndFreezeJson(
  value: JsonValue,
  depth: number,
  budget: CloneBudget,
  ancestors: Set<object>,
): JsonValue {
  budget.nodes += 1;
  if (budget.nodes > budget.maxNodes) {
    throw new TypeError(
      `Item state exceeds the ${budget.maxNodes}-node safety limit.`,
    );
  }
  if (depth > budget.maxDepth) {
    throw new TypeError(
      `Item state exceeds the depth-${budget.maxDepth} safety limit.`,
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError("Item state numbers must be finite.");
  }
  if (typeof value === "number" && Object.is(value, -0)) {
    return 0;
  }
  if (typeof value === "string") {
    budget.characters += value.length;
    if (budget.characters > budget.maxCharacters) {
      throw new TypeError(
        `Item state exceeds the ${budget.maxCharacters}-character safety limit.`,
      );
    }
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Cyclic item state is not allowed.");
    }
    ancestors.add(value);
    const source = value as readonly JsonValue[];
    const clone: JsonValue[] = [];
    for (let index = 0; index < source.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(source, index)) {
        throw new TypeError("Sparse item state arrays are not allowed.");
      }
      const entry = source[index];
      if (entry === undefined) {
        throw new TypeError("Undefined item state values are not allowed.");
      }
      clone.push(
        cloneAndFreezeJson(entry, depth + 1, budget, ancestors),
      );
    }
    ancestors.delete(value);
    return Object.freeze(clone);
  }
  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Item state objects must be plain.");
    }
    if (ancestors.has(value)) {
      throw new TypeError("Cyclic item state is not allowed.");
    }
    ancestors.add(value);
    const source = value as Readonly<Record<string, JsonValue>>;
    const clone = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(source).sort()) {
      budget.characters += key.length;
      if (budget.characters > budget.maxCharacters) {
        throw new TypeError(
          `Item state exceeds the ${budget.maxCharacters}-character safety limit.`,
        );
      }
      if (UNSAFE_WORLD_STATE_KEYS.has(key)) {
        throw new TypeError(`Unsafe item state key "${key}" is not allowed.`);
      }
      const entry = source[key];
      if (entry !== undefined) {
        clone[key] = cloneAndFreezeJson(
          entry,
          depth + 1,
          budget,
          ancestors,
        );
      }
    }
    ancestors.delete(value);
    return Object.freeze(clone);
  }
  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new TypeError("Item state must contain only JSON values.");
  }
  return value;
}

function cloneAndFreezePlacedItemWithBudget(
  item: PlacedItem,
  budget: CloneBudget,
): PlacedItem {
  const clone: {
    instanceId: string;
    itemId: string;
    position: Readonly<{ x: number; y: number }>;
    rotation: PlacedItem["rotation"];
    variant?: string;
    state?: JsonObject;
  } = {
    instanceId: item.instanceId,
    itemId: item.itemId,
    position: Object.freeze({
      x: Object.is(item.position.x, -0) ? 0 : item.position.x,
      y: Object.is(item.position.y, -0) ? 0 : item.position.y,
    }),
    rotation: item.rotation,
  };
  if (item.variant !== undefined) clone.variant = item.variant;
  if (item.state !== undefined) {
    clone.state = cloneAndFreezeJson(
      item.state,
      0,
      budget,
      new Set(),
    ) as JsonObject;
  }
  return Object.freeze(clone);
}

/**
 * Creates an owned, deeply immutable state snapshot. Mutation transactions use
 * this at their commit boundary so preview objects cannot alter committed
 * collision or save state behind the revision counter.
 */
export function freezeWorldState(
  worldId: string,
  revision: number,
  items: readonly PlacedItem[],
  options: FreezeWorldStateOptions = {},
): WorldState {
  if (!isBoundedId(worldId)) {
    throw new TypeError(
      `World id must be a non-empty string up to ${WORLD_CORE_LIMITS.maxIdLength} characters.`,
    );
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new TypeError("World revision must be a non-negative safe integer.");
  }
  if (
    options.maxItems !== undefined &&
    (!Number.isSafeInteger(options.maxItems) || options.maxItems < 0)
  ) {
    throw new TypeError("maxItems must be a non-negative safe integer.");
  }
  if (
    options.maxJsonNodes !== undefined &&
    (!Number.isSafeInteger(options.maxJsonNodes) ||
      options.maxJsonNodes < 0)
  ) {
    throw new TypeError("maxJsonNodes must be a non-negative safe integer.");
  }
  if (
    options.maxJsonDepth !== undefined &&
    (!Number.isSafeInteger(options.maxJsonDepth) ||
      options.maxJsonDepth < 0)
  ) {
    throw new TypeError("maxJsonDepth must be a non-negative safe integer.");
  }
  if (
    options.maxJsonCharacters !== undefined &&
    (!Number.isSafeInteger(options.maxJsonCharacters) ||
      options.maxJsonCharacters < 0)
  ) {
    throw new TypeError(
      "maxJsonCharacters must be a non-negative safe integer.",
    );
  }
  const maxItems = Math.min(
    options.maxItems ?? WORLD_CORE_LIMITS.maxItems,
    WORLD_CORE_LIMITS.maxItems,
  );
  if (!Array.isArray(items) || items.length > maxItems) {
    throw new TypeError(`World state may contain at most ${maxItems} items.`);
  }
  const instanceIds = new Set<string>();
  for (const item of items) {
    if (!isBoundedId(item.instanceId) || !isBoundedId(item.itemId)) {
      throw new TypeError(
        `Item ids must be non-empty strings up to ${WORLD_CORE_LIMITS.maxIdLength} characters.`,
      );
    }
    if (instanceIds.has(item.instanceId)) {
      throw new TypeError(`Duplicate instance id "${item.instanceId}".`);
    }
    instanceIds.add(item.instanceId);
    if (!isPersistableGridPoint(item.position)) {
      throw new TypeError(
        `Item positions must be integer cells within ±${WORLD_CORE_LIMITS.maxCoordinateMagnitude}.`,
      );
    }
    if (!isRotation(item.rotation)) {
      throw new TypeError("Item rotations must be 0, 90, 180, or 270.");
    }
    if (
      item.variant !== undefined &&
      (typeof item.variant !== "string" ||
        item.variant.length > WORLD_CORE_LIMITS.maxVariantLength)
    ) {
      throw new TypeError(
        `Item variants may contain at most ${WORLD_CORE_LIMITS.maxVariantLength} characters.`,
      );
    }
  }
  const budget: CloneBudget = {
    nodes: 0,
    characters: 0,
    maxNodes: Math.min(
      options.maxJsonNodes ?? DEFAULT_WORLD_JSON_MAX_NODES,
      DEFAULT_WORLD_JSON_MAX_NODES,
    ),
    maxDepth: Math.min(
      options.maxJsonDepth ?? DEFAULT_WORLD_JSON_MAX_DEPTH,
      DEFAULT_WORLD_JSON_MAX_DEPTH,
    ),
    maxCharacters: Math.min(
      options.maxJsonCharacters ?? DEFAULT_WORLD_JSON_MAX_CHARACTERS,
      DEFAULT_WORLD_JSON_MAX_CHARACTERS,
    ),
  };
  const ownedItems = items
    .map((item) => cloneAndFreezePlacedItemWithBudget(item, budget))
    .sort((a, b) => compareStableStrings(a.instanceId, b.instanceId));
  return Object.freeze({
    schemaVersion: 1 as const,
    worldId,
    revision: Object.is(revision, -0) ? 0 : revision,
    items: Object.freeze(ownedItems),
  });
}
