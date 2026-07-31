import {
  compareGridPoints,
  compareStableStrings,
  gridCellKey,
  isGridPoint,
} from "./projection";
import type {
  CellInfo,
  DefinitionIssue,
  GridPoint,
  WorldBounds,
  WorldDefinition,
  ZoneDefinition,
  ZoneShape,
} from "./types";
import {
  WORLD_CORE_LIMITS,
  isBoundedId,
  isPersistableGridPoint,
} from "./limits";

export const MAX_ZONE_CELL_COUNT = 250_000;
export const MAX_WORLD_CELL_COUNT = 1_000_000;

function isSafeRect(shape: unknown): shape is {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  if (typeof shape !== "object" || shape === null || Array.isArray(shape)) {
    return false;
  }
  const candidate = shape as Record<string, unknown>;
  if (
    !Number.isSafeInteger(candidate.x) ||
    !Number.isSafeInteger(candidate.y) ||
    !Number.isSafeInteger(candidate.width) ||
    !Number.isSafeInteger(candidate.height) ||
    (candidate.width as number) <= 0 ||
    (candidate.height as number) <= 0
  ) {
    return false;
  }
  const x = candidate.x as number;
  const y = candidate.y as number;
  const width = candidate.width as number;
  const height = candidate.height as number;
  return (
    Number.isSafeInteger(x + width - 1) &&
    Number.isSafeInteger(y + height - 1) &&
    Math.abs(x) <= WORLD_CORE_LIMITS.maxCoordinateMagnitude &&
    Math.abs(y) <= WORLD_CORE_LIMITS.maxCoordinateMagnitude &&
    Math.abs(x + width - 1) <=
      WORLD_CORE_LIMITS.maxCoordinateMagnitude &&
    Math.abs(y + height - 1) <=
      WORLD_CORE_LIMITS.maxCoordinateMagnitude &&
    Number.isSafeInteger(width * height) &&
    width * height <= MAX_ZONE_CELL_COUNT
  );
}

export function shapeContainsCell(
  shape: ZoneShape,
  point: GridPoint,
): boolean {
  if (!isGridPoint(point)) return false;
  if (shape.type === "rect") {
    if (!isSafeRect(shape)) return false;
    return (
      point.x >= shape.x &&
      point.y >= shape.y &&
      point.x < shape.x + shape.width &&
      point.y < shape.y + shape.height
    );
  }

  return shape.cells.some(
    (cell) => cell.x === point.x && cell.y === point.y,
  );
}

export function getShapeCells(shape: ZoneShape): readonly GridPoint[] {
  if (shape.type === "cells") {
    if (
      shape.cells.length > MAX_ZONE_CELL_COUNT ||
      shape.cells.some((cell) => !isPersistableGridPoint(cell))
    ) {
      throw new RangeError(
        `Cell zone must contain at most ${MAX_ZONE_CELL_COUNT} safe integer cells.`,
      );
    }
    const unique = new Map<string, GridPoint>();
    for (const cell of shape.cells) {
      unique.set(gridCellKey(cell), { x: cell.x, y: cell.y });
    }
    return [...unique.values()].sort(compareGridPoints);
  }

  if (!isSafeRect(shape)) {
    throw new RangeError(
      `Rectangle zone must have safe endpoints and at most ${MAX_ZONE_CELL_COUNT} cells.`,
    );
  }
  const cells: GridPoint[] = [];
  for (let y = shape.y; y < shape.y + shape.height; y += 1) {
    for (let x = shape.x; x < shape.x + shape.width; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

function compareZones(a: ZoneDefinition, b: ZoneDefinition): number {
  return (
    (b.priority ?? 0) - (a.priority ?? 0) ||
    compareStableStrings(a.id, b.id)
  );
}

export function getZonesAt(
  world: WorldDefinition,
  point: GridPoint,
): readonly ZoneDefinition[] {
  return world.zones
    .filter((zone) => shapeContainsCell(zone.shape, point))
    .sort(compareZones);
}

/**
 * When zones overlap, the highest explicit priority wins; equal priorities are
 * resolved by zone id. This makes results independent of array insertion order.
 */
export function getZoneAt(
  world: WorldDefinition,
  point: GridPoint,
): ZoneDefinition | null {
  return getZonesAt(world, point)[0] ?? null;
}

export function isInsideWorld(
  world: WorldDefinition,
  point: GridPoint,
): boolean {
  return getZoneAt(world, point) !== null;
}

function findOverride(world: WorldDefinition, point: GridPoint) {
  return world.cellOverrides?.find(
    (entry) =>
      entry.position.x === point.x && entry.position.y === point.y,
  );
}

function containsPoint(
  cells: readonly GridPoint[] | undefined,
  point: GridPoint,
): boolean {
  return (
    cells?.some((cell) => cell.x === point.x && cell.y === point.y) ?? false
  );
}

export function getCellInfo(
  world: WorldDefinition,
  point: GridPoint,
): CellInfo {
  const zone = getZoneAt(world, point);
  if (zone === null) {
    return {
      position: { x: point.x, y: point.y },
      zone: null,
      surface: null,
      tags: [],
      walkable: false,
      placeable: false,
    };
  }

  const override = findOverride(world, point);
  const staticallyBlocked = containsPoint(world.blockedCells, point);
  const reserved = containsPoint(world.reservedCells, point);

  return {
    position: { x: point.x, y: point.y },
    zone,
    surface: override?.surface ?? zone.surface ?? null,
    tags: zone.tags ?? [],
    walkable:
      !staticallyBlocked && (override?.walkable ?? zone.walkable ?? true),
    placeable:
      !staticallyBlocked &&
      !reserved &&
      (override?.placeable ?? zone.placeable ?? true),
  };
}

export function getWorldCells(
  world: WorldDefinition,
): readonly GridPoint[] {
  const cells = new Map<string, GridPoint>();
  for (const zone of world.zones) {
    for (const cell of getShapeCells(zone.shape)) {
      cells.set(gridCellKey(cell), cell);
      if (cells.size > MAX_WORLD_CELL_COUNT) {
        throw new RangeError(
          `World exceeds the ${MAX_WORLD_CELL_COUNT}-cell safety limit.`,
        );
      }
    }
  }
  return [...cells.values()].sort(compareGridPoints);
}

export function getWorldBounds(
  world: WorldDefinition,
): WorldBounds | null {
  const cells = getWorldCells(world);
  const first = cells[0];
  if (first === undefined) {
    return null;
  }

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;

  for (const cell of cells.slice(1)) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateShape(shape: unknown, path: string): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  if (typeof shape !== "object" || shape === null || Array.isArray(shape)) {
    return [{ path, message: "Zone shape must be an object." }];
  }

  const candidate = shape as Record<string, unknown>;
  if (candidate.type === "rect") {
    if (
      !Number.isSafeInteger(candidate.x) ||
      !Number.isSafeInteger(candidate.y)
    ) {
      issues.push({
        path,
        message: "Rectangle origins must be safe integers.",
      });
    }
    if (
      !Number.isSafeInteger(candidate.width) ||
      (candidate.width as number) <= 0 ||
      !Number.isSafeInteger(candidate.height) ||
      (candidate.height as number) <= 0
    ) {
      issues.push({
        path,
        message: "Rectangle width and height must be positive integers.",
      });
    } else if (!isSafeRect(candidate)) {
      issues.push({
        path,
        message: `Rectangle endpoints must be safe and area may not exceed ${MAX_ZONE_CELL_COUNT} cells.`,
      });
    }
  } else if (candidate.type === "cells") {
    if (
      !Array.isArray(candidate.cells) ||
      candidate.cells.length === 0 ||
      candidate.cells.some((cell) => !isPersistableGridPoint(cell))
    ) {
      issues.push({
        path,
        message: "Cell shapes need at least one valid integer grid cell.",
      });
    } else if (candidate.cells.length > MAX_ZONE_CELL_COUNT) {
      issues.push({
        path,
        message: `Cell shapes may not exceed ${MAX_ZONE_CELL_COUNT} cells.`,
      });
    } else {
      const keys = new Set((candidate.cells as GridPoint[]).map(gridCellKey));
      if (keys.size !== candidate.cells.length) {
        issues.push({
          path,
          message: "Cell shapes may not contain duplicate cells.",
        });
      }
    }
  } else {
    issues.push({
      path,
      message: 'Zone shape type must be "rect" or "cells".',
    });
  }
  return issues;
}

export function validateWorldDefinition(
  input: unknown,
): readonly DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return [{ path: "$", message: "World definition must be an object." }];
  }
  const world = input as WorldDefinition;
  if (world.schemaVersion !== 1) {
    issues.push({
      path: "schemaVersion",
      message: "Only world schema version 1 is supported.",
    });
  }
  if (!isBoundedId(world.id)) {
    issues.push({
      path: "id",
      message: `World id must be a non-empty string up to ${WORLD_CORE_LIMITS.maxIdLength} characters.`,
    });
  }
  if (!Array.isArray(world.zones) || world.zones.length === 0) {
    issues.push({
      path: "zones",
      message: "A world must contain at least one zone.",
    });
    return issues;
  }

  const zoneIds = new Set<string>();
  let declaredCellCount = 0;
  world.zones.forEach((rawZone: unknown, index) => {
    const path = `zones[${index}]`;
    if (
      typeof rawZone !== "object" ||
      rawZone === null ||
      Array.isArray(rawZone)
    ) {
      issues.push({ path, message: "Zone definition must be an object." });
      return;
    }
    const zone = rawZone as ZoneDefinition;
    if (!isNonEmptyString(zone.id)) {
      issues.push({ path: `${path}.id`, message: "Zone id is required." });
    } else if (zoneIds.has(zone.id)) {
      issues.push({
        path: `${path}.id`,
        message: `Duplicate zone id "${zone.id}".`,
      });
    } else {
      zoneIds.add(zone.id);
    }
    if (!isNonEmptyString(zone.kind)) {
      issues.push({ path: `${path}.kind`, message: "Zone kind is required." });
    }
    if (
      zone.surface !== undefined &&
      !isNonEmptyString(zone.surface)
    ) {
      issues.push({
        path: `${path}.surface`,
        message: "Zone surface must be a non-empty string.",
      });
    }
    if (
      zone.tags !== undefined &&
      (!Array.isArray(zone.tags) ||
        zone.tags.some((tag) => !isNonEmptyString(tag)))
    ) {
      issues.push({
        path: `${path}.tags`,
        message: "Zone tags must be non-empty strings.",
      });
    }
    for (const booleanKey of ["walkable", "placeable"] as const) {
      if (
        zone[booleanKey] !== undefined &&
        typeof zone[booleanKey] !== "boolean"
      ) {
        issues.push({
          path: `${path}.${booleanKey}`,
          message: "Expected a boolean.",
        });
      }
    }
    issues.push(...validateShape(zone.shape, `${path}.shape`));
    const shape = zone.shape as unknown;
    if (typeof shape === "object" && shape !== null && !Array.isArray(shape)) {
      const shapeRecord = shape as Record<string, unknown>;
      if (shapeRecord.type === "rect" && isSafeRect(shapeRecord)) {
        declaredCellCount += shapeRecord.width * shapeRecord.height;
      } else if (
        shapeRecord.type === "cells" &&
        Array.isArray(shapeRecord.cells)
      ) {
        declaredCellCount += shapeRecord.cells.length;
      }
    }
    if (
      zone.priority !== undefined &&
      !Number.isSafeInteger(zone.priority)
    ) {
      issues.push({
        path: `${path}.priority`,
        message: "Zone priority must be a safe integer.",
      });
    }
  });
  if (declaredCellCount > MAX_WORLD_CELL_COUNT) {
    issues.push({
      path: "zones",
      message: `Declared zone cells may not exceed ${MAX_WORLD_CELL_COUNT} in one world.`,
    });
  }

  const validateCellList = (
    cells: unknown,
    path: string,
  ) => {
    if (cells === undefined) return;
    if (!Array.isArray(cells)) {
      issues.push({ path, message: "Expected an array of grid points." });
      return;
    }
    const keys = new Set<string>();
    cells.forEach((cell, index) => {
      if (!isPersistableGridPoint(cell)) {
        issues.push({
          path: `${path}[${index}]`,
          message: "Expected an integer grid point.",
        });
        return;
      }
      const key = gridCellKey(cell);
      if (keys.has(key)) {
        issues.push({
          path: `${path}[${index}]`,
          message: `Duplicate cell ${key}.`,
        });
      }
      keys.add(key);
    });
  };

  validateCellList(world.blockedCells, "blockedCells");
  validateCellList(world.reservedCells, "reservedCells");

  if (
    world.cellOverrides !== undefined &&
    !Array.isArray(world.cellOverrides)
  ) {
    issues.push({
      path: "cellOverrides",
      message: "Expected an array of cell overrides.",
    });
  } else {
    const overrideKeys = new Set<string>();
    world.cellOverrides?.forEach((override, index) => {
      if (
        typeof override !== "object" ||
        override === null ||
        Array.isArray(override) ||
        !isPersistableGridPoint(override.position)
      ) {
        issues.push({
          path: `cellOverrides[${index}].position`,
          message: "Expected an integer grid point.",
        });
      } else {
        const key = gridCellKey(override.position);
        if (overrideKeys.has(key)) {
          issues.push({
            path: `cellOverrides[${index}].position`,
            message: `Duplicate cell override ${key}.`,
          });
        }
        overrideKeys.add(key);
        if (
          override.surface !== undefined &&
          !isNonEmptyString(override.surface)
        ) {
          issues.push({
            path: `cellOverrides[${index}].surface`,
            message: "Override surface must be a non-empty string.",
          });
        }
        for (const booleanKey of ["walkable", "placeable"] as const) {
          if (
            override[booleanKey] !== undefined &&
            typeof override[booleanKey] !== "boolean"
          ) {
            issues.push({
              path: `cellOverrides[${index}].${booleanKey}`,
              message: "Expected a boolean.",
            });
          }
        }
      }
    });
  }

  return issues;
}
