import { getPlacedItemCollision } from "./footprints";
import {
  cardinalNeighbors,
  gridCellKey,
  gridPointEquals,
  isGridPoint,
  manhattanDistance,
} from "./projection";
import { getCellInfo, getWorldCells } from "./zones";
import type {
  GridPoint,
  ItemRegistry,
  WalkabilityOptions,
  WorldDefinition,
  WorldState,
} from "./types";

export function getOccupiedCollisionCells(
  state: WorldState,
  registry: ItemRegistry,
  options: Pick<WalkabilityOptions, "ignoreInstanceId"> = {},
): ReadonlySet<string> {
  const occupied = new Set<string>();
  for (const item of state.items) {
    if (item.instanceId === options.ignoreInstanceId) {
      continue;
    }
    for (const cell of getPlacedItemCollision(item, registry)) {
      occupied.add(gridCellKey(cell));
    }
  }
  return occupied;
}

export function isCellWalkable(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  point: GridPoint,
  options: Pick<WalkabilityOptions, "ignoreInstanceId"> = {},
): boolean {
  if (state.worldId !== world.id) {
    return false;
  }
  if (!isGridPoint(point)) {
    return false;
  }
  if (!getCellInfo(world, point).walkable) {
    return false;
  }
  return !getOccupiedCollisionCells(state, registry, options).has(
    gridCellKey(point),
  );
}

export function isFootprintWalkable(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  cells: readonly GridPoint[],
  options: Pick<WalkabilityOptions, "ignoreInstanceId"> = {},
): boolean {
  if (state.worldId !== world.id) {
    return false;
  }
  if (cells.length === 0 || cells.some((cell) => !isGridPoint(cell))) {
    return false;
  }
  const occupied = getOccupiedCollisionCells(state, registry, options);
  return cells.every(
    (cell) =>
      getCellInfo(world, cell).walkable &&
      !occupied.has(gridCellKey(cell)),
  );
}

/**
 * Deterministic four-way breadth-first search. Equal-length routes prefer
 * north, east, south, then west so replays and save restores choose the same
 * path on every renderer and browser.
 */
export function findPath(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  start: GridPoint,
  goal: GridPoint,
  options: WalkabilityOptions = {},
): readonly GridPoint[] | null {
  if (state.worldId !== world.id) {
    return null;
  }
  if (!isGridPoint(start) || !isGridPoint(goal)) {
    return null;
  }
  const startInfo = getCellInfo(world, start);
  const goalInfo = getCellInfo(world, goal);
  if (!startInfo.walkable || !goalInfo.walkable) {
    return null;
  }
  const occupied = getOccupiedCollisionCells(state, registry, options);
  const startKey = gridCellKey(start);
  const goalKey = gridCellKey(goal);
  const sameCell = gridPointEquals(start, goal);
  if (occupied.has(startKey) && !(sameCell && options.allowGoalOccupied)) {
    return null;
  }
  if (occupied.has(goalKey) && !options.allowGoalOccupied) {
    return null;
  }
  if (sameCell) {
    return [{ x: start.x, y: start.y }];
  }

  const worldCellCount = getWorldCells(world).length;
  if (
    options.maxVisited !== undefined &&
    (!Number.isSafeInteger(options.maxVisited) || options.maxVisited < 1)
  ) {
    return null;
  }
  const maxVisited = Math.min(
    options.maxVisited ?? worldCellCount,
    Math.max(worldCellCount, 1),
  );
  const startPoint: GridPoint = { x: start.x, y: start.y };
  const queue: GridPoint[] = [startPoint];
  const previous = new Map<string, string | null>([[startKey, null]]);
  const points = new Map<string, GridPoint>([[startKey, startPoint]]);

  let cursor = 0;
  while (cursor < queue.length && previous.size <= maxVisited) {
    const current = queue[cursor];
    if (current === undefined) break;
    cursor += 1;

    for (const neighbor of cardinalNeighbors(current)) {
      const neighborKey = gridCellKey(neighbor);
      if (previous.has(neighborKey)) {
        continue;
      }
      const isGoal = neighborKey === goalKey;
      if (!getCellInfo(world, neighbor).walkable) {
        continue;
      }
      if (occupied.has(neighborKey) && !(isGoal && options.allowGoalOccupied)) {
        continue;
      }
      if (previous.size >= maxVisited) {
        return null;
      }

      previous.set(neighborKey, gridCellKey(current));
      points.set(neighborKey, neighbor);
      if (isGoal) {
        const path: GridPoint[] = [];
        let key: string | null = neighborKey;
        while (key !== null) {
          const point = points.get(key);
          if (!point) return null;
          path.push({ x: point.x, y: point.y });
          key = previous.get(key) ?? null;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }

  return null;
}

export function findNearestWalkableCell(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  origin: GridPoint,
  options: Pick<WalkabilityOptions, "ignoreInstanceId"> = {},
): GridPoint | null {
  if (state.worldId !== world.id) {
    return null;
  }
  if (!isGridPoint(origin)) {
    return null;
  }
  const occupied = getOccupiedCollisionCells(state, registry, options);
  const walkable = getWorldCells(world).filter(
    (cell) =>
      getCellInfo(world, cell).walkable &&
      !occupied.has(gridCellKey(cell)),
  );
  walkable.sort(
    (a, b) =>
      manhattanDistance(origin, a) - manhattanDistance(origin, b) ||
      a.y - b.y ||
      a.x - b.x,
  );
  return walkable[0] ?? null;
}
