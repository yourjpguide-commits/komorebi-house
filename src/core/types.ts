/**
 * Renderer-independent spatial and persistence types for Komorebi House.
 *
 * Grid coordinates are integer cell coordinates. Item positions are contact
 * anchors: footprint offsets rotate around that anchor, so art can keep a
 * stable sprite origin while the core remains unaware of pixels.
 */

/** A finite coordinate in continuous grid space (fractional values allowed). */
export interface GridCoordinate {
  readonly x: number;
  readonly y: number;
}

/** An integer cell coordinate. Runtime-facing APIs validate this invariant. */
export interface GridPoint extends GridCoordinate {}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export type CardinalDirection = "north" | "east" | "south" | "west";

export interface ProjectionConfig {
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly originX: number;
  readonly originY: number;
  readonly elevationHeight: number;
}

export interface RectZoneShape {
  readonly type: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CellZoneShape {
  readonly type: "cells";
  readonly cells: readonly GridPoint[];
}

export type ZoneShape = RectZoneShape | CellZoneShape;

/**
 * Zone kinds are deliberately open strings. The shipped data can use values
 * such as "room", "engawa", "garden", "cafe", and "park" without coupling
 * the deterministic core to a particular content set.
 */
export interface ZoneDefinition {
  readonly id: string;
  readonly kind: string;
  readonly shape: ZoneShape;
  readonly surface?: string;
  readonly tags?: readonly string[];
  readonly priority?: number;
  readonly walkable?: boolean;
  readonly placeable?: boolean;
}

export interface CellOverride {
  readonly position: GridPoint;
  readonly surface?: string;
  readonly walkable?: boolean;
  readonly placeable?: boolean;
}

export interface WorldDefinition {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly zones: readonly ZoneDefinition[];
  /**
   * Static blocked cells are neither walkable nor placeable. They are useful
   * for pillars, ponds, walls, and other baked architecture.
   */
  readonly blockedCells?: readonly GridPoint[];
  /**
   * Reserved cells stay walkable but reject item placement (doors and travel
   * thresholds are common examples).
   */
  readonly reservedCells?: readonly GridPoint[];
  readonly cellOverrides?: readonly CellOverride[];
}

export interface CellInfo {
  readonly position: GridPoint;
  readonly zone: ZoneDefinition | null;
  readonly surface: string | null;
  readonly tags: readonly string[];
  readonly walkable: boolean;
  readonly placeable: boolean;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

/**
 * A footprint is expressed at rotation 0 relative to the item's contact
 * anchor. Collision defaults to the footprint when blocksMovement is true.
 *
 * Placement layers make useful cozy-room overlaps possible: a rug on "floor"
 * can sit beneath a desk on "object", while two desks still conflict.
 */
export interface ItemDefinition {
  readonly id: string;
  readonly footprint: readonly GridPoint[];
  readonly collision?: readonly GridPoint[];
  readonly allowedZoneIds?: readonly string[];
  readonly allowedZoneKinds?: readonly string[];
  readonly allowedSurfaces?: readonly string[];
  readonly placementLayer?: string;
  readonly blocksPlacement?: boolean;
  readonly blocksMovement?: boolean;
  readonly rotatable?: boolean;
  readonly unique?: boolean;
  readonly renderBand?: number;
  readonly depthOffset?: number;
  readonly tags?: readonly string[];
}

export type ItemRegistry = Readonly<Record<string, ItemDefinition>>;

export interface PlacedItem {
  readonly instanceId: string;
  readonly itemId: string;
  readonly position: GridPoint;
  readonly rotation: Rotation;
  readonly variant?: string;
  readonly state?: JsonObject;
}

export interface WorldState {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly revision: number;
  readonly items: readonly PlacedItem[];
}

export type PlacementIssueCode =
  | "WORLD_MISMATCH"
  | "INVALID_INSTANCE"
  | "UNKNOWN_ITEM"
  | "UNKNOWN_EXISTING_ITEM"
  | "DUPLICATE_INSTANCE"
  | "UNIQUE_ITEM"
  | "INVALID_POSITION"
  | "INVALID_ROTATION"
  | "ROTATION_NOT_ALLOWED"
  | "OUTSIDE_WORLD"
  | "CELL_NOT_PLACEABLE"
  | "ZONE_NOT_ALLOWED"
  | "SURFACE_NOT_ALLOWED"
  | "FOOTPRINT_CONFLICT"
  | "INSTANCE_NOT_FOUND"
  | "INVALID_ITEM_STATE"
  | "REVISION_OVERFLOW";

export interface PlacementIssue {
  readonly code: PlacementIssueCode;
  readonly message: string;
  readonly cell?: GridPoint;
  readonly conflictingInstanceId?: string;
}

export interface PlacementValidation {
  readonly ok: boolean;
  readonly issues: readonly PlacementIssue[];
  readonly cells: readonly GridPoint[];
}

export interface WorldMutationResult {
  readonly ok: boolean;
  readonly state: WorldState;
  readonly issues: readonly PlacementIssue[];
}

export interface PlacementOptions {
  readonly ignoreInstanceId?: string;
}

export interface WalkabilityOptions {
  readonly ignoreInstanceId?: string;
  readonly allowGoalOccupied?: boolean;
  readonly maxVisited?: number;
}

export const RenderBand = {
  BACKDROP: 0,
  TERRAIN: 100,
  REAR_ARCHITECTURE: 200,
  GROUND_DECOR: 300,
  /**
   * Movable furniture, foliage, and actors share a band so contact-cell depth
   * lets a character pass both behind and in front of an object.
   */
  WORLD_ENTITIES: 400,
  OBJECTS: 400,
  CHARACTERS: 400,
  FOREGROUND: 600,
  ATMOSPHERE: 700,
  UI: 800,
} as const;

export type RenderBandValue = (typeof RenderBand)[keyof typeof RenderBand];

export interface RenderableDepth {
  readonly id: string;
  readonly band: number;
  /** Continuous coordinates are allowed while actors tween between cells. */
  readonly position: GridCoordinate;
  readonly depthOffset?: number;
}

export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface DefinitionIssue {
  readonly path: string;
  readonly message: string;
}

export interface SaveValidationIssue {
  readonly path: string;
  readonly code:
    | "INVALID_JSON"
    | "INVALID_TYPE"
    | "INVALID_VALUE"
    | "UNSUPPORTED_VERSION"
    | "WORLD_MISMATCH"
    | "DUPLICATE_INSTANCE"
    | "UNKNOWN_ITEM"
    | "INVALID_PLACEMENT"
    | "LIMIT_EXCEEDED";
  readonly message: string;
}

export type WorldSaveParseResult =
  | {
      readonly ok: true;
      readonly state: WorldState;
      readonly errors: readonly [];
    }
  | {
      readonly ok: false;
      readonly state: null;
      readonly errors: readonly SaveValidationIssue[];
    };

export interface WorldSaveParseOptions {
  readonly expectedWorldId?: string;
  readonly world?: WorldDefinition;
  readonly registry?: ItemRegistry;
  readonly validatePlacements?: boolean;
  readonly maxItems?: number;
  readonly maxJsonDepth?: number;
  readonly maxJsonNodes?: number;
  readonly maxJsonCharacters?: number;
  readonly maxInputCharacters?: number;
}
