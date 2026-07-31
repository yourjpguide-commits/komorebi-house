import { validatePlacement } from "./placement";
import { getItemDefinition } from "./footprints";
import {
  DEFAULT_WORLD_JSON_MAX_DEPTH,
  DEFAULT_WORLD_JSON_MAX_CHARACTERS,
  DEFAULT_WORLD_JSON_MAX_NODES,
  UNSAFE_WORLD_STATE_KEYS,
  freezeWorldState,
} from "./immutability";
import {
  WORLD_CORE_LIMITS,
  isPersistableGridPoint,
} from "./limits";
import {
  isRotation,
} from "./projection";
import type {
  ItemRegistry,
  JsonObject,
  JsonValue,
  PlacedItem,
  SaveValidationIssue,
  WorldSaveParseOptions,
  WorldSaveParseResult,
  WorldState,
} from "./types";

export const WORLD_SAVE_SCHEMA_VERSION = 1 as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validationError(
  path: string,
  code: SaveValidationIssue["code"],
  message: string,
): SaveValidationIssue {
  return { path, code, message };
}

function normalizeLimit(
  value: number | undefined,
  fallback: number,
  path: string,
  errors: SaveValidationIssue[],
): number {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value < 0)
  ) {
    errors.push(
      validationError(
        path,
        "INVALID_VALUE",
        "Save validation limits must be non-negative safe integers.",
      ),
    );
    return fallback;
  }
  return Math.min(value ?? fallback, fallback);
}

interface JsonValidationBudget {
  nodes: number;
  characters: number;
  exhausted: boolean;
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxCharacters: number;
}

function sanitizeJsonValue(
  value: unknown,
  path: string,
  depth: number,
  budget: JsonValidationBudget,
  errors: SaveValidationIssue[],
  ancestors: Set<object>,
): JsonValue | undefined {
  if (budget.exhausted) {
    return undefined;
  }
  budget.nodes += 1;
  if (budget.nodes > budget.maxNodes) {
    budget.exhausted = true;
    errors.push(
      validationError(
        path,
        "LIMIT_EXCEEDED",
        `JSON state exceeds ${budget.maxNodes} nodes.`,
      ),
    );
    return undefined;
  }
  if (depth > budget.maxDepth) {
    errors.push(
      validationError(
        path,
        "LIMIT_EXCEEDED",
        `JSON state exceeds depth ${budget.maxDepth}.`,
      ),
    );
    return undefined;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "string") {
      budget.characters += value.length;
      if (budget.characters > budget.maxCharacters) {
        budget.exhausted = true;
        errors.push(
          validationError(
            path,
            "LIMIT_EXCEEDED",
            `JSON state exceeds ${budget.maxCharacters} characters.`,
          ),
        );
        return undefined;
      }
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      errors.push(
        validationError(path, "INVALID_VALUE", "Numbers must be finite."),
      );
      return undefined;
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    errors.push(
      validationError(
        path,
        "INVALID_TYPE",
        "State must contain only JSON-compatible values.",
      ),
    );
    return undefined;
  }
  if (ancestors.has(value)) {
    errors.push(
      validationError(path, "INVALID_VALUE", "Cyclic state is not allowed."),
    );
    return undefined;
  }
  ancestors.add(value);

  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (budget.exhausted) break;
      const entry = value[index];
      const sanitized = sanitizeJsonValue(
        entry,
        `${path}[${index}]`,
        depth + 1,
        budget,
        errors,
        ancestors,
      );
      if (sanitized !== undefined) result.push(sanitized);
    }
    ancestors.delete(value);
    return result;
  }
  if (!isPlainObject(value)) {
    errors.push(
      validationError(path, "INVALID_TYPE", "State objects must be plain."),
    );
    ancestors.delete(value);
    return undefined;
  }

  const result: Record<string, JsonValue> = Object.create(null) as Record<
    string,
    JsonValue
  >;
  for (const key of Object.keys(value).sort()) {
    if (budget.exhausted) break;
    budget.characters += key.length;
    if (budget.characters > budget.maxCharacters) {
      budget.exhausted = true;
      errors.push(
        validationError(
          path,
          "LIMIT_EXCEEDED",
          `JSON state exceeds ${budget.maxCharacters} characters.`,
        ),
      );
      break;
    }
    if (UNSAFE_WORLD_STATE_KEYS.has(key)) {
      errors.push(
        validationError(
          `${path}.${key}`,
          "INVALID_VALUE",
          `Unsafe object key "${key}" is not allowed.`,
        ),
      );
      continue;
    }
    const sanitized = sanitizeJsonValue(
      value[key],
      `${path}.${key}`,
      depth + 1,
      budget,
      errors,
      ancestors,
    );
    if (sanitized !== undefined) result[key] = sanitized;
  }
  ancestors.delete(value);
  return result;
}

function readNonEmptyString(
  value: unknown,
  path: string,
  errors: SaveValidationIssue[],
  maxLength = WORLD_CORE_LIMITS.maxIdLength,
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    errors.push(
      validationError(
        path,
        "INVALID_VALUE",
        `Expected a non-empty string up to ${maxLength} characters.`,
      ),
    );
    return null;
  }
  return value;
}

function sanitizePlacedItem(
  value: unknown,
  index: number,
  registry: ItemRegistry | undefined,
  jsonBudget: JsonValidationBudget,
  errors: SaveValidationIssue[],
): PlacedItem | null {
  const path = `items[${index}]`;
  if (!isPlainObject(value)) {
    errors.push(
      validationError(path, "INVALID_TYPE", "Placed item must be an object."),
    );
    return null;
  }

  const instanceId = readNonEmptyString(
    value.instanceId,
    `${path}.instanceId`,
    errors,
  );
  const itemId = readNonEmptyString(
    value.itemId,
    `${path}.itemId`,
    errors,
  );
  if (
    !isPersistableGridPoint(value.position)
  ) {
    errors.push(
      validationError(
        `${path}.position`,
        "INVALID_VALUE",
        `Position must use safe integer coordinates within ±${WORLD_CORE_LIMITS.maxCoordinateMagnitude}.`,
      ),
    );
  }
  if (!isRotation(value.rotation)) {
    errors.push(
      validationError(
        `${path}.rotation`,
        "INVALID_VALUE",
        "Rotation must be 0, 90, 180, or 270.",
      ),
    );
  }
  if (
    value.variant !== undefined &&
    (typeof value.variant !== "string" ||
      value.variant.length > WORLD_CORE_LIMITS.maxVariantLength)
  ) {
    errors.push(
      validationError(
        `${path}.variant`,
        "INVALID_VALUE",
        `Variant must be a string up to ${WORLD_CORE_LIMITS.maxVariantLength} characters.`,
      ),
    );
  }
  if (
    itemId !== null &&
    registry &&
    getItemDefinition(registry, itemId) === undefined
  ) {
    errors.push(
      validationError(
        `${path}.itemId`,
        "UNKNOWN_ITEM",
        `Unknown item definition "${itemId}".`,
      ),
    );
  }

  let state: JsonObject | undefined;
  if (value.state !== undefined) {
    if (!isPlainObject(value.state)) {
      errors.push(
        validationError(
          `${path}.state`,
          "INVALID_TYPE",
          "Item state must be a JSON object.",
        ),
      );
    } else {
      const sanitized = sanitizeJsonValue(
        value.state,
        `${path}.state`,
        0,
        jsonBudget,
        errors,
        new Set(),
      );
      if (isPlainObject(sanitized)) {
        state = sanitized as JsonObject;
      }
    }
  }

  if (
    instanceId === null ||
    itemId === null ||
    !isPersistableGridPoint(value.position) ||
    !isRotation(value.rotation)
  ) {
    return null;
  }

  const result: {
    instanceId: string;
    itemId: string;
    position: { x: number; y: number };
    rotation: PlacedItem["rotation"];
    variant?: string;
    state?: JsonObject;
  } = {
    instanceId,
    itemId,
    position: { x: value.position.x, y: value.position.y },
    rotation: value.rotation,
  };
  if (typeof value.variant === "string") result.variant = value.variant;
  if (state !== undefined) result.state = state;
  return result;
}

export function parseWorldSave(
  input: string | unknown,
  options: WorldSaveParseOptions = {},
): WorldSaveParseResult {
  let parsed: unknown = input;
  const errors: SaveValidationIssue[] = [];
  const maxInputCharacters = normalizeLimit(
    options.maxInputCharacters,
    WORLD_CORE_LIMITS.maxSaveCharacters,
    "$options.maxInputCharacters",
    errors,
  );
  if (typeof input === "string") {
    if (input.length > maxInputCharacters) {
      errors.push(
        validationError(
          "$",
          "LIMIT_EXCEEDED",
          `Save input exceeds ${maxInputCharacters} characters.`,
        ),
      );
      return { ok: false, state: null, errors };
    }
    try {
      parsed = JSON.parse(input) as unknown;
    } catch {
      return {
        ok: false,
        state: null,
        errors: [
          ...errors,
          validationError(
            "$",
            "INVALID_JSON",
            "Save data is not valid JSON.",
          ),
        ],
      };
    }
  }
  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      state: null,
      errors: [
        validationError("$", "INVALID_TYPE", "Save root must be an object."),
      ],
    };
  }

  if (parsed.schemaVersion !== WORLD_SAVE_SCHEMA_VERSION) {
    errors.push(
      validationError(
        "schemaVersion",
        "UNSUPPORTED_VERSION",
        `Only save schema ${WORLD_SAVE_SCHEMA_VERSION} is supported.`,
      ),
    );
  }
  const worldId = readNonEmptyString(parsed.worldId, "worldId", errors);
  if (
    !Number.isSafeInteger(parsed.revision) ||
    (parsed.revision as number) < 0
  ) {
    errors.push(
      validationError(
        "revision",
        "INVALID_VALUE",
        "Revision must be a non-negative safe integer.",
      ),
    );
  }
  if (!Array.isArray(parsed.items)) {
    errors.push(
      validationError("items", "INVALID_TYPE", "Items must be an array."),
    );
  }

  const expectedWorldId = options.expectedWorldId ?? options.world?.id;
  if (
    worldId !== null &&
    expectedWorldId !== undefined &&
    worldId !== expectedWorldId
  ) {
    errors.push(
      validationError(
        "worldId",
        "WORLD_MISMATCH",
        `Save world "${worldId}" does not match "${expectedWorldId}".`,
      ),
    );
  }

  const maxItems = normalizeLimit(
    options.maxItems,
    WORLD_CORE_LIMITS.maxItems,
    "$options.maxItems",
    errors,
  );
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  if (rawItems.length > maxItems) {
    errors.push(
      validationError(
        "items",
        "LIMIT_EXCEEDED",
        `Save contains more than ${maxItems} placed items.`,
      ),
    );
  }

  const items: PlacedItem[] = [];
  const seenRawIds = new Set<string>();
  const jsonBudget: JsonValidationBudget = {
    nodes: 0,
    characters: 0,
    exhausted: false,
    maxNodes: normalizeLimit(
      options.maxJsonNodes,
      DEFAULT_WORLD_JSON_MAX_NODES,
      "$options.maxJsonNodes",
      errors,
    ),
    maxDepth: normalizeLimit(
      options.maxJsonDepth,
      DEFAULT_WORLD_JSON_MAX_DEPTH,
      "$options.maxJsonDepth",
      errors,
    ),
    maxCharacters: normalizeLimit(
      options.maxJsonCharacters,
      DEFAULT_WORLD_JSON_MAX_CHARACTERS,
      "$options.maxJsonCharacters",
      errors,
    ),
  };
  for (let index = 0; index < Math.min(rawItems.length, maxItems); index += 1) {
    const rawItem = rawItems[index];
    if (
      isPlainObject(rawItem) &&
      typeof rawItem.instanceId === "string" &&
      rawItem.instanceId.length > 0
    ) {
      if (seenRawIds.has(rawItem.instanceId)) {
        errors.push(
          validationError(
            `items[${index}].instanceId`,
            "DUPLICATE_INSTANCE",
            `Duplicate instance id "${rawItem.instanceId}".`,
          ),
        );
      }
      seenRawIds.add(rawItem.instanceId);
    }
    const item = sanitizePlacedItem(
      rawItem,
      index,
      options.registry,
      jsonBudget,
      errors,
    );
    if (item) items.push(item);
  }

  if (
    worldId !== null &&
    Number.isSafeInteger(parsed.revision) &&
    (parsed.revision as number) >= 0 &&
    parsed.schemaVersion === WORLD_SAVE_SCHEMA_VERSION &&
    options.world &&
    options.registry &&
    options.validatePlacements !== false
  ) {
    const candidateState: WorldState = {
      schemaVersion: 1,
      worldId,
      revision: parsed.revision as number,
      items,
    };
    items.forEach((item, index) => {
      const placement = validatePlacement(
        options.world!,
        candidateState,
        options.registry!,
        item,
        { ignoreInstanceId: item.instanceId },
      );
      placement.issues.forEach((issue) => {
        errors.push(
          validationError(
            `items[${index}]`,
            issue.code === "UNKNOWN_ITEM"
              ? "UNKNOWN_ITEM"
              : "INVALID_PLACEMENT",
            issue.message,
          ),
        );
      });
    });
  }

  if (
    errors.length > 0 ||
    worldId === null ||
    !Number.isSafeInteger(parsed.revision) ||
    (parsed.revision as number) < 0 ||
    parsed.schemaVersion !== WORLD_SAVE_SCHEMA_VERSION ||
    !Array.isArray(parsed.items)
  ) {
    return { ok: false, state: null, errors };
  }

  return {
    ok: true,
    state: freezeWorldState(worldId, parsed.revision as number, items, {
      maxItems,
      maxJsonNodes: jsonBudget.maxNodes,
      maxJsonDepth: jsonBudget.maxDepth,
      maxJsonCharacters: jsonBudget.maxCharacters,
    }),
    errors: [],
  };
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return (value as readonly JsonValue[]).map(sortJsonValue);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    const objectValue = value as Readonly<Record<string, JsonValue>>;
    for (const key of Object.keys(objectValue).sort()) {
      const entry = objectValue[key];
      if (entry !== undefined) result[key] = sortJsonValue(entry);
    }
    return result;
  }
  return value;
}

/**
 * Canonical save serialization: item order and nested state keys are stable,
 * which keeps snapshots, replay hashes, and cloud conflict checks deterministic.
 */
export function serializeWorldState(state: WorldState): string {
  const validation = parseWorldSave(state, { validatePlacements: false });
  if (!validation.ok) {
    const detail = validation.errors
      .map((error) => `${error.path}: ${error.message}`)
      .join("; ");
    throw new TypeError(`Cannot serialize invalid world state: ${detail}`);
  }

  const canonical = {
    schemaVersion: 1,
    worldId: validation.state.worldId,
    revision: validation.state.revision,
    items: validation.state.items.map((item) => {
      const result: Record<string, unknown> = {
        instanceId: item.instanceId,
        itemId: item.itemId,
        position: { x: item.position.x, y: item.position.y },
        rotation: item.rotation,
      };
      if (item.variant !== undefined) result.variant = item.variant;
      if (item.state !== undefined) result.state = sortJsonValue(item.state);
      return result;
    }),
  };
  return JSON.stringify(canonical);
}
