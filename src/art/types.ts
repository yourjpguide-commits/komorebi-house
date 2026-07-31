/**
 * Renderer-neutral pixel art primitives.
 *
 * Every recipe in this folder resolves to an ordered list of opaque or
 * translucent rectangles.  Canvas, Phaser Graphics, WebGL atlases, and test
 * renderers can all consume the same deterministic data.
 */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly alpha: number;
}

export interface PixelAnchor {
  /** Contact point measured from the sprite's top-left corner. */
  readonly x: number;
  readonly y: number;
}

export interface PixelArtMetadata {
  readonly id?: string;
  readonly anchor?: PixelAnchor;
  readonly renderBand?:
    | "backdrop"
    | "ground"
    | "floor"
    | "furniture-low"
    | "furniture-high"
    | "wall"
    | "canopy"
    | "tabletop"
    | "character"
    | "atmosphere";
  readonly tags?: readonly string[];
}

export interface PixelArt {
  readonly width: number;
  readonly height: number;
  readonly commands: readonly PixelRect[];
  readonly metadata: Readonly<PixelArtMetadata>;
}

export type CardinalDirection = "north" | "east" | "south" | "west";
export type AvatarDirection = CardinalDirection | "up" | "right" | "down" | "left";
export type AvatarAction = "idle" | "walk" | "study" | "carry";
export type TimeOfDay = "morning" | "day" | "golden" | "evening" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type LocationId = "room" | "garden" | "cafe" | "park" | "shop" | "street";

export interface CanvasLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  imageSmoothingEnabled?: boolean;
  fillRect(x: number, y: number, width: number, height: number): void;
  save?(): void;
  restore?(): void;
}

export interface PixelTextureLike {
  getContext(): CanvasLike;
  refresh?(): void;
}

export interface PixelTextureManagerLike {
  exists?(key: string): boolean;
  createCanvas(key: string, width: number, height: number): PixelTextureLike;
}

export interface PixelTextureSceneLike {
  textures: PixelTextureManagerLike;
}
