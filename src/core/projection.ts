import type {
  CardinalDirection,
  GridCoordinate,
  GridPoint,
  ProjectionConfig,
  Rotation,
  ScreenPoint,
} from "./types";

export const DEFAULT_PROJECTION: ProjectionConfig = Object.freeze({
  tileWidth: 32,
  tileHeight: 16,
  originX: 0,
  originY: 0,
  elevationHeight: 16,
});

export function isValidProjectionConfig(
  projection: ProjectionConfig,
): boolean {
  return (
    Number.isFinite(projection.tileWidth) &&
    projection.tileWidth > 0 &&
    Number.isFinite(projection.tileHeight) &&
    projection.tileHeight > 0 &&
    Number.isFinite(projection.originX) &&
    Number.isFinite(projection.originY) &&
    Number.isFinite(projection.elevationHeight) &&
    projection.elevationHeight >= 0
  );
}

function assertProjectionInput(
  point: ScreenPoint | GridPoint,
  projection: ProjectionConfig,
  elevation: number,
): void {
  if (!isValidProjectionConfig(projection)) {
    throw new RangeError(
      "Projection needs positive finite tile dimensions, finite origins, and a non-negative finite elevation height.",
    );
  }
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(elevation)
  ) {
    throw new RangeError("Projection coordinates and elevation must be finite.");
  }
}

export function isGridPoint(value: unknown): value is GridPoint {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const point = value as Record<string, unknown>;
  return Number.isSafeInteger(point.x) && Number.isSafeInteger(point.y);
}

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

export function normalizeRotation(degrees: number): Rotation {
  if (!Number.isFinite(degrees)) {
    return 0;
  }

  const quarterTurns = Math.round(degrees / 90);
  const normalized = ((quarterTurns % 4) + 4) % 4;
  return (normalized * 90) as Rotation;
}

export function rotateOffset(point: GridPoint, rotation: Rotation): GridPoint {
  switch (rotation) {
    case 0:
      return { x: point.x, y: point.y };
    case 90:
      return { x: -point.y, y: point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: point.y, y: -point.x };
  }
}

export function rotationToDirection(rotation: Rotation): CardinalDirection {
  switch (rotation) {
    case 0:
      return "north";
    case 90:
      return "east";
    case 180:
      return "south";
    case 270:
      return "west";
  }
}

export function directionToRotation(direction: CardinalDirection): Rotation {
  switch (direction) {
    case "north":
      return 0;
    case "east":
      return 90;
    case "south":
      return 180;
    case "west":
      return 270;
  }
}

export function gridToScreen(
  point: GridCoordinate,
  projection: ProjectionConfig = DEFAULT_PROJECTION,
  elevation = 0,
): ScreenPoint {
  assertProjectionInput(point, projection, elevation);
  const halfWidth = projection.tileWidth / 2;
  const halfHeight = projection.tileHeight / 2;

  return {
    x: projection.originX + (point.x - point.y) * halfWidth,
    y:
      projection.originY +
      (point.x + point.y) * halfHeight -
      elevation * projection.elevationHeight,
  };
}

/**
 * Returns fractional grid coordinates. Use screenToNearestGrid when selecting
 * a discrete contact cell.
 */
export function screenToGrid(
  point: ScreenPoint,
  projection: ProjectionConfig = DEFAULT_PROJECTION,
  elevation = 0,
): GridCoordinate {
  assertProjectionInput(point, projection, elevation);
  const dx = point.x - projection.originX;
  const dy =
    point.y -
    projection.originY +
    elevation * projection.elevationHeight;

  return {
    x: dx / projection.tileWidth + dy / projection.tileHeight,
    y: dy / projection.tileHeight - dx / projection.tileWidth,
  };
}

function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function screenToNearestGrid(
  point: ScreenPoint,
  projection: ProjectionConfig = DEFAULT_PROJECTION,
  elevation = 0,
): GridPoint {
  const grid = screenToGrid(point, projection, elevation);
  return {
    x: roundHalfAwayFromZero(grid.x),
    y: roundHalfAwayFromZero(grid.y),
  };
}

export function addGridPoints(a: GridPoint, b: GridPoint): GridPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractGridPoints(a: GridPoint, b: GridPoint): GridPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function gridPointEquals(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function gridCellKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

export function compareGridPoints(a: GridPoint, b: GridPoint): number {
  return a.y - b.y || a.x - b.x;
}

/**
 * Locale-independent UTF-16 ordering for stable saves and replay results.
 * localeCompare is intentionally avoided because ICU data differs by runtime.
 */
export function compareStableStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function manhattanDistance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Stable north, east, south, west order for deterministic path searches. */
export function cardinalNeighbors(point: GridPoint): readonly GridPoint[] {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ];
}
