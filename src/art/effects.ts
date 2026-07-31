import { PALETTE } from "./palette";
import { createSeededRandom, makePixelArt, PixelPainter, seedFrom } from "./pixel";
import type { PixelArt, Season, TimeOfDay } from "./types";
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from "./environments";

export type EffectKind =
  | "rain"
  | "petals"
  | "leaves"
  | "fireflies"
  | "dust"
  | "steam"
  | "window-light"
  | "night-mask"
  | "focus-mask"
  | "vignette";

export interface EffectLayerOptions {
  readonly width?: number;
  readonly height?: number;
  readonly seed?: string | number;
  readonly frame?: number;
  readonly density?: number;
  readonly intensity?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly timeOfDay?: TimeOfDay;
  readonly season?: Season;
}

function particleCount(width: number, height: number, density: number, divisor: number): number {
  return Math.max(1, Math.floor((width * height * Math.max(0.05, density)) / divisor));
}

function paintRain(
  p: PixelPainter,
  width: number,
  height: number,
  random: ReturnType<typeof createSeededRandom>,
  frame: number,
  density: number,
  intensity: number,
): void {
  const count = particleCount(width, height, density, 950);
  const drift = (frame * 3) % Math.max(1, height + 14);
  for (let index = 0; index < count; index += 1) {
    const baseX = random.int(-20, width + 20);
    const baseY = random.int(-14, height + 14);
    const y = ((baseY + drift + 14) % (height + 28)) - 14;
    const x = ((baseX - Math.floor(drift * 0.32) + 20) % (width + 40)) - 20;
    const length = random.int(4, 9);
    const color = random.chance(0.58) ? PALETTE.skyLight : PALETTE.waterLight;
    p.line(x, y, x - Math.max(1, Math.floor(length / 3)), y + length, color, 1);
    if (intensity > 0.7 && random.chance(0.2)) p.pixel(x - 2, y + length + 1, PALETTE.washi, 0.55);
  }
}

function paintPetals(
  p: PixelPainter,
  width: number,
  height: number,
  random: ReturnType<typeof createSeededRandom>,
  frame: number,
  density: number,
): void {
  const count = particleCount(width, height, density, 2400);
  for (let index = 0; index < count; index += 1) {
    const phase = random.int(0, 127);
    const y = (random.int(-8, height) + frame + phase) % (height + 8);
    const sway = Math.round(Math.sin((frame + phase) * 0.16) * 5);
    const x = (random.int(0, width) + sway + Math.floor(frame * 0.24)) % width;
    const color = index % 3 === 0 ? PALETTE.sakuraLight : PALETTE.sakura;
    if ((frame + phase) & 1) {
      p.rect(x, y, 3, 2, color);
      p.pixel(x + 1, y + 2, PALETTE.sakuraShadow);
    } else {
      p.rect(x, y, 2, 3, color);
      p.pixel(x + 2, y + 1, PALETTE.sakuraShadow);
    }
  }
}

function paintLeaves(
  p: PixelPainter,
  width: number,
  height: number,
  random: ReturnType<typeof createSeededRandom>,
  frame: number,
  density: number,
  season: Season,
): void {
  const count = particleCount(width, height, density, 3400);
  const colors =
    season === "autumn"
      ? [PALETTE.amberLight, PALETTE.vermilion, PALETTE.vermilionDark]
      : [PALETTE.leafLight, PALETTE.leaf, PALETTE.leafDark];
  for (let index = 0; index < count; index += 1) {
    const phase = random.int(0, 181);
    const y = (random.int(-10, height) + frame * 2 + phase) % (height + 10);
    const x = (random.int(0, width) + Math.round(Math.sin((frame + phase) * 0.11) * 9)) % width;
    const color = colors[index % colors.length]!;
    p.line(x, y, x + (((frame + phase) & 1) === 0 ? 3 : -3), y + 2, color);
    p.pixel(x, y, PALETTE.washi, 0.22);
  }
}

function paintFireflies(
  p: PixelPainter,
  width: number,
  height: number,
  random: ReturnType<typeof createSeededRandom>,
  frame: number,
  density: number,
  intensity: number,
): void {
  const count = particleCount(width, height, density, 4200);
  for (let index = 0; index < count; index += 1) {
    const phase = random.int(0, 300);
    const baseX = random.int(8, width - 9);
    const baseY = random.int(Math.floor(height * 0.25), height - 10);
    const x = baseX + Math.round(Math.sin((frame + phase) * 0.045) * 7);
    const y = baseY + Math.round(Math.cos((frame + phase) * 0.033) * 4);
    const pulse = (Math.sin((frame + phase) * 0.18) + 1) / 2;
    if (pulse > 0.28) {
      p.rect(x - 2, y - 1, 5, 3, PALETTE.amberLight, pulse * 0.1 * intensity);
      p.pixel(x, y, PALETTE.glow, Math.max(0.4, pulse * intensity));
      if (pulse > 0.76) p.pixel(x + 1, y, PALETTE.washi, 0.9);
    }
  }
}

function paintDust(
  p: PixelPainter,
  width: number,
  height: number,
  random: ReturnType<typeof createSeededRandom>,
  frame: number,
  density: number,
): void {
  const count = particleCount(width, height, density, 3100);
  for (let index = 0; index < count; index += 1) {
    const phase = random.int(0, 240);
    const baseX = random.int(0, width - 1);
    const baseY = random.int(0, height - 1);
    const x = (baseX + Math.round(Math.sin((frame + phase) * 0.025) * 3) + width) % width;
    const y = (baseY - Math.floor(frame * 0.08) + height) % height;
    p.pixel(x, y, index & 1 ? PALETTE.glow : PALETTE.washi, 0.24 + (index % 3) * 0.08);
  }
}

function paintSteam(
  p: PixelPainter,
  originX: number,
  originY: number,
  frame: number,
  intensity: number,
): void {
  for (let puff = 0; puff < 4; puff += 1) {
    const phase = (frame + puff * 9) % 36;
    const y = originY - Math.floor(phase * 0.6);
    const x = originX + Math.round(Math.sin((phase + puff * 3) * 0.24) * 3);
    const alpha = Math.max(0, 1 - phase / 36) * 0.65 * intensity;
    p.pixel(x, y, PALETTE.washi, alpha);
    p.rect(x - 1, y + 1, 3, 1, PALETTE.washiShadow, alpha * 0.7);
  }
}

function paintWindowLight(
  p: PixelPainter,
  width: number,
  height: number,
  originX: number,
  originY: number,
  intensity: number,
): void {
  const farY = Math.min(height, originY + Math.floor(height * 0.72));
  p.polygon(
    [
      [originX, originY],
      [Math.min(width, originX + 96), originY],
      [Math.min(width, originX + 235), farY],
      [Math.max(0, originX + 32), farY],
    ],
    PALETTE.glow,
    0.09 * intensity,
  );
  // Shoji-bar shadows turn a flat overlay into authored environmental light.
  for (let offset = 22; offset < 110; offset += 24) {
    p.polygon(
      [
        [originX + offset, originY],
        [originX + offset + 3, originY],
        [originX + offset + 84, farY],
        [originX + offset + 74, farY],
      ],
      PALETTE.hinokiDark,
      0.05 * intensity,
    );
  }
  for (let y = originY + 19; y < farY; y += 34) {
    p.polygon(
      [
        [originX, y],
        [originX + 108, y],
        [originX + 115, y + 4],
        [originX + 2, y + 4],
      ],
      PALETTE.hinokiDark,
      0.04 * intensity,
    );
  }
}

function paintNightMask(p: PixelPainter, width: number, height: number, intensity: number): void {
  p.rect(0, 0, width, height, PALETTE.inkDeep, 0.25 * intensity);
  p.rect(0, 0, Math.floor(width * 0.45), height, PALETTE.indigoDeep, 0.15 * intensity);
  p.rect(Math.floor(width * 0.45), 0, width, height, PALETTE.indigo, 0.08 * intensity);
}

function paintFocusMask(
  p: PixelPainter,
  width: number,
  height: number,
  originX: number,
  originY: number,
  intensity: number,
): void {
  const radiusX = Math.min(120, Math.floor(width * 0.25));
  const radiusY = Math.min(70, Math.floor(height * 0.28));
  const alpha = 0.24 * intensity;
  p.rect(0, 0, width, Math.max(0, originY - radiusY), PALETTE.inkDeep, alpha);
  p.rect(0, originY + radiusY, width, Math.max(0, height - originY - radiusY), PALETTE.inkDeep, alpha);
  p.rect(0, originY - radiusY, Math.max(0, originX - radiusX), radiusY * 2, PALETTE.inkDeep, alpha);
  p.rect(originX + radiusX, originY - radiusY, Math.max(0, width - originX - radiusX), radiusY * 2, PALETTE.inkDeep, alpha);
  // Stepped inner falloff; intentionally geometric rather than blurred.
  for (let step = 0; step < 4; step += 1) {
    const insetX = radiusX - step * 7;
    const insetY = radiusY - step * 5;
    p.frame(originX - insetX, originY - insetY, insetX * 2, insetY * 2, PALETTE.inkDeep, 1);
  }
}

function paintVignette(p: PixelPainter, width: number, height: number, intensity: number): void {
  for (let band = 0; band < 12; band += 1) {
    const alpha = (12 - band) * 0.0035 * intensity;
    p.rect(band, band, width - band * 2, 1, PALETTE.inkDeep, alpha);
    p.rect(band, height - band - 1, width - band * 2, 1, PALETTE.inkDeep, alpha);
    p.rect(band, band, 1, height - band * 2, PALETTE.inkDeep, alpha);
    p.rect(width - band - 1, band, 1, height - band * 2, PALETTE.inkDeep, alpha);
  }
}

export function createEffectLayer(
  effect: EffectKind,
  options: EffectLayerOptions = {},
): PixelArt {
  const width = options.width ?? VIRTUAL_WIDTH;
  const height = options.height ?? VIRTUAL_HEIGHT;
  const frame = Math.max(0, Math.floor(options.frame ?? 0));
  const density = Math.max(0.05, options.density ?? 1);
  const intensity = Math.max(0, Math.min(2, options.intensity ?? 1));
  const seed = options.seed ?? `komorebi:${effect}`;
  const random = createSeededRandom(seedFrom(effect, seed));
  const originX = Math.round(options.originX ?? width * 0.58);
  const originY = Math.round(options.originY ?? height * 0.43);
  return makePixelArt(
    width,
    height,
    (painter) => {
      switch (effect) {
        case "rain":
          paintRain(painter, width, height, random, frame, density, intensity);
          break;
        case "petals":
          paintPetals(painter, width, height, random, frame, density);
          break;
        case "leaves":
          paintLeaves(painter, width, height, random, frame, density, options.season ?? "autumn");
          break;
        case "fireflies":
          paintFireflies(painter, width, height, random, frame, density, intensity);
          break;
        case "dust":
          paintDust(painter, width, height, random, frame, density);
          break;
        case "steam":
          paintSteam(painter, originX, originY, frame, intensity);
          break;
        case "window-light":
          paintWindowLight(painter, width, height, originX, originY, intensity);
          break;
        case "night-mask":
          paintNightMask(painter, width, height, intensity);
          break;
        case "focus-mask":
          paintFocusMask(painter, width, height, originX, originY, intensity);
          break;
        case "vignette":
          paintVignette(painter, width, height, intensity);
          break;
      }
    },
    {
      id: `effect:${effect}:${seed}:${frame}`,
      renderBand: "atmosphere",
      tags: [effect, `frame-${frame}`, `density-${density}`, `intensity-${intensity}`],
    },
  );
}

export function createEffectAnimation(
  effect: EffectKind,
  frameCount: number,
  options: Omit<EffectLayerOptions, "frame"> = {},
): readonly PixelArt[] {
  return Object.freeze(
    Array.from({ length: Math.max(1, Math.floor(frameCount)) }, (_, frame) =>
      createEffectLayer(effect, { ...options, frame }),
    ),
  );
}
