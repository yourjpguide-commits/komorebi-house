/**
 * Furniture animation closure.
 *
 * Runtime furniture is intentionally valid as a single premium static cel.
 * These entries make that fallback explicit until the scene elects to register
 * the optional multi-cel treatment. This avoids silent references to animations
 * that do not exist while keeping authored cadence in one renderer-neutral file.
 */
export interface FurnitureAnimationRecipe {
  readonly id: string;
  readonly frameCount: number;
  readonly framesPerSecond: number;
  readonly loop: boolean;
  readonly staticFallback: true;
  readonly motion: "light" | "air" | "water" | "object" | "steam";
}

const recipes = [
  ["single-tick", 2, 1, false, "object"],
  ["pilot-light-pulse", 4, 3, true, "light"],
  ["warm-light-breathe", 4, 2, true, "light"],
  ["paper-lantern-flicker", 4, 5, true, "light"],
  ["pendant-sway", 4, 3, true, "object"],
  ["sunset-glow-cycle", 6, 2, true, "light"],
  ["firefly-twinkle", 6, 5, true, "light"],
  ["moonlight-pulse", 4, 2, true, "light"],
  ["dusk-lantern-flicker", 4, 4, true, "light"],
  ["filament-flicker", 4, 6, true, "light"],
  ["rain-chain-sway", 4, 4, true, "water"],
  ["constellation-rotate", 8, 3, true, "light"],
  ["tea-steam-curl", 6, 5, true, "steam"],
  ["petal-breathe", 4, 2, true, "object"],
  ["furin-sway-ring", 6, 4, true, "air"],
  ["noren-breathe", 4, 2, true, "air"],
  ["sleepy-cat-breathe", 4, 2, true, "object"],
  ["pendulum-slow", 6, 3, true, "object"],
  ["record-spin", 8, 8, true, "object"],
  ["plush-idle-bob", 4, 2, true, "object"],
  ["rain-wet-glint", 4, 4, true, "water"],
  ["moss-dew-sparkle", 6, 3, true, "light"],
  ["herbs-breeze", 4, 3, true, "air"],
  ["drop-and-ripple", 8, 6, true, "water"],
  ["hydrangea-rain-bob", 4, 4, true, "water"],
  ["maple-season-shift", 8, 2, true, "object"],
  ["pond-ripple-loop", 8, 6, true, "water"],
  ["coffee-steam-curl", 6, 5, true, "steam"],
  ["siphon-brew-cycle", 8, 5, true, "water"],
  ["glass-highlight-pass", 6, 4, true, "light"],
  ["soda-bubbles-rise", 6, 5, true, "water"],
  ["speaker-cone-subtle", 4, 6, true, "object"],
] as const satisfies readonly (
  readonly [
    string,
    number,
    number,
    boolean,
    FurnitureAnimationRecipe["motion"],
  ]
)[];

export const FURNITURE_ANIMATION_MANIFEST: Readonly<
  Record<string, FurnitureAnimationRecipe>
> = Object.freeze(
  Object.fromEntries(
    recipes.map(([id, frameCount, framesPerSecond, loop, motion]) => [
      id,
      Object.freeze({
        id,
        frameCount,
        framesPerSecond,
        loop,
        staticFallback: true as const,
        motion,
      }),
    ]),
  ),
);

export function furnitureAnimationRecipe(
  animationId: string | undefined,
): FurnitureAnimationRecipe | undefined {
  return animationId ? FURNITURE_ANIMATION_MANIFEST[animationId] : undefined;
}
