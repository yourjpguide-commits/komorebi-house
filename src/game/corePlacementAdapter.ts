import {
  validatePlacement,
  type GridPoint,
  type ItemDefinition as CoreItemDefinition,
  type ItemRegistry,
  type PlacedItem,
  type PlacementValidation,
  type Rotation,
  type WorldDefinition,
  type WorldState,
} from '../core';
import { WORLD_GRID } from './constants';
import { SCENE_DECOR_CATALOG } from './catalogAdapter';
import type {
  DecorDefinition,
  LocationBlueprint,
  PlacedDecor,
} from './types';

function pixelToGrid(value: number): number {
  return Math.round(value / WORLD_GRID);
}

function cellsForRect(
  x: number,
  y: number,
  width: number,
  height: number,
): GridPoint[] {
  const startX = Math.floor(x / WORLD_GRID);
  const startY = Math.floor(y / WORLD_GRID);
  const endX = Math.ceil((x + width) / WORLD_GRID);
  const endY = Math.ceil((y + height) / WORLD_GRID);
  const cells: GridPoint[] = [];
  for (let gridY = startY; gridY < endY; gridY += 1) {
    for (let gridX = startX; gridX < endX; gridX += 1) {
      cells.push({ x: gridX, y: gridY });
    }
  }
  return cells;
}

function footprintOffsets(definition: DecorDefinition): GridPoint[] {
  const width = Math.max(1, Math.ceil(definition.footprint.width / WORLD_GRID));
  const height = Math.max(1, Math.ceil(definition.footprint.height / WORLD_GRID));
  const left = -Math.floor(width / 2);
  const top = -(height - 1);
  const cells: GridPoint[] = [];
  for (let y = top; y <= 0; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

export function placementLayerForDecor(
  definition: DecorDefinition | undefined,
): string {
  if (!definition) return 'object';
  const isFloorLayer = definition.category === 'soft';
  const isTabletop =
    definition.category === 'tabletop' ||
    definition.placementSurface === 'tabletop';
  return isFloorLayer ? 'floor' : isTabletop ? 'tabletop' : 'object';
}

function toCoreItemDefinition(definition: DecorDefinition): CoreItemDefinition {
  const placementLayer = placementLayerForDecor(definition);
  return {
    id: definition.id,
    footprint: footprintOffsets(definition),
    allowedZoneKinds: definition.locations,
    placementLayer,
    blocksPlacement: true,
    blocksMovement: placementLayer === 'object',
    rotatable: true,
  };
}

const CORE_ITEM_REGISTRY: ItemRegistry = Object.fromEntries(
  SCENE_DECOR_CATALOG.map((definition) => [
    definition.id,
    toCoreItemDefinition(definition),
  ]),
);

function buildWorldDefinition(blueprint: LocationBlueprint): WorldDefinition {
  const fullWidth = Math.ceil(blueprint.bounds.width / WORLD_GRID);
  const fullHeight = Math.ceil(blueprint.bounds.height / WORLD_GRID);
  const placeableZones = blueprint.placementAreas.map((area, index) => ({
    id: `${blueprint.id}:placement:${index}`,
    kind: blueprint.id,
    shape: {
      type: 'rect' as const,
      x: Math.ceil(area.x / WORLD_GRID),
      y: Math.ceil(area.y / WORLD_GRID),
      width: Math.max(1, Math.floor(area.width / WORLD_GRID)),
      height: Math.max(1, Math.floor(area.height / WORLD_GRID)),
    },
    surface: blueprint.surface,
    walkable: true,
    placeable: true,
    priority: 10,
  }));

  return {
    schemaVersion: 1,
    id: `komorebi:${blueprint.id}`,
    zones: [
      {
        id: `${blueprint.id}:world`,
        kind: blueprint.id,
        shape: {
          type: 'rect',
          x: 0,
          y: 0,
          width: fullWidth,
          height: fullHeight,
        },
        surface: blueprint.surface,
        walkable: true,
        placeable: false,
        priority: 0,
      },
      ...placeableZones,
    ],
    blockedCells: blueprint.obstacles.flatMap((obstacle) =>
      cellsForRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
      ),
    ),
    reservedCells: blueprint.portals.flatMap((portal) =>
      cellsForRect(portal.x, portal.y, portal.width, portal.height),
    ),
  };
}

function buildWorldState(
  blueprint: LocationBlueprint,
  placements: readonly PlacedDecor[],
): WorldState {
  return {
    schemaVersion: 1,
    worldId: `komorebi:${blueprint.id}`,
    revision: 0,
    items: placements
      .filter(
        (placement) =>
          placement.location === blueprint.id &&
          CORE_ITEM_REGISTRY[placement.itemId] !== undefined,
      )
      .map(
        (placement): PlacedItem => ({
          instanceId: placement.instanceId,
          itemId: placement.itemId,
          position: {
            x: pixelToGrid(placement.x),
            y: pixelToGrid(placement.y),
          },
          rotation: placement.rotation,
        }),
      ),
  };
}

/**
 * Converts scene pixel coordinates into the renderer-independent core's grid
 * model. The scene keeps presentation coordinates; placement truth still goes
 * through the deterministic validator used by tests and save tooling.
 */
export function validateScenePlacement(
  blueprint: LocationBlueprint,
  placements: readonly PlacedDecor[],
  definition: DecorDefinition,
  instanceId: string,
  x: number,
  y: number,
  rotation: Rotation,
  ignoreInstanceId?: string,
): PlacementValidation {
  const world = buildWorldDefinition(blueprint);
  const state = buildWorldState(blueprint, placements);
  const registry: ItemRegistry =
    CORE_ITEM_REGISTRY[definition.id] === undefined
      ? {
          ...CORE_ITEM_REGISTRY,
          [definition.id]: toCoreItemDefinition(definition),
        }
      : CORE_ITEM_REGISTRY;

  return validatePlacement(
    world,
    state,
    registry,
    {
      instanceId,
      itemId: definition.id,
      position: { x: pixelToGrid(x), y: pixelToGrid(y) },
      rotation,
    },
    ignoreInstanceId ? { ignoreInstanceId } : {},
  );
}
