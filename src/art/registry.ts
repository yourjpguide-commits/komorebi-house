import {
  AVATAR_FRAME_COUNTS,
  createAvatarSprite,
  normalizeAvatarDirection,
  type AvatarAppearance,
} from "./avatar";
import { createEffectLayer, type EffectKind } from "./effects";
import {
  createEnvironment,
  type EnvironmentOptions,
} from "./environments";
import {
  createFurnitureSprite,
  PROCEDURAL_FURNITURE_IDS,
  furnitureSupportedRotations,
  type FurnitureRotation,
  type FurnitureSpriteOptions,
} from "./furniture";
import { drawPixelArt } from "./pixel";
import type {
  AvatarAction,
  AvatarDirection,
  CardinalDirection,
  LocationId,
  PixelArt,
  PixelTextureSceneLike,
  Season,
  TimeOfDay,
} from "./types";
import type { OutfitPaletteName } from "./palette";

const slug = (value: string | number): string =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function environmentTextureKey(
  location: LocationId | string,
  season: Season = "spring",
  timeOfDay: TimeOfDay = "day",
): string {
  const suffix = season === "spring" && timeOfDay === "day" ? "" : `-${season}-${timeOfDay}`;
  return `environment-${slug(location)}${suffix}`;
}

export function avatarTextureKey(
  direction: AvatarDirection,
  action: AvatarAction = "idle",
  frame = 0,
  outfit: OutfitPaletteName = "indigo",
): string {
  const normalized = normalizeAvatarDirection(direction);
  return `avatar-${outfit}-${normalized}-${action}-${Math.max(0, Math.floor(frame))}`;
}

/**
 * Catalog visual.textureKey is the item id, so base variants deliberately use
 * the exact id. Alternate variants are namespaced without changing that base.
 */
export function furnitureTextureKey(
  itemId: string,
  variant = 0,
  rotation: FurnitureRotation = 0,
): string {
  const normalizedId = slug(itemId);
  const base = variant === 0
    ? `koh:decor:${normalizedId}`
    : `koh:decor:${normalizedId}:v${Math.floor(variant)}`;
  return rotation === 0 ? base : `${base}:r${rotation}`;
}

/** The un-namespaced key stored in the data catalog. */
export function catalogFurnitureTextureKey(itemId: string): string {
  return slug(itemId);
}

export function effectTextureKey(effect: EffectKind, frame = 0, seed: string | number = 0): string {
  return `effect-${effect}-${slug(seed)}-${Math.max(0, Math.floor(frame))}`;
}

export interface TextureRegistrationOptions {
  readonly locations?: readonly (LocationId | string)[];
  readonly environment?: Omit<EnvironmentOptions, "seed"> & { readonly seed?: string | number };
  readonly itemIds?: readonly string[];
  readonly furniture?: FurnitureSpriteOptions;
  readonly furnitureRotations?: readonly FurnitureRotation[];
  readonly avatarOutfits?: readonly OutfitPaletteName[];
  readonly avatarAppearance?: Omit<AvatarAppearance, "outfit">;
  readonly avatarActions?: readonly AvatarAction[];
  readonly effects?: readonly EffectKind[];
  readonly effectFrames?: number;
  readonly effectSeed?: string | number;
}

export interface RegisteredPixelArtTextures {
  readonly keys: readonly string[];
  readonly created: number;
  readonly reused: number;
}

function registerArt(
  scene: PixelTextureSceneLike,
  key: string,
  art: PixelArt,
): "created" | "reused" {
  if (scene.textures.exists?.(key)) return "reused";
  const texture = scene.textures.createCanvas(key, art.width, art.height);
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  // Phaser creates a cleared canvas, while lightweight QA doubles may retain
  // their buffer. Drawing the complete command list is intentionally enough:
  // sprites remain transparent because no background primitive is emitted.
  drawPixelArt(context, art);
  texture.refresh?.();
  return "created";
}

export function registerPixelArtTextures(
  scene: PixelTextureSceneLike,
  options: TextureRegistrationOptions = {},
): RegisteredPixelArtTextures {
  const keys: string[] = [];
  let created = 0;
  let reused = 0;
  const add = (key: string, art: PixelArt): void => {
    keys.push(key);
    if (registerArt(scene, key, art) === "created") created += 1;
    else reused += 1;
  };

  const locations = options.locations ?? ["room", "garden", "cafe", "park", "shop", "street"];
  const season = options.environment?.season ?? "spring";
  const timeOfDay = options.environment?.timeOfDay ?? "day";
  for (const locationValue of locations) {
    const location = (
      ["room", "garden", "cafe", "park", "shop", "street"].includes(locationValue)
        ? locationValue
        : "room"
    ) as LocationId;
    const key = environmentTextureKey(locationValue, season, timeOfDay);
    add(
      key,
      createEnvironment(location, {
        ...options.environment,
        seed: `${options.environment?.seed ?? "registry"}:${locationValue}`,
      }),
    );
  }

  const directions: readonly CardinalDirection[] = ["north", "east", "south", "west"];
  const actions = options.avatarActions ?? (["idle", "walk", "study", "carry"] as const);
  for (const outfit of options.avatarOutfits ?? (["indigo"] as const)) {
    for (const direction of directions) {
      for (const action of actions) {
        for (let frame = 0; frame < AVATAR_FRAME_COUNTS[action]; frame += 1) {
          add(
            avatarTextureKey(direction, action, frame, outfit),
            createAvatarSprite(direction, action, frame, {
              ...options.avatarAppearance,
              outfit,
            }),
          );
        }
      }
    }
  }

  const furnitureRotations = options.furnitureRotations ?? ([0] as const);
  for (const itemId of options.itemIds ?? PROCEDURAL_FURNITURE_IDS) {
    const supportedRotations = furnitureSupportedRotations(itemId);
    for (const rotation of furnitureRotations) {
      if (!supportedRotations.includes(rotation)) continue;
      add(
        furnitureTextureKey(
          itemId,
          options.furniture?.variant ?? 0,
          rotation,
        ),
        createFurnitureSprite(itemId, {
          ...options.furniture,
          rotation,
        }),
      );
    }
  }

  const animatedEffects = new Set<EffectKind>(["rain", "petals", "leaves", "fireflies", "dust", "steam"]);
  for (const effect of options.effects ?? []) {
    const frameCount = animatedEffects.has(effect) ? Math.max(1, options.effectFrames ?? 8) : 1;
    for (let frame = 0; frame < frameCount; frame += 1) {
      add(
        effectTextureKey(effect, frame, options.effectSeed ?? 0),
        createEffectLayer(effect, { frame, seed: options.effectSeed }),
      );
    }
  }

  return Object.freeze({
    keys: Object.freeze(keys),
    created,
    reused,
  });
}
