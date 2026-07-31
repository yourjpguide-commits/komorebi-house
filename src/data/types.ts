export const ITEM_CATEGORIES = [
  "furniture",
  "study",
  "lighting",
  "decor",
  "garden",
  "cafe",
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const LOCATION_IDS = [
  "home-room",
  "home-garden",
  "kissaten-cafe",
  "riverside-park",
  "shopping-street",
] as const;

export type LocationId = (typeof LOCATION_IDS)[number];
export type PlacementLocationId = "home-room" | "home-garden";

export interface LocalizedText {
  readonly ja: string;
  readonly en: string;
}

export type UnlockRequirement =
  | { readonly type: "starter" }
  | { readonly type: "focus-minutes"; readonly minutes: number }
  | {
      readonly type: "location-sessions";
      readonly locationId: LocationId;
      readonly sessions: number;
    }
  | { readonly type: "rhythm-days"; readonly days: number };

export interface UnlockContext {
  readonly focusMinutes: number;
  readonly qualifyingRhythmDays: number;
  readonly locationStudySessions: Partial<Readonly<Record<LocationId, number>>>;
}

export type PlacementSurface =
  | "floor"
  | "wall"
  | "tabletop"
  | "ceiling"
  | "outdoor-ground"
  | "water-edge";

export type WorldSurface =
  | "tatami"
  | "wood"
  | "soil"
  | "grass"
  | "stone"
  | "water";

export type PlacementMount =
  | {
      readonly type: "floor-grid";
      readonly plane: "floor" | "outdoor";
      readonly supportSurfaces: readonly WorldSurface[];
    }
  | {
      readonly type: "support-socket";
      readonly plane: "support";
      readonly socket: "tabletop";
      readonly inheritsParentDepth: true;
    }
  | {
      readonly type: "wall-grid";
      readonly plane: "wall";
      readonly socket: "wall";
      readonly clearanceCells: number;
    }
  | {
      readonly type: "ceiling-hook";
      readonly plane: "ceiling";
      readonly socket: "ceiling";
      readonly dropCells: number;
    }
  | {
      readonly type: "water-edge";
      readonly plane: "outdoor";
      readonly supportSurfaces: readonly ("soil" | "stone")[];
      readonly requiredAdjacentSurface: "water";
    };

export interface ItemFootprint {
  /** Grid width in half-tatami cells. */
  readonly width: number;
  /** Grid depth in half-tatami cells. */
  readonly height: number;
  readonly collision: "solid" | "walkable" | "none";
  readonly surface: PlacementSurface;
  /** Enforce this support/attachment rule before a placement transaction. */
  readonly mount: PlacementMount;
  readonly rotatable: boolean;
}

export interface PlacementSupportContext {
  readonly plane: "floor" | "outdoor" | "support" | "wall" | "ceiling";
  readonly surface?: WorldSurface;
  readonly socket?: "tabletop" | "wall" | "ceiling";
  readonly adjacentSurfaces?: readonly WorldSurface[];
}

export interface PixelPalette {
  readonly outline: string;
  readonly shadow: string;
  readonly mid: string;
  readonly light: string;
  readonly accent: string;
}

export type RenderBand =
  | "ground"
  | "floor"
  | "furniture-low"
  | "furniture-high"
  | "wall"
  | "canopy"
  | "tabletop";

export interface VisualRecipe {
  /** Stable key used by a renderer or deterministic sprite generator. */
  readonly textureKey: string;
  readonly palette: PixelPalette;
  /** Materials are ordered from dominant to detail material. */
  readonly materials: readonly string[];
  /** Back-to-front sprite construction layers. */
  readonly layers: readonly string[];
  readonly renderBand: RenderBand;
  /** Normalized floor-contact or attachment point measured from sprite top-left. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly shadow: "none" | "soft" | "directional";
  readonly animation?: string;
}

export interface ItemInteraction {
  readonly id: string;
  readonly label: LocalizedText;
  readonly mode: "instant" | "toggle" | "sit" | "study" | "observe";
  readonly ambience?: string;
  /** Presentation-only suitability cue from 1–5; never multiplies rewards. */
  readonly focusBonus?: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly category: ItemCategory;
  /** Price in non-purchasable study-earned Hikari. */
  readonly price: number;
  readonly unlock: UnlockRequirement;
  readonly footprint: ItemFootprint;
  readonly locations: readonly PlacementLocationId[];
  readonly visual: VisualRecipe;
  readonly interactions: readonly ItemInteraction[];
  readonly tags: readonly string[];
  /** A small data hook for room-score presentation; no mechanical gate. */
  readonly coziness: number;
  /** A small data hook for study-space presentation; no reward multiplier. */
  readonly focus: number;
}

export interface StudyLocation {
  readonly enabled: boolean;
  readonly suggestedMinutes: readonly number[];
  readonly ambience: readonly string[];
  /** Presentation-only rating from 1–5; rewards stay location-neutral. */
  readonly focusMood: number;
}

export interface LocationDefinition {
  readonly id: LocationId;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly kind: "home" | "cafe" | "park" | "shopping";
  readonly unlock: UnlockRequirement;
  readonly supportsDecoration: boolean;
  readonly study: StudyLocation;
  readonly activities: readonly LocalizedText[];
  readonly palette: PixelPalette;
}
