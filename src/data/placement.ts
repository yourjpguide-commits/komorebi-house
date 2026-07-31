import type {
  PlacementMount,
  PlacementSupportContext,
  PlacementSurface,
  WorldSurface,
} from "./types";

const INTERIOR_SURFACES = ["tatami", "wood"] as const;
const OUTDOOR_SURFACES = ["soil", "grass", "stone"] as const;

export function mountForSurface(surface: PlacementSurface): PlacementMount {
  switch (surface) {
    case "floor":
      return {
        type: "floor-grid",
        plane: "floor",
        supportSurfaces: INTERIOR_SURFACES,
      };
    case "outdoor-ground":
      return {
        type: "floor-grid",
        plane: "outdoor",
        supportSurfaces: OUTDOOR_SURFACES,
      };
    case "tabletop":
      return {
        type: "support-socket",
        plane: "support",
        socket: "tabletop",
        inheritsParentDepth: true,
      };
    case "wall":
      return {
        type: "wall-grid",
        plane: "wall",
        socket: "wall",
        clearanceCells: 0,
      };
    case "ceiling":
      return {
        type: "ceiling-hook",
        plane: "ceiling",
        socket: "ceiling",
        dropCells: 0,
      };
    case "water-edge":
      return {
        type: "water-edge",
        plane: "outdoor",
        supportSurfaces: ["soil", "stone"],
        requiredAdjacentSurface: "water",
      };
  }
}
function supportedSurface(
  available: WorldSurface | undefined,
  allowed: readonly WorldSurface[],
): boolean {
  return available !== undefined && allowed.includes(available);
}

/**
 * Catalog-side placement preflight. WorldCore remains authoritative for grid
 * occupancy, collisions, bounds, and transactional placement.
 */
export function placementMountFits(
  mount: PlacementMount,
  context: PlacementSupportContext,
): boolean {
  switch (mount.type) {
    case "floor-grid":
      return (
        context.plane === mount.plane &&
        supportedSurface(context.surface, mount.supportSurfaces)
      );
    case "support-socket":
      return context.plane === mount.plane && context.socket === mount.socket;
    case "wall-grid":
      return context.plane === mount.plane && context.socket === mount.socket;
    case "ceiling-hook":
      return context.plane === mount.plane && context.socket === mount.socket;
    case "water-edge":
      return (
        context.plane === mount.plane &&
        supportedSurface(context.surface, mount.supportSurfaces) &&
        context.adjacentSurfaces?.includes(mount.requiredAdjacentSurface) === true
      );
  }
}
