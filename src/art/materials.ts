import { PALETTE } from "./palette";
import { createSeededRandom, makePixelArt, PixelPainter, seedFrom } from "./pixel";
import type { PixelArt } from "./types";

export type MaterialKind =
  | "tatami"
  | "hinoki"
  | "dark-wood"
  | "shoji"
  | "plaster"
  | "stone"
  | "grass"
  | "water"
  | "roof"
  | "indigo-fabric";

export const MATERIAL_KINDS = Object.freeze([
  "tatami",
  "hinoki",
  "dark-wood",
  "shoji",
  "plaster",
  "stone",
  "grass",
  "water",
  "roof",
  "indigo-fabric",
] as const satisfies readonly MaterialKind[]);

export interface MaterialPaintOptions {
  readonly seed?: string | number;
  readonly variant?: number;
}

export function paintTatami(
  painter: PixelPainter,
  x: number,
  y: number,
  width = 64,
  height = 32,
  options: MaterialPaintOptions = {},
): void {
  const random = createSeededRandom(seedFrom("tatami", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, PALETTE.tatamiDark);
  painter.rect(x + 2, y + 2, width - 4, height - 4, PALETTE.tatami);
  painter.hLine(x + 2, y + 2, width - 4, PALETTE.tatamiLight);
  painter.vLine(x + 2, y + 3, height - 6, PALETTE.tatamiLight);
  painter.hLine(x + 3, y + height - 3, width - 6, PALETTE.tatamiShadow);
  for (let yy = y + 6; yy < y + height - 4; yy += 4) {
    const inset = (yy & 1) + 3;
    painter.hLine(x + inset, yy, width - inset - 4, PALETTE.tatamiLight);
    for (
      let xx = x + inset + random.int(5, 11);
      xx < x + width - 5;
      xx += random.int(15, 23)
    ) {
      painter.pixel(xx, yy, PALETTE.tatamiShadow);
    }
  }
  for (let yy = y + 2; yy < y + height - 2; yy += 2) {
    painter.pixel(x, yy, PALETTE.hinoki);
    painter.pixel(x + width - 1, yy + 1, PALETTE.hinokiLight);
  }
}

export function paintWood(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions & { dark?: boolean; vertical?: boolean } = {},
): void {
  const dark = options.dark ?? false;
  const base = dark ? PALETTE.hinokiDark : PALETTE.hinoki;
  const light = dark ? PALETTE.hinoki : PALETTE.hinokiLight;
  const shadow = dark ? PALETTE.soilDeep : PALETTE.hinokiDark;
  const random = createSeededRandom(seedFrom("wood", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, base);
  const vertical = options.vertical ?? false;
  const cross = vertical ? width : height;
  const long = vertical ? height : width;
  for (let lane = 4; lane < cross; lane += random.int(6, 10)) {
    if (vertical) painter.vLine(x + lane, y, height, random.chance(0.7) ? light : shadow);
    else painter.hLine(x, y + lane, width, random.chance(0.7) ? light : shadow);
  }
  for (let offset = random.int(4, 9); offset < long - 2; offset += random.int(11, 25)) {
    const lane = random.int(2, Math.max(2, cross - 3));
    const knotLength = Math.min(random.int(3, 8), long - offset);
    if (vertical) {
      painter.vLine(x + lane, y + offset, knotLength, shadow);
      painter.pixel(x + lane + 1, y + offset + 1, light);
    } else {
      painter.hLine(x + offset, y + lane, knotLength, shadow);
      painter.pixel(x + offset + 1, y + lane + 1, light);
    }
  }
  painter.hLine(x, y, width, light);
  painter.hLine(x, y + height - 1, width, shadow);
}

export function paintShoji(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions & { glow?: boolean } = {},
): void {
  const paper = options.glow ? PALETTE.glow : PALETTE.washi;
  const paperShadow = options.glow ? PALETTE.amberLight : PALETTE.washiShadow;
  painter.rect(x, y, width, height, PALETTE.hinokiDark);
  painter.rect(x + 2, y + 2, width - 4, height - 4, paperShadow);
  const cellWidth = width >= 32 ? 10 : 7;
  const cellHeight = height >= 48 ? 12 : 9;
  for (let yy = y + 3; yy < y + height - 3; yy += cellHeight) {
    for (let xx = x + 3; xx < x + width - 3; xx += cellWidth) {
      painter.rect(
        xx,
        yy,
        Math.min(cellWidth - 1, x + width - 3 - xx),
        Math.min(cellHeight - 1, y + height - 3 - yy),
        ((xx + yy) / Math.max(1, cellWidth)) % 2 > 1 ? paperShadow : paper,
      );
    }
  }
  for (let xx = x + 2; xx < x + width; xx += cellWidth) {
    painter.vLine(xx, y + 1, height - 2, PALETTE.hinokiDark);
    painter.vLine(xx + 1, y + 2, height - 3, PALETTE.hinoki);
  }
  for (let yy = y + 2; yy < y + height; yy += cellHeight) {
    painter.hLine(x + 1, yy, width - 2, PALETTE.hinokiDark);
  }
  painter.frame(x, y, width, height, PALETTE.inkSoft, 1);
}

export function paintPlaster(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions = {},
): void {
  const random = createSeededRandom(seedFrom("plaster", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, PALETTE.washiShadow);
  painter.hLine(x, y, width, PALETTE.washi);
  for (let index = 0; index < Math.floor((width * height) / 190); index += 1) {
    const xx = x + random.int(1, Math.max(1, width - 2));
    const yy = y + random.int(1, Math.max(1, height - 2));
    painter.pixel(xx, yy, random.chance(0.75) ? PALETTE.washi : PALETTE.hinokiLight);
  }
}

export function paintStone(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions = {},
): void {
  const random = createSeededRandom(seedFrom("stone", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, PALETTE.stone);
  painter.hLine(x + 1, y, Math.max(1, width - 2), PALETTE.stoneLight);
  painter.vLine(x, y + 1, Math.max(1, height - 2), PALETTE.stoneLight);
  painter.hLine(x + 1, y + height - 1, Math.max(1, width - 1), PALETTE.stoneDeep);
  for (let index = 0; index < Math.floor((width * height) / 32); index += 1) {
    painter.pixel(
      x + random.int(1, Math.max(1, width - 2)),
      y + random.int(1, Math.max(1, height - 2)),
      random.chance(0.55) ? PALETTE.stoneLight : PALETTE.stoneDeep,
    );
  }
}

export function paintGrass(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions & { autumn?: boolean; snow?: boolean } = {},
): void {
  const random = createSeededRandom(seedFrom("grass", options.seed ?? 0, options.variant ?? 0));
  const base = options.snow
    ? PALETTE.skyLight
    : options.autumn
      ? PALETTE.tatamiShadow
      : PALETTE.leaf;
  const light = options.snow
    ? PALETTE.washi
    : options.autumn
      ? PALETTE.amberLight
      : PALETTE.leafLight;
  const dark = options.snow ? PALETTE.stoneLight : PALETTE.leafDark;
  painter.rect(x, y, width, height, base);
  let row = 0;
  for (let yy = y + 3; yy < y + height; yy += 8) {
    for (let xx = x + 3 + (row & 1 ? 5 : 0); xx < x + width; xx += 13) {
      if (!random.chance(options.snow ? 0.38 : 0.7)) continue;
      const jitterX = random.int(-1, 1);
      const jitterY = random.int(-1, 1);
      const color = random.chance(0.68) ? light : dark;
      painter.pixel(xx + jitterX, yy + jitterY, color);
      if (!options.snow && random.chance(0.52)) {
        painter.pixel(xx + jitterX + 1, yy + jitterY - 1, color);
        if (random.chance(0.35)) painter.pixel(xx + jitterX - 1, yy + jitterY - 1, dark);
      }
    }
    row += 1;
  }
}

export function paintWater(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions = {},
): void {
  const random = createSeededRandom(seedFrom("water", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, PALETTE.waterDeep);
  for (let yy = y + 1; yy < y + height - 1; yy += 3) {
    const start = x + random.int(0, 5);
    for (let xx = start; xx < x + width - 2; xx += random.int(7, 14)) {
      const length = Math.min(random.int(2, 6), x + width - xx);
      painter.hLine(xx, yy, length, random.chance(0.7) ? PALETTE.waterLight : PALETTE.water);
    }
  }
}

export function paintRoofTiles(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions = {},
): void {
  const random = createSeededRandom(seedFrom("roof", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, PALETTE.inkSoft);
  for (let yy = y + 2; yy < y + height; yy += 5) {
    painter.hLine(x, yy, width, PALETTE.inkDeep);
    for (let xx = x + ((yy / 5) & 1 ? 4 : 0); xx < x + width; xx += 8) {
      painter.vLine(xx, yy - 2, Math.min(5, y + height - yy + 2), PALETTE.inkLift);
      if (random.chance(0.14)) painter.pixel(xx + 1, yy - 1, PALETTE.indigoLight);
    }
  }
  painter.hLine(x, y, width, PALETTE.inkLift);
  painter.hLine(x, y + height - 2, width, PALETTE.inkDeep, 2);
}

export function paintIndigoFabric(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions = {},
): void {
  const random = createSeededRandom(seedFrom("indigo", options.seed ?? 0, options.variant ?? 0));
  painter.rect(x, y, width, height, PALETTE.indigo);
  painter.hLine(x, y, width, PALETTE.indigoLight);
  for (let index = 0; index < Math.floor((width * height) / 50); index += 1) {
    painter.hLine(
      x + random.int(1, Math.max(1, width - 3)),
      y + random.int(2, Math.max(2, height - 2)),
      random.int(1, 3),
      random.chance(0.5) ? PALETTE.indigoDeep : PALETTE.indigoLight,
    );
  }
}

export function paintMaterial(
  painter: PixelPainter,
  kind: MaterialKind,
  x: number,
  y: number,
  width: number,
  height: number,
  options: MaterialPaintOptions = {},
): void {
  switch (kind) {
    case "tatami":
      paintTatami(painter, x, y, width, height, options);
      break;
    case "hinoki":
      paintWood(painter, x, y, width, height, options);
      break;
    case "dark-wood":
      paintWood(painter, x, y, width, height, { ...options, dark: true });
      break;
    case "shoji":
      paintShoji(painter, x, y, width, height, options);
      break;
    case "plaster":
      paintPlaster(painter, x, y, width, height, options);
      break;
    case "stone":
      paintStone(painter, x, y, width, height, options);
      break;
    case "grass":
      paintGrass(painter, x, y, width, height, options);
      break;
    case "water":
      paintWater(painter, x, y, width, height, options);
      break;
    case "roof":
      paintRoofTiles(painter, x, y, width, height, options);
      break;
    case "indigo-fabric":
      paintIndigoFabric(painter, x, y, width, height, options);
      break;
  }
}

export function createMaterialTile(
  kind: MaterialKind,
  seed: string | number = 0,
  width = kind === "tatami" ? 64 : 16,
  height = kind === "tatami" ? 32 : 16,
): PixelArt {
  return makePixelArt(
    width,
    height,
    (painter) => paintMaterial(painter, kind, 0, 0, width, height, { seed }),
    { id: `material:${kind}:${seed}`, renderBand: "ground", tags: [kind, "tileable"] },
  );
}
