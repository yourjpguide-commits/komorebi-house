import {
  addGridPoints,
  compareGridPoints,
  gridCellKey,
  rotateOffset,
} from "./projection";
import type {
  DefinitionIssue,
  GridPoint,
  ItemDefinition,
  ItemRegistry,
  PlacedItem,
  Rotation,
} from "./types";
import {
  WORLD_CORE_LIMITS,
  isBoundedId,
  isPersistableGridPoint,
} from "./limits";

export const MAX_ITEM_FOOTPRINT_CELLS = 1_024;

function uniqueSortedCells(cells: readonly GridPoint[]): readonly GridPoint[] {
  const unique = new Map<string, GridPoint>();
  for (const cell of cells) {
    unique.set(gridCellKey(cell), cell);
  }
  return [...unique.values()].sort(compareGridPoints);
}

export function getItemDefinition(
  registry: ItemRegistry,
  itemId: string,
): ItemDefinition | undefined {
  return Object.prototype.hasOwnProperty.call(registry, itemId)
    ? registry[itemId]
    : undefined;
}

export function getRotatedOffsets(
  offsets: readonly GridPoint[],
  rotation: Rotation,
): readonly GridPoint[] {
  return uniqueSortedCells(
    offsets.map((offset) => rotateOffset(offset, rotation)),
  );
}

export function getFootprintCells(
  definition: ItemDefinition,
  position: GridPoint,
  rotation: Rotation,
): readonly GridPoint[] {
  return getRotatedOffsets(definition.footprint, rotation).map((offset) =>
    addGridPoints(position, offset),
  );
}

export function getPlacedItemFootprint(
  item: PlacedItem,
  registry: ItemRegistry,
): readonly GridPoint[] {
  const definition = getItemDefinition(registry, item.itemId);
  return definition
    ? getFootprintCells(definition, item.position, item.rotation)
    : [{ x: item.position.x, y: item.position.y }];
}

export function getCollisionCells(
  definition: ItemDefinition,
  position: GridPoint,
  rotation: Rotation,
): readonly GridPoint[] {
  if (definition.blocksMovement === false) {
    return [];
  }
  const offsets = definition.collision ?? definition.footprint;
  return getRotatedOffsets(offsets, rotation).map((offset) =>
    addGridPoints(position, offset),
  );
}

export function getPlacedItemCollision(
  item: PlacedItem,
  registry: ItemRegistry,
): readonly GridPoint[] {
  const definition = getItemDefinition(registry, item.itemId);
  return definition
    ? getCollisionCells(definition, item.position, item.rotation)
    : [{ x: item.position.x, y: item.position.y }];
}

export function cellsOverlap(
  first: readonly GridPoint[],
  second: readonly GridPoint[],
): boolean {
  const firstKeys = new Set(first.map(gridCellKey));
  return second.some((cell) => firstKeys.has(gridCellKey(cell)));
}

export function intersectCells(
  first: readonly GridPoint[],
  second: readonly GridPoint[],
): readonly GridPoint[] {
  const firstKeys = new Set(first.map(gridCellKey));
  return uniqueSortedCells(
    second.filter((cell) => firstKeys.has(gridCellKey(cell))),
  );
}

function validateStringList(
  value: readonly string[] | undefined,
  path: string,
  issues: DefinitionIssue[],
) {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      value.some((entry) => typeof entry !== "string" || entry.length === 0))
  ) {
    issues.push({
      path,
      message: "Expected an array of non-empty strings.",
    });
  }
}

export function validateItemRegistry(
  input: unknown,
): readonly DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return [{ path: "$", message: "Item registry must be an object." }];
  }
  const registry = input as ItemRegistry;

  for (const [key, definition] of Object.entries(registry)) {
    const path = `items.${key}`;
    if (
      typeof definition !== "object" ||
      definition === null ||
      Array.isArray(definition)
    ) {
      issues.push({ path, message: "Item definition must be an object." });
      continue;
    }
    if (!isBoundedId(key) || !isBoundedId(definition.id)) {
      issues.push({
        path: `${path}.id`,
        message: `Item ids must be non-empty strings up to ${WORLD_CORE_LIMITS.maxIdLength} characters.`,
      });
    } else if (definition.id !== key) {
      issues.push({
        path: `${path}.id`,
        message: `Registry key "${key}" must match item id "${definition.id}".`,
      });
    }
    if (
      !Array.isArray(definition.footprint) ||
      definition.footprint.length === 0 ||
      definition.footprint.length > MAX_ITEM_FOOTPRINT_CELLS ||
      definition.footprint.some((cell) => !isPersistableGridPoint(cell))
    ) {
      issues.push({
        path: `${path}.footprint`,
        message: `Footprint needs 1-${MAX_ITEM_FOOTPRINT_CELLS} valid integer grid offsets.`,
      });
    } else if (
      new Set(definition.footprint.map(gridCellKey)).size !==
      definition.footprint.length
    ) {
      issues.push({
        path: `${path}.footprint`,
        message: "Footprint offsets must be unique.",
      });
    }
    if (
      definition.collision !== undefined &&
      (!Array.isArray(definition.collision) ||
        definition.collision.length > MAX_ITEM_FOOTPRINT_CELLS ||
        definition.collision.some((cell) => !isPersistableGridPoint(cell)))
    ) {
      issues.push({
        path: `${path}.collision`,
        message: "Collision offsets must be integer grid points.",
      });
    }
    validateStringList(
      definition.allowedZoneIds,
      `${path}.allowedZoneIds`,
      issues,
    );
    validateStringList(
      definition.allowedZoneKinds,
      `${path}.allowedZoneKinds`,
      issues,
    );
    validateStringList(
      definition.allowedSurfaces,
      `${path}.allowedSurfaces`,
      issues,
    );
    validateStringList(definition.tags, `${path}.tags`, issues);
    if (
      definition.placementLayer !== undefined &&
      (typeof definition.placementLayer !== "string" ||
        definition.placementLayer.trim().length === 0)
    ) {
      issues.push({
        path: `${path}.placementLayer`,
        message: "Placement layer must be a non-empty string.",
      });
    }
    for (const booleanKey of [
      "blocksPlacement",
      "blocksMovement",
      "rotatable",
      "unique",
    ] as const) {
      if (
        definition[booleanKey] !== undefined &&
        typeof definition[booleanKey] !== "boolean"
      ) {
        issues.push({
          path: `${path}.${booleanKey}`,
          message: "Expected a boolean.",
        });
      }
    }
    if (
      definition.renderBand !== undefined &&
      !Number.isFinite(definition.renderBand)
    ) {
      issues.push({
        path: `${path}.renderBand`,
        message: "Render band must be finite.",
      });
    }
    if (
      definition.depthOffset !== undefined &&
      !Number.isFinite(definition.depthOffset)
    ) {
      issues.push({
        path: `${path}.depthOffset`,
        message: "Depth offset must be finite.",
      });
    }
  }

  return issues;
}
