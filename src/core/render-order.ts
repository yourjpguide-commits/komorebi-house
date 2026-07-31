import type {
  GridCoordinate,
  ItemRegistry,
  PlacedItem,
  RenderableDepth,
} from "./types";
import { RenderBand } from "./types";
import { compareStableStrings } from "./projection";
import { getItemDefinition } from "./footprints";

export function getRenderDepth(
  position: GridCoordinate,
  depthOffset = 0,
): number {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(depthOffset)
  ) {
    throw new RangeError("Render coordinates and depth offsets must be finite.");
  }
  return position.x + position.y + depthOffset;
}

export function compareRenderables(
  a: RenderableDepth,
  b: RenderableDepth,
): number {
  if (!Number.isFinite(a.band) || !Number.isFinite(b.band)) {
    throw new RangeError("Render bands must be finite numbers.");
  }
  return (
    a.band - b.band ||
    getRenderDepth(a.position, a.depthOffset) -
      getRenderDepth(b.position, b.depthOffset) ||
    a.position.y - b.position.y ||
    a.position.x - b.position.x ||
    compareStableStrings(a.id, b.id)
  );
}

export function sortRenderables<T extends RenderableDepth>(
  renderables: readonly T[],
): readonly T[] {
  return [...renderables].sort(compareRenderables);
}

export function placedItemRenderDepth(
  item: PlacedItem,
  registry: ItemRegistry,
): RenderableDepth {
  const definition = getItemDefinition(registry, item.itemId);
  return {
    id: item.instanceId,
    band: definition?.renderBand ?? RenderBand.OBJECTS,
    position: item.position,
    depthOffset: definition?.depthOffset ?? 0,
  };
}

export function sortPlacedItemsForRender(
  items: readonly PlacedItem[],
  registry: ItemRegistry,
): readonly PlacedItem[] {
  const byId = new Map(items.map((item) => [item.instanceId, item]));
  return sortRenderables(
    items.map((item) => placedItemRenderDepth(item, registry)),
  )
    .map((renderable) => byId.get(renderable.id))
    .filter((item): item is PlacedItem => item !== undefined);
}
