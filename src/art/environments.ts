import {
  paintGrass,
  paintIndigoFabric,
  paintPlaster,
  paintRoofTiles,
  paintShoji,
  paintStone,
  paintTatami,
  paintWater,
  paintWood,
} from "./materials";
import { PALETTE } from "./palette";
import { createSeededRandom, makePixelArt, PixelPainter, seedFrom } from "./pixel";
import type { LocationId, PixelArt, Season, TimeOfDay } from "./types";

export const VIRTUAL_WIDTH = 480;
export const VIRTUAL_HEIGHT = 270;
export const WORLD_TILE_SIZE = 16;

export interface EnvironmentOptions {
  readonly width?: number;
  readonly height?: number;
  readonly seed?: string | number;
  readonly timeOfDay?: TimeOfDay;
  readonly season?: Season;
  readonly furnished?: boolean;
}

function paintCloud(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  color: string = PALETTE.washi,
): void {
  painter.rect(x + 4, y + 4, width - 8, 5, color);
  painter.rect(x + 9, y + 1, Math.floor(width * 0.34), 8, color);
  painter.rect(x + Math.floor(width * 0.45), y + 2, Math.floor(width * 0.38), 7, color);
  painter.hLine(x + 6, y + 9, width - 12, PALETTE.sky, 1);
}

function paintDistantHills(painter: PixelPainter, width: number, horizonY: number): void {
  painter.polygon(
    [
      [0, horizonY],
      [0, horizonY - 18],
      [width * 0.08, horizonY - 43],
      [width * 0.15, horizonY - 25],
      [width * 0.24, horizonY - 54],
      [width * 0.35, horizonY - 22],
      [width * 0.45, horizonY - 48],
      [width * 0.57, horizonY - 18],
      [width * 0.68, horizonY - 46],
      [width * 0.8, horizonY - 20],
      [width * 0.9, horizonY - 39],
      [width, horizonY - 16],
      [width, horizonY],
    ],
    PALETTE.indigo,
  );
  painter.polygon(
    [
      [0, horizonY],
      [0, horizonY - 9],
      [width * 0.14, horizonY - 26],
      [width * 0.22, horizonY - 12],
      [width * 0.34, horizonY - 34],
      [width * 0.47, horizonY - 13],
      [width * 0.63, horizonY - 31],
      [width * 0.74, horizonY - 11],
      [width * 0.86, horizonY - 28],
      [width, horizonY - 7],
      [width, horizonY],
    ],
    PALETTE.leafDark,
  );
  for (let x = 7; x < width; x += 13) {
    painter.vLine(x, horizonY - 8 - ((x * 7) % 12), 8 + ((x * 7) % 12), PALETTE.leafDeep);
  }
}

function paintDapple(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: string | number,
  light: string = PALETTE.glow,
): void {
  const random = createSeededRandom(seedFrom("dapple", seed));
  const count = Math.floor((width * height) / 520);
  for (let index = 0; index < count; index += 1) {
    const xx = x + random.int(0, Math.max(0, width - 4));
    const yy = y + random.int(0, Math.max(0, height - 2));
    const size = random.int(1, 3);
    painter.rect(xx, yy, size + 2, size, light, random.chance(0.7) ? 0.18 : 0.1);
    if (random.chance(0.5)) painter.pixel(xx + size + 3, yy - 1, light, 0.14);
  }
}

function paintBamboo(painter: PixelPainter, x: number, baseY: number, height: number): void {
  const top = baseY - height;
  painter.vLine(x, top, height, PALETTE.leafDark, 3);
  painter.vLine(x + 1, top, height, PALETTE.leafLight);
  for (let yy = top + 7; yy < baseY; yy += 11) {
    painter.hLine(x - 1, yy, 5, PALETTE.leafDeep);
    painter.line(x + 1, yy, x - 7, yy - 5, PALETTE.leafDark);
    painter.line(x + 2, yy + 2, x + 9, yy - 4, PALETTE.leafDark);
    painter.rect(x - 10, yy - 7, 5, 2, PALETTE.leaf);
    painter.rect(x + 7, yy - 7, 6, 2, PALETTE.leafLight);
  }
}

function paintTree(
  painter: PixelPainter,
  x: number,
  groundY: number,
  size: number,
  season: Season,
  seed: string | number,
): void {
  const random = createSeededRandom(seedFrom("tree", seed, season));
  const trunkWidth = Math.max(4, Math.floor(size / 7));
  const trunkTop = groundY - Math.floor(size * 0.72);
  painter.ellipse(x + 2, groundY + 1, Math.floor(size * 0.28), 4, PALETTE.inkDeep, 0.28);
  painter.rect(x - trunkWidth / 2, trunkTop, trunkWidth, groundY - trunkTop, PALETTE.hinokiDark);
  painter.vLine(x - 1, trunkTop + 2, groundY - trunkTop - 4, PALETTE.hinoki);
  painter.line(x, trunkTop + 8, x - Math.floor(size * 0.2), trunkTop - 5, PALETTE.hinokiDark, 2);
  painter.line(x + 1, trunkTop + 5, x + Math.floor(size * 0.22), trunkTop - 9, PALETTE.hinokiDark, 2);

  const colors =
    season === "spring"
      ? [PALETTE.sakuraShadow, PALETTE.sakura, PALETTE.sakuraLight]
      : season === "autumn"
        ? [PALETTE.vermilionDark, PALETTE.vermilion, PALETTE.amberLight]
        : season === "winter"
          ? [PALETTE.indigoDeep, PALETTE.stoneLight, PALETTE.washi]
          : [PALETTE.leafDeep, PALETTE.leaf, PALETTE.leafLight];
  const clusterY = groundY - Math.floor(size * 0.82);
  const underCanopy = season === "winter" ? PALETTE.indigoDeep : PALETTE.leafDeep;
  // A low, offset under-canopy keeps the tree from reading as a lollipop. The
  // darker mass also separates trunks and branches from pale seasonal leaves.
  painter.ellipse(
    x - Math.floor(size * 0.04),
    clusterY + Math.floor(size * 0.1),
    Math.floor(size * 0.45),
    Math.floor(size * 0.22),
    underCanopy,
  );
  painter.ellipse(
    x + Math.floor(size * 0.19),
    clusterY + Math.floor(size * 0.14),
    Math.floor(size * 0.22),
    Math.floor(size * 0.14),
    underCanopy,
  );
  painter.ellipse(
    x - Math.floor(size * 0.04),
    clusterY - Math.floor(size * 0.02),
    Math.floor(size * 0.22),
    Math.floor(size * 0.13),
    colors[1]!,
  );
  painter.ellipse(
    x - Math.floor(size * 0.18),
    clusterY + 2,
    Math.floor(size * 0.15),
    Math.floor(size * 0.1),
    colors[0]!,
  );
  painter.ellipse(
    x + Math.floor(size * 0.17),
    clusterY,
    Math.floor(size * 0.16),
    Math.floor(size * 0.11),
    colors[2]!,
  );
  painter.ellipse(
    x - Math.floor(size * 0.05),
    clusterY - Math.floor(size * 0.11),
    Math.floor(size * 0.15),
    Math.floor(size * 0.1),
    colors[2]!,
  );
  painter.ellipse(
    x + Math.floor(size * 0.23),
    clusterY + Math.floor(size * 0.1),
    Math.floor(size * 0.15),
    Math.floor(size * 0.1),
    colors[0]!,
  );
  painter.ellipse(
    x - Math.floor(size * 0.25),
    clusterY + Math.floor(size * 0.12),
    Math.floor(size * 0.14),
    Math.floor(size * 0.09),
    colors[1]!,
  );
  painter.ellipse(
    x + Math.floor(size * 0.08),
    clusterY + Math.floor(size * 0.31),
    Math.floor(size * 0.18),
    Math.floor(size * 0.09),
    colors[0]!,
  );
  painter.ellipse(
    x - Math.floor(size * 0.14),
    clusterY + Math.floor(size * 0.27),
    Math.floor(size * 0.15),
    Math.floor(size * 0.08),
    colors[1]!,
  );
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const radiusX = Math.floor(size * (0.08 + random.next() * 0.12));
    const radiusY = Math.floor(size * (0.055 + random.next() * 0.075));
    const xx = x + Math.round(Math.cos(angle) * size * 0.3) + random.int(-4, 4);
    const yy =
      clusterY +
      Math.round(Math.sin(angle) * size * 0.14) +
      (index > 8 && index < 15 ? Math.floor(size * 0.06) : 0) +
      random.int(-3, 3);
    painter.ellipse(xx, yy, radiusX, radiusY, colors[index % colors.length]!);
  }
  for (let index = 0; index < 14; index += 1) {
    painter.rect(
      x + random.int(-Math.floor(size * 0.42), Math.floor(size * 0.42)),
      clusterY + random.int(-Math.floor(size * 0.24), Math.floor(size * 0.18)),
      random.int(1, 3),
      random.int(1, 2),
      colors[2]!,
    );
  }
  painter.ellipse(x - Math.floor(size * 0.14), groundY - 1, Math.floor(size * 0.22), 5, PALETTE.leafDeep);
  painter.ellipse(x + Math.floor(size * 0.12), groundY - 2, Math.floor(size * 0.18), 4, PALETTE.leafDark);
  painter.hLine(x - Math.floor(size * 0.18), groundY - 4, Math.floor(size * 0.16), PALETTE.leafLight);
}

function paintStoneLantern(painter: PixelPainter, x: number, baseY: number): void {
  painter.ellipse(x + 10, baseY + 1, 12, 3, PALETTE.inkDeep, 0.2);
  painter.rect(x + 7, baseY - 24, 7, 23, PALETTE.stone);
  painter.vLine(x + 7, baseY - 23, 20, PALETTE.stoneLight);
  painter.rect(x + 3, baseY - 29, 15, 7, PALETTE.stoneDeep);
  painter.rect(x + 5, baseY - 28, 11, 4, PALETTE.glow);
  painter.pixel(x + 8, baseY - 27, PALETTE.amberLight);
  painter.polygon(
    [
      [x + 1, baseY - 30],
      [x + 10, baseY - 36],
      [x + 21, baseY - 29],
      [x + 18, baseY - 27],
      [x + 3, baseY - 27],
    ],
    PALETTE.stoneDeep,
  );
  painter.hLine(x + 4, baseY - 30, 13, PALETTE.stoneLight);
}

function paintGardenShrub(
  painter: PixelPainter,
  x: number,
  baseY: number,
  width: number,
  seed: string | number,
  blooms = false,
): void {
  const random = createSeededRandom(seedFrom("garden-shrub", seed, x, baseY));
  const radius = Math.max(5, Math.floor(width / 5));
  painter.ellipse(x + Math.floor(width / 2), baseY + 2, Math.floor(width / 2), 5, PALETTE.inkDeep, 0.2);
  for (let offset = 0; offset < width; offset += Math.max(7, radius)) {
    const centerX = x + offset + random.int(2, 6);
    const centerY = baseY - random.int(4, 12);
    painter.ellipse(centerX, centerY + 2, radius + 2, radius - 1, PALETTE.leafDeep);
    painter.ellipse(
      centerX,
      centerY,
      radius,
      Math.max(3, radius - 2),
      offset % 3 === 0 ? PALETTE.leaf : PALETTE.leafDark,
    );
    painter.hLine(centerX - 3, centerY - 3, 5, PALETTE.leafLight);
    if (blooms) {
      const bloom = offset % 2 === 0 ? PALETTE.sakura : PALETTE.indigoLight;
      painter.rect(centerX - 4, centerY - 7, 3, 2, bloom);
      painter.rect(centerX + 2, centerY - 5, 3, 2, PALETTE.sakuraLight);
    }
  }
}

function paintReeds(
  painter: PixelPainter,
  x: number,
  baseY: number,
  count: number,
  seed: string | number,
): void {
  const random = createSeededRandom(seedFrom("reeds", seed, x, baseY));
  for (let index = 0; index < count; index += 1) {
    const reedX = x + index * 4 + random.int(-1, 1);
    const height = random.int(10, 23);
    painter.line(reedX, baseY, reedX + random.int(-2, 2), baseY - height, PALETTE.leafDeep);
    painter.line(reedX + 1, baseY - 2, reedX + random.int(2, 5), baseY - Math.floor(height * 0.65), PALETTE.leafDark);
    if (index % 3 === 0) {
      painter.rect(reedX - 1, baseY - height - 2, 3, 5, PALETTE.soilDeep);
    }
  }
}

function paintBambooFence(
  painter: PixelPainter,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  painter.ellipse(x + Math.floor(width / 2), y + height + 2, Math.floor(width / 2), 4, PALETTE.inkDeep, 0.18);
  for (let postX = x; postX <= x + width; postX += 10) {
    painter.rect(postX, y, 4, height, PALETTE.hinoki);
    painter.vLine(postX + 1, y + 1, height - 2, PALETTE.hinokiLight);
    for (let jointY = y + 8; jointY < y + height; jointY += 13) {
      painter.hLine(postX - 1, jointY, 6, PALETTE.hinokiDark);
    }
  }
  painter.hLine(x - 2, y + 8, width + 8, PALETTE.hinokiDark, 3);
  painter.hLine(x - 2, y + height - 11, width + 8, PALETTE.hinokiDark, 3);
  for (let tieX = x + 4; tieX < x + width; tieX += 20) {
    painter.rect(tieX, y + 7, 2, 5, PALETTE.indigoDeep);
    painter.rect(tieX, y + height - 12, 2, 5, PALETTE.indigoDeep);
  }
}

function paintTsukubai(
  painter: PixelPainter,
  x: number,
  baseY: number,
): void {
  painter.ellipse(x + 22, baseY + 2, 28, 7, PALETTE.leafDeep, 0.24);
  painter.ellipse(x + 19, baseY - 1, 18, 11, PALETTE.stoneDeep);
  painter.ellipse(x + 19, baseY - 4, 15, 8, PALETTE.stone);
  painter.ellipse(x + 19, baseY - 5, 10, 5, PALETTE.waterDeep);
  painter.hLine(x + 13, baseY - 7, 9, PALETTE.waterLight);
  painter.vLine(x + 43, baseY - 36, 31, PALETTE.hinokiDark, 4);
  painter.vLine(x + 44, baseY - 35, 27, PALETTE.hinokiLight);
  painter.rect(x + 23, baseY - 32, 24, 5, PALETTE.hinoki);
  painter.hLine(x + 24, baseY - 32, 20, PALETTE.hinokiLight);
  painter.rect(x + 21, baseY - 31, 5, 7, PALETTE.hinokiDark);
  painter.pixel(x + 22, baseY - 22, PALETTE.waterLight);
  painter.pixel(x + 21, baseY - 17, PALETTE.waterLight);
}

function paintAzumaya(
  painter: PixelPainter,
  x: number,
  baseY: number,
): void {
  painter.ellipse(x + 54, baseY + 3, 60, 8, PALETTE.leafDeep, 0.22);
  painter.rect(x + 12, baseY - 55, 6, 55, PALETTE.hinokiDark);
  painter.vLine(x + 14, baseY - 53, 51, PALETTE.hinoki);
  painter.rect(x + 89, baseY - 55, 6, 55, PALETTE.hinokiDark);
  painter.vLine(x + 91, baseY - 53, 51, PALETTE.hinoki);
  painter.polygon(
    [
      [x - 5, baseY - 54],
      [x + 51, baseY - 83],
      [x + 112, baseY - 52],
      [x + 104, baseY - 45],
      [x + 4, baseY - 45],
    ],
    PALETTE.inkDeep,
  );
  painter.polygon(
    [
      [x + 2, baseY - 56],
      [x + 51, baseY - 78],
      [x + 104, baseY - 54],
      [x + 99, baseY - 50],
      [x + 7, baseY - 50],
    ],
    PALETTE.indigoDeep,
  );
  painter.hLine(x + 10, baseY - 51, 88, PALETTE.indigoLight, 2);
  painter.vLine(x + 31, baseY - 48, 13, PALETTE.hinokiDark);
  painter.rect(x + 25, baseY - 36, 13, 12, PALETTE.hinokiDark);
  painter.rect(x + 28, baseY - 34, 7, 7, PALETTE.glow);
  painter.hLine(x + 24, baseY - 25, 15, PALETTE.amberLight, 2);
  painter.rect(x + 20, baseY - 18, 68, 7, PALETTE.hinoki);
  painter.hLine(x + 22, baseY - 18, 64, PALETTE.hinokiLight, 2);
  painter.rect(x + 27, baseY - 11, 5, 14, PALETTE.hinokiDark);
  painter.rect(x + 77, baseY - 11, 5, 14, PALETTE.hinokiDark);
  painter.rect(x + 46, baseY - 25, 18, 6, PALETTE.washi);
  painter.hLine(x + 48, baseY - 25, 14, PALETTE.indigo);
  painter.rect(x + 70, baseY - 25, 8, 6, PALETTE.ceramic);
  painter.pixel(x + 73, baseY - 23, PALETTE.amber);
  painter.rect(x + 5, baseY - 2, 99, 6, PALETTE.hinokiDark);
  for (let boardX = x + 10; boardX < x + 100; boardX += 18) {
    painter.vLine(boardX, baseY - 1, 4, PALETTE.hinoki);
  }
}

function paintRoomFurniture(painter: PixelPainter, width: number, floorY: number): void {
  // Low desk vignette; major movable furniture is registered separately.
  const deskX = Math.floor(width * 0.48);
  const deskY = floorY + 70;
  painter.ellipse(deskX + 35, deskY + 26, 47, 8, PALETTE.inkDeep, 0.22);
  painter.ellipse(deskX + 35, deskY + 31, 35, 8, PALETTE.tatamiShadow, 0.52);
  painter.rect(deskX, deskY, 70, 19, PALETTE.hinokiDark);
  painter.rect(deskX + 2, deskY - 3, 66, 16, PALETTE.hinoki);
  painter.hLine(deskX + 3, deskY - 3, 64, PALETTE.hinokiLight, 2);
  painter.rect(deskX + 5, deskY + 12, 4, 13, PALETTE.hinokiDark);
  painter.rect(deskX + 61, deskY + 12, 4, 13, PALETTE.hinokiDark);
  // Open notebook, tea, and tiny lamp create a readable study focal point.
  painter.polygon(
    [
      [deskX + 17, deskY - 5],
      [deskX + 28, deskY - 7],
      [deskX + 29, deskY + 1],
      [deskX + 17, deskY + 2],
    ],
    PALETTE.washi,
  );
  painter.polygon(
    [
      [deskX + 29, deskY - 7],
      [deskX + 40, deskY - 5],
      [deskX + 40, deskY + 2],
      [deskX + 29, deskY + 1],
    ],
    PALETTE.washiShadow,
  );
  painter.vLine(deskX + 29, deskY - 6, 7, PALETTE.indigo);
  painter.rect(deskX + 51, deskY - 5, 8, 6, PALETTE.ceramic);
  painter.pixel(deskX + 54, deskY - 3, PALETTE.amber);
  painter.vLine(deskX + 54, deskY - 12, 5, PALETTE.washi, 1);
  painter.vLine(deskX + 57, deskY - 14, 7, PALETTE.washiShadow, 1);
  painter.rect(deskX + 62, deskY - 7, 5, 8, PALETTE.indigoDeep);
  painter.hLine(deskX + 63, deskY - 5, 3, PALETTE.washi);
  // Zabuton.
  painter.ellipse(deskX + 35, deskY + 36, 16, 6, PALETTE.indigoDeep);
  painter.rect(deskX + 21, deskY + 29, 29, 9, PALETTE.indigo);
  painter.hLine(deskX + 23, deskY + 29, 25, PALETTE.indigoLight);
  painter.pixel(deskX + 35, deskY + 33, PALETTE.washi);

  // Low reading shelf: enough visual life to establish the room's purpose
  // while preserving a broad central placement area.
  const shelfX = deskX - 78;
  const shelfY = floorY + 45;
  painter.ellipse(shelfX + 31, shelfY + 37, 34, 5, PALETTE.inkDeep, 0.2);
  painter.rect(shelfX, shelfY, 61, 34, PALETTE.hinokiDark);
  painter.rect(shelfX + 3, shelfY + 3, 55, 27, PALETTE.soil);
  painter.hLine(shelfX + 3, shelfY + 16, 55, PALETTE.hinoki, 3);
  for (let row = 0; row < 2; row += 1) {
    let bookX = shelfX + 6;
    while (bookX < shelfX + 53) {
      const bookWidth = 3 + ((bookX + row) % 3);
      const bookHeight = 7 + ((bookX * 3 + row) % 5);
      const color = [
        PALETTE.indigo,
        PALETTE.vermilionDark,
        PALETTE.tatamiShadow,
        PALETTE.washiShadow,
      ][(bookX + row) % 4]!;
      const baseline = shelfY + 15 + row * 14;
      painter.rect(bookX, baseline - bookHeight, bookWidth, bookHeight, color);
      painter.hLine(bookX, baseline - bookHeight, bookWidth, PALETTE.washi);
      bookX += bookWidth + 2;
    }
  }
  painter.rect(shelfX + 5, shelfY + 31, 7, 4, PALETTE.inkDeep);
  painter.rect(shelfX + 49, shelfY + 31, 7, 4, PALETTE.inkDeep);

  // Andon and plant complete one concentrated study nook instead of floating
  // as isolated icons across the room.
  const lampX = deskX + 76;
  const lampY = floorY + 47;
  painter.ellipse(lampX + 13, lampY + 38, 15, 4, PALETTE.inkDeep, 0.2);
  painter.rect(lampX + 4, lampY + 2, 19, 34, PALETTE.hinokiDark);
  painter.rect(lampX + 7, lampY + 5, 13, 26, PALETTE.glow);
  painter.vLine(lampX + 13, lampY + 4, 29, PALETTE.hinoki, 2);
  painter.hLine(lampX + 5, lampY + 14, 17, PALETTE.hinoki, 2);
  painter.hLine(lampX + 5, lampY + 25, 17, PALETTE.hinoki, 2);
  painter.rect(lampX + 1, lampY + 34, 25, 4, PALETTE.hinokiDark);

  const plantX = deskX + 122;
  const plantY = floorY + 91;
  painter.ellipse(plantX + 16, plantY + 26, 17, 4, PALETTE.inkDeep, 0.18);
  painter.rect(plantX + 9, plantY + 14, 14, 13, PALETTE.vermilionDark);
  painter.hLine(plantX + 10, plantY + 14, 12, PALETTE.vermilionLight, 2);
  painter.vLine(plantX + 16, plantY - 10, 25, PALETTE.leafDeep, 2);
  painter.ellipse(plantX + 8, plantY - 3, 10, 4, PALETTE.leaf);
  painter.ellipse(plantX + 23, plantY - 7, 10, 4, PALETTE.leafLight);
  painter.ellipse(plantX + 10, plantY + 7, 9, 4, PALETTE.leafDark);
  painter.ellipse(plantX + 24, plantY + 5, 8, 4, PALETTE.leaf);

  // A tiny sleeping cat adds warmth without becoming an interaction affordance.
  const catX = Math.floor(width * 0.69);
  const catY = floorY + 137;
  painter.ellipse(catX + 10, catY + 8, 14, 4, PALETTE.inkDeep, 0.16);
  painter.ellipse(catX + 11, catY + 4, 11, 6, PALETTE.ceramic);
  painter.circle(catX + 2, catY, 5, PALETTE.ceramic);
  painter.polygon(
    [
      [catX - 2, catY - 3],
      [catX, catY - 8],
      [catX + 3, catY - 2],
    ],
    PALETTE.ceramicShadow,
  );
  painter.hLine(catX - 1, catY + 1, 3, PALETTE.inkSoft);
  painter.line(catX + 20, catY + 3, catX + 25, catY - 2, PALETTE.ceramicShadow, 2);
}

export function paintJapaneseRoom(
  painter: PixelPainter,
  width: number,
  height: number,
  seed: string | number,
  furnished: boolean,
): void {
  painter.rect(0, 0, width, height, PALETTE.inkDeep);
  painter.rect(8, 8, width - 16, height - 16, PALETTE.hinokiDark);

  const floorY = 82;
  paintPlaster(painter, 12, 12, width - 24, floorY - 12, { seed });
  painter.rect(12, floorY - 5, width - 24, 7, PALETTE.hinokiDark);
  painter.hLine(12, floorY - 5, width - 24, PALETTE.hinokiLight, 2);

  // Tokonoma: asymmetric, quiet, and distinctly domestic.
  const alcoveX = 26;
  painter.rect(alcoveX, 20, 91, 55, PALETTE.hinokiDark);
  painter.rect(alcoveX + 5, 23, 82, 47, PALETTE.washiShadow);
  painter.vLine(alcoveX + 23, 23, 47, PALETTE.hinoki);
  painter.rect(alcoveX + 8, 27, 11, 31, PALETTE.washi);
  painter.hLine(alcoveX + 10, 31, 7, PALETTE.indigo);
  painter.hLine(alcoveX + 10, 37, 5, PALETTE.indigoLight);
  painter.hLine(alcoveX + 10, 42, 7, PALETTE.indigo);
  painter.rect(alcoveX + 42, 57, 26, 5, PALETTE.hinoki);
  painter.rect(alcoveX + 51, 43, 7, 14, PALETTE.ceramicShadow);
  painter.rect(alcoveX + 49, 44, 11, 10, PALETTE.ceramic);
  painter.line(alcoveX + 54, 44, alcoveX + 46, 34, PALETTE.leafDark);
  painter.line(alcoveX + 54, 43, alcoveX + 63, 31, PALETTE.leafDark);
  painter.rect(alcoveX + 42, 32, 8, 3, PALETTE.leaf);
  painter.rect(alcoveX + 61, 29, 9, 3, PALETTE.leafLight);

  // Garden-facing shoji is the room's luminous hero element.
  const shojiWidth = Math.min(206, Math.floor(width * 0.43));
  paintShoji(painter, width - shojiWidth - 24, 18, shojiWidth, 59, {
    seed,
    glow: true,
  });
  painter.rect(width - shojiWidth / 2 - 27, 18, 4, 59, PALETTE.hinokiDark);
  painter.rect(width - shojiWidth - 34, 13, 7, 69, PALETTE.hinokiDark);

  // A carved ranma panel bridges the calm tokonoma and the luminous shoji.
  // Its asymmetry makes the wall feel like an authored home rather than a
  // repeated facade tile.
  const ranmaX = alcoveX + 105;
  const ranmaWidth = Math.max(54, width - shojiWidth - ranmaX - 46);
  painter.rect(ranmaX, 25, ranmaWidth, 25, PALETTE.hinokiDark);
  painter.rect(ranmaX + 4, 28, ranmaWidth - 8, 18, PALETTE.washiShadow);
  for (let x = ranmaX + 8; x < ranmaX + ranmaWidth - 7; x += 13) {
    painter.line(x, 44, x + 9, 29, PALETTE.hinoki);
    painter.line(x + 3, 29, x + 12, 44, PALETTE.hinokiLight);
  }
  painter.rect(ranmaX + 8, 57, 37, 13, PALETTE.indigoDeep);
  painter.hLine(ranmaX + 12, 60, 28, PALETTE.washi, 2);
  painter.hLine(ranmaX + 17, 65, 19, PALETTE.indigoLight);

  // Six large mats form a traditional, legible room composition. Keeping the
  // weave inside a few generous modules avoids the former spreadsheet-like
  // repetition while leaving the middle two mats free for customization.
  painter.rect(12, floorY + 2, width - 24, height - floorY - 12, PALETTE.tatamiDark);
  const matX = 20;
  const matY = floorY + 7;
  const matHeight = height - matY - 28;
  const sideMatWidth = 72;
  const middleWidth = width - matX * 2 - sideMatWidth * 2;
  const halfMiddle = Math.floor(middleWidth / 2);
  const halfHeight = Math.floor(matHeight / 2);
  paintTatami(painter, matX, matY, sideMatWidth, matHeight, { seed, variant: 0 });
  paintTatami(painter, matX + sideMatWidth, matY, halfMiddle, halfHeight, {
    seed,
    variant: 1,
  });
  paintTatami(
    painter,
    matX + sideMatWidth + halfMiddle,
    matY,
    middleWidth - halfMiddle,
    halfHeight,
    { seed, variant: 2 },
  );
  paintTatami(painter, matX + sideMatWidth, matY + halfHeight, halfMiddle, matHeight - halfHeight, {
    seed,
    variant: 3,
  });
  paintTatami(
    painter,
    matX + sideMatWidth + halfMiddle,
    matY + halfHeight,
    middleWidth - halfMiddle,
    matHeight - halfHeight,
    { seed, variant: 4 },
  );
  paintTatami(painter, width - matX - sideMatWidth, matY, sideMatWidth, matHeight, {
    seed,
    variant: 5,
  });
  painter.frame(matX - 3, matY - 3, width - matX * 2 + 6, matHeight + 6, PALETTE.hinokiDark, 3);
  painter.hLine(matX + sideMatWidth + 5, matY + halfHeight - 1, middleWidth - 10, PALETTE.hinoki, 2);

  // Structural posts and the engawa threshold.
  painter.rect(8, 8, 8, height - 16, PALETTE.hinokiDark);
  painter.vLine(14, 9, height - 18, PALETTE.hinoki, 2);
  painter.rect(width - 16, 8, 8, height - 16, PALETTE.hinokiDark);
  painter.rect(8, 8, width - 16, 8, PALETTE.hinokiDark);
  paintWood(painter, 12, height - 22, width - 24, 10, { seed, dark: true });
  painter.hLine(12, height - 23, width - 24, PALETTE.washiShadow, 2);

  if (furnished) paintRoomFurniture(painter, width, floorY);
  paintDapple(
    painter,
    Math.floor(width * 0.54),
    floorY + 12,
    Math.floor(width * 0.34),
    height - floorY - 44,
    seed,
  );

  if (furnished) {
    // A close foreground fern quietly occludes the threshold and gives the
    // otherwise flat room a front render band without stealing usable space.
    const fernX = width - 29;
    const fernBaseY = height - 12;
    painter.ellipse(fernX, fernBaseY, 27, 6, PALETTE.inkDeep, 0.24);
    painter.rect(fernX - 10, fernBaseY - 12, 20, 13, PALETTE.soilDeep);
    painter.hLine(fernX - 8, fernBaseY - 12, 16, PALETTE.vermilionDark, 3);
    for (let index = 0; index < 7; index += 1) {
      const reach = 12 + (index % 3) * 6;
      const direction = index % 2 === 0 ? -1 : 1;
      const leafY = fernBaseY - 21 - index * 5;
      painter.line(fernX, fernBaseY - 11, fernX + direction * reach, leafY, PALETTE.leafDeep, 2);
      painter.ellipse(
        fernX + direction * reach,
        leafY,
        10,
        4,
        index % 3 === 0 ? PALETTE.leafLight : PALETTE.leaf,
      );
    }
  }
}

export function paintGarden(
  painter: PixelPainter,
  width: number,
  height: number,
  seed: string | number,
  season: Season,
): void {
  const horizonY = 72;
  painter.rect(0, 0, width, height, PALETTE.sky);
  painter.hLine(0, horizonY - 13, width, PALETTE.skyLight, 13);
  paintCloud(painter, 34, 21, 55);
  paintCloud(painter, width - 123, 32, 74, PALETTE.skyLight);
  paintDistantHills(painter, width, horizonY + 20);
  paintGrass(painter, 0, horizonY + 15, width, height - horizonY - 15, {
    seed,
    autumn: season === "autumn",
    snow: season === "winter",
  });

  // House facade, rain chain, and broad engawa keep a visible, continuous
  // relationship to the player's room rather than treating the garden as a
  // detached generic lawn.
  painter.rect(0, 40, 183, 93, PALETTE.hinokiDark);
  paintPlaster(painter, 7, 50, 170, 70, { seed: `${seed}:house` });
  paintShoji(painter, 17, 57, 66, 61, { seed });
  paintShoji(painter, 91, 57, 66, 61, { seed, glow: true });
  painter.rect(163, 53, 8, 65, PALETTE.hinokiDark);
  paintRoofTiles(painter, 0, 30, 191, 22, { seed });
  painter.polygon(
    [
      [0, 27],
      [89, 8],
      [193, 28],
      [185, 35],
      [4, 35],
    ],
    PALETTE.inkSoft,
  );
  painter.hLine(7, 32, 174, PALETTE.inkLift, 2);
  paintWood(painter, 0, 121, 198, 22, { seed, dark: true });
  painter.hLine(0, 121, 198, PALETTE.hinokiLight, 2);
  for (let x = 13; x < 194; x += 32) painter.rect(x, 141, 5, 17, PALETTE.hinokiDark);
  painter.vLine(180, 50, 94, PALETTE.stoneDeep, 2);
  for (let chainY = 58; chainY < 143; chainY += 7) {
    painter.rect(chainY % 14 === 0 ? 178 : 180, chainY, 3, 4, PALETTE.stoneLight);
  }
  painter.ellipse(180, 150, 13, 5, PALETTE.stoneDeep);
  painter.ellipse(180, 148, 10, 3, PALETTE.water);

  // A low bamboo fence and clipped hedge define the private boundary. They
  // sit behind the hero maple and leave the central approach open.
  paintBambooFence(painter, width - 142, 91, 126, 45);
  paintGardenShrub(painter, width - 150, 143, 72, `${seed}:back-hedge`, false);
  painter.ellipse(width - 91, 145, 69, 19, PALETTE.leafDeep, 0.26);
  painter.ellipse(width - 91, 140, 64, 17, PALETTE.leafDark);
  painter.hLine(width - 123, 134, 24, PALETTE.leafLight, 2);

  // The pond is built as a dark stone lip, moss shelf, water, reeds, and
  // individual shoreline rocks so its edge reads as a material transition.
  const pondX = Math.floor(width * 0.58);
  const pondY = Math.floor(height * 0.57);
  painter.ellipse(pondX + 72, pondY + 45, 92, 49, PALETTE.leafDeep, 0.3);
  painter.ellipse(pondX + 71, pondY + 43, 88, 46, PALETTE.stoneDeep);
  painter.ellipse(pondX + 69, pondY + 40, 82, 40, PALETTE.waterDeep);
  painter.ellipse(pondX + 67, pondY + 38, 76, 35, PALETTE.water);
  paintWater(painter, pondX + 13, pondY + 26, 113, 34, { seed });
  painter.ellipse(pondX + 61, pondY + 38, 48, 22, PALETTE.water, 0.82);
  painter.hLine(pondX + 28, pondY + 25, 26, PALETTE.waterLight);
  painter.hLine(pondX + 75, pondY + 49, 30, PALETTE.waterLight);
  painter.hLine(pondX + 48, pondY + 60, 17, PALETTE.waterDeep);
  painter.ellipse(pondX + 9, pondY + 24, 23, 9, PALETTE.leafDark);
  painter.ellipse(pondX + 13, pondY + 21, 16, 6, PALETTE.leaf);
  painter.ellipse(pondX + 132, pondY + 62, 21, 9, PALETTE.leafDeep);
  painter.hLine(pondX + 124, pondY + 57, 13, PALETTE.leafLight);
  const pondRocks = [
    [pondX + 2, pondY + 42, 11, 6],
    [pondX + 24, pondY + 72, 13, 7],
    [pondX + 57, pondY + 81, 15, 7],
    [pondX + 102, pondY + 72, 12, 7],
    [pondX + 139, pondY + 53, 14, 8],
    [pondX + 126, pondY + 15, 12, 7],
  ] as const;
  pondRocks.forEach(([rockX, rockY, radiusX, radiusY], index) => {
    painter.ellipse(rockX, rockY + 2, radiusX + 2, radiusY + 1, PALETTE.leafDeep, 0.3);
    painter.ellipse(
      rockX,
      rockY,
      radiusX,
      radiusY,
      index % 2 === 0 ? PALETTE.stone : PALETTE.stoneLight,
    );
    painter.hLine(rockX - 4, rockY - 2, 7, PALETTE.stoneSun);
  });
  painter.ellipse(pondX + 96, pondY + 26, 10, 4, PALETTE.leafDark);
  painter.hLine(pondX + 91, pondY + 25, 8, PALETTE.leafLight);
  painter.rect(pondX + 96, pondY + 21, 5, 4, PALETTE.sakura);
  paintReeds(painter, pondX + 4, pondY + 56, 8, `${seed}:pond-left`);
  paintReeds(painter, pondX + 127, pondY + 50, 6, `${seed}:pond-right`);

  // Curving stepping stones guide a traversal route from the engawa to the
  // basin. Their varied sizes and moss shadows keep the route handmade.
  const stones = [
    [164, 169, 14, 7],
    [190, 181, 12, 6],
    [214, 199, 15, 7],
    [237, 219, 13, 6],
    [264, 235, 16, 7],
  ] as const;
  stones.forEach(([x, y, rx, ry], index) => {
    painter.ellipse(x, y + 2, rx + 2, ry + 2, PALETTE.leafDeep, 0.24);
    painter.ellipse(x, y, rx, ry, index & 1 ? PALETTE.stone : PALETTE.stoneLight);
    painter.hLine(x - rx + 4, y - 2, rx, PALETTE.stoneSun);
  });

  // Tea-garden focal cluster: a lantern, tsukubai, and bamboo spout make this
  // unmistakably a lived-in Japanese garden rather than an outdoor item grid.
  paintStoneLantern(painter, 188, 161);
  paintGardenShrub(painter, 205, 177, 52, `${seed}:basin-shrub`, true);
  paintTsukubai(painter, 221, 169);
  paintBamboo(painter, width - 26, 153, 94);
  paintBamboo(painter, width - 45, 146, 76);
  painter.ellipse(width - 99, 169, 76, 16, PALETTE.inkDeep, 0.16);
  painter.ellipse(width - 123, 160, 24, 7, PALETTE.leafDeep, 0.22);
  painter.ellipse(width - 66, 166, 20, 6, PALETTE.leafDeep, 0.18);
  paintTree(painter, width - 83, 158, 96, season, `${seed}:hero`);

  // Asymmetric near foliage gives a front layer while preserving the broad
  // grass pocket between the stepping stones and pond for customization.
  paintGardenShrub(painter, -10, height - 7, 88, `${seed}:foreground-left`, true);
  paintGardenShrub(painter, width - 82, height - 4, 96, `${seed}:foreground-right`, false);
  painter.ellipse(92, height - 8, 38, 9, PALETTE.leafDeep);
  painter.ellipse(91, height - 11, 34, 8, PALETTE.leafDark);
  painter.hLine(73, height - 16, 18, PALETTE.leafLight, 2);
  paintDapple(painter, 126, 148, 164, height - 163, seed, PALETTE.washi);
}

export function paintCafe(
  painter: PixelPainter,
  width: number,
  height: number,
  seed: string | number,
): void {
  painter.rect(0, 0, width, height, PALETTE.inkDeep);
  paintPlaster(painter, 8, 8, width - 16, 91, { seed });
  painter.rect(8, 92, width - 16, height - 100, PALETTE.soilDeep);
  paintWood(painter, 12, 98, width - 24, height - 110, { seed, dark: true });

  // Dark wainscot, brass rail, and shallow skirting separate plaster from the
  // floor with a convincingly material-specific edge.
  painter.rect(12, 86, width - 24, 31, PALETTE.soilDeep);
  painter.hLine(12, 86, width - 24, PALETTE.hinokiLight, 3);
  painter.hLine(12, 112, width - 24, PALETTE.inkDeep, 5);
  for (let panelX = 18; panelX < width - 20; panelX += 48) {
    painter.frame(panelX, 91, 41, 17, PALETTE.hinokiDark, 2);
    painter.hLine(panelX + 4, 95, 30, PALETTE.soilLight);
  }

  // Large streetside window with roof silhouettes, a planter ledge, and warm
  // reflections. This is the cafe's daylight focal plane.
  painter.rect(20, 16, 186, 72, PALETTE.inkDeep);
  painter.rect(25, 21, 176, 62, PALETTE.sky);
  painter.withOffset(25, 21, (windowPainter) => {
    paintDistantHills(windowPainter, 176, 47);
    windowPainter.rect(0, 42, 176, 20, PALETTE.leafDark);
    windowPainter.polygon(
      [
        [4, 47],
        [35, 34],
        [68, 47],
        [63, 52],
        [7, 52],
      ],
      PALETTE.indigoDeep,
    );
    windowPainter.rect(11, 47, 49, 15, PALETTE.hinokiDark);
    windowPainter.polygon(
      [
        [114, 48],
        [144, 37],
        [174, 49],
        [170, 53],
        [119, 53],
      ],
      PALETTE.inkSoft,
    );
  });
  painter.vLine(111, 19, 66, PALETTE.hinokiDark, 4);
  painter.hLine(23, 53, 180, PALETTE.hinokiDark, 3);
  painter.hLine(28, 24, 77, PALETTE.skyLight, 2);
  painter.hLine(24, 84, 180, PALETTE.hinoki, 5);
  painter.rect(38, 77, 43, 7, PALETTE.soilDeep);
  painter.ellipse(48, 73, 12, 6, PALETTE.leafDark);
  painter.ellipse(65, 72, 14, 7, PALETTE.leaf);
  painter.ellipse(78, 75, 9, 5, PALETTE.leafLight);
  // A rain-window-style booth anchors the intended long-form study fantasy.
  // It overlaps the wainscot and front table as one coherent nook.
  painter.rect(29, 105, 171, 32, PALETTE.soilDeep);
  painter.rect(34, 109, 161, 22, PALETTE.indigoDeep);
  painter.hLine(37, 111, 155, PALETTE.indigoLight, 2);
  for (let seamX = 61; seamX < 190; seamX += 31) {
    painter.vLine(seamX, 111, 18, PALETTE.indigo, 2);
    painter.pixel(seamX + 1, 120, PALETTE.washiShadow);
  }
  painter.rect(32, 130, 165, 13, PALETTE.hinokiDark);
  painter.rect(36, 128, 157, 10, PALETTE.soilLight);
  painter.hLine(39, 128, 151, PALETTE.hinokiLight, 2);

  // Handwritten kissaten menu board and a shelf of individually lit cups.
  painter.rect(220, 17, 126, 54, PALETTE.hinokiDark);
  painter.rect(225, 22, 116, 44, PALETTE.inkSoft);
  painter.hLine(232, 28, 45, PALETTE.washi, 2);
  painter.hLine(232, 35, 81, PALETTE.washiShadow);
  painter.hLine(232, 41, 63, PALETTE.washiShadow);
  painter.hLine(232, 49, 76, PALETTE.amberLight);
  painter.hLine(232, 56, 52, PALETTE.washiShadow);
  painter.rect(312, 29, 17, 12, PALETTE.vermilionDark);
  painter.rect(314, 31, 13, 8, PALETTE.washi);
  painter.hLine(211, 77, 135, PALETTE.hinokiDark, 5);
  for (let cupX = 221; cupX < 337; cupX += 23) {
    painter.rect(cupX, 68, 12, 9, cupX % 2 === 0 ? PALETTE.ceramic : PALETTE.washiShadow);
    painter.hLine(cupX + 2, 68, 8, PALETTE.washi);
    painter.rect(cupX + 11, 71, 4, 4, PALETTE.hinokiDark);
  }

  // Indigo noren marks the staff doorway and keeps the right wall distinctly
  // Japanese without using borrowed characters or logos.
  paintIndigoFabric(painter, width - 116, 12, 82, 53, { seed });
  for (let x = width - 116; x < width - 34; x += 20) {
    painter.vLine(x, 12, 52, PALETTE.indigoDeep);
  }
  painter.hLine(width - 101, 28, 10, PALETTE.washi);
  painter.vLine(width - 97, 22, 20, PALETTE.washi);
  painter.hLine(width - 74, 37, 13, PALETTE.washiShadow);
  painter.vLine(width - 69, 24, 19, PALETTE.washiShadow);

  // Deep mahogany counter, panelled face, stools, and twin-globe siphon form a
  // compact kissaten storytelling cluster.
  const counterX = width - 181;
  painter.rect(counterX, 91, 169, 44, PALETTE.hinokiDark);
  painter.rect(counterX + 3, 86, 163, 18, PALETTE.hinoki);
  painter.hLine(counterX + 5, 86, 159, PALETTE.hinokiLight, 3);
  for (let panelX = counterX + 9; panelX < width - 24; panelX += 36) {
    painter.frame(panelX, 109, 29, 20, PALETTE.soilDeep, 2);
    painter.hLine(panelX + 4, 114, 21, PALETTE.soilLight);
  }
  const brewerX = counterX + 24;
  painter.rect(brewerX, 75, 43, 11, PALETTE.inkSoft);
  painter.vLine(brewerX + 8, 51, 25, PALETTE.amberDeep, 3);
  painter.vLine(brewerX + 31, 49, 27, PALETTE.amberDeep, 3);
  painter.hLine(brewerX + 6, 51, 29, PALETTE.amberLight, 2);
  painter.circle(brewerX + 9, 61, 8, PALETTE.ceramicShadow);
  painter.circle(brewerX + 9, 60, 5, PALETTE.waterLight);
  painter.circle(brewerX + 31, 59, 8, PALETTE.ceramicShadow);
  painter.circle(brewerX + 31, 60, 5, PALETTE.soilLight);
  painter.hLine(brewerX + 4, 71, 33, PALETTE.amber);
  painter.vLine(brewerX + 10, 43, 6, PALETTE.washiShadow);
  painter.vLine(brewerX + 12, 40, 7, PALETTE.washi);
  painter.rect(counterX + 83, 78, 21, 8, PALETTE.ceramic);
  painter.ellipse(counterX + 93, 77, 10, 4, PALETTE.ceramicShadow);
  painter.ellipse(counterX + 121, 76, 12, 9, PALETTE.ceramicShadow, 0.78);
  painter.rect(counterX + 114, 77, 15, 7, PALETTE.vermilionDark);
  painter.rect(counterX + 117, 74, 9, 4, PALETTE.sakuraLight);
  painter.hLine(counterX + 111, 84, 21, PALETTE.amberLight, 2);
  painter.rect(counterX + 139, 75, 17, 11, PALETTE.ceramicShadow);
  [counterX + 25, counterX + 79, counterX + 135].forEach((stoolX, index) => {
    painter.ellipse(stoolX, 157, 17, 5, PALETTE.inkDeep, 0.25);
    painter.ellipse(stoolX, 144, 14, 6, index === 1 ? PALETTE.vermilionDark : PALETTE.indigoDeep);
    painter.hLine(stoolX - 10, 141, 20, index === 1 ? PALETTE.vermilion : PALETTE.indigoLight, 2);
    painter.rect(stoolX - 3, 148, 6, 13, PALETTE.hinokiDark);
  });

  // A straight woven runner now shares the room's orthographic camera
  // language. It defines the central aisle without implying a conflicting
  // vanishing point.
  painter.rect(190, 145, 64, height - 157, PALETTE.indigoDeep, 0.58);
  painter.frame(193, 148, 58, height - 163, PALETTE.indigo, 2);
  painter.vLine(200, 153, height - 175, PALETTE.indigoLight);
  painter.vLine(244, 153, height - 175, PALETTE.indigoLight);
  for (let y = 160; y < height - 18; y += 18) {
    painter.hLine(204, y, 37, PALETTE.indigo, 1);
    painter.pixel(222, y + 6, PALETTE.washiShadow);
  }

  // Two asymmetric study tables sit outside the aisle. Their chairs and
  // notebooks tell the intended use without consuming all customization room.
  const tables = [
    [45, 153, 82, PALETTE.soilLight],
    [319, 184, 89, PALETTE.hinoki],
  ] as const;
  tables.forEach(([x, y, tableWidth, topColor], index) => {
    painter.ellipse(x + Math.floor(tableWidth / 2), y + 39, Math.floor(tableWidth / 2) + 9, 9, PALETTE.inkDeep, 0.27);
    painter.rect(x, y, tableWidth, 20, PALETTE.hinokiDark);
    painter.rect(x + 2, y - 3, tableWidth - 4, 16, topColor);
    painter.hLine(x + 4, y - 3, tableWidth - 8, PALETTE.hinokiLight, 2);
    painter.rect(x + 7, y + 14, 6, 27, PALETTE.hinokiDark);
    painter.rect(x + tableWidth - 13, y + 14, 6, 27, PALETTE.hinokiDark);
    painter.rect(x + 18, y - 10, 25, 9, PALETTE.washi);
    painter.vLine(x + 30, y - 9, 7, PALETTE.indigo);
    painter.rect(x + tableWidth - 27, y - 8, 10, 8, PALETTE.ceramic);
    painter.hLine(x + tableWidth - 25, y - 8, 6, PALETTE.washi, 2);
    painter.vLine(x + tableWidth - 23, y - 16, 6, PALETTE.washiShadow);
    const chairY = y + (index === 0 ? 51 : 48);
    painter.rect(x + 19, chairY, 42, 13, index === 0 ? PALETTE.indigo : PALETTE.vermilionDark);
    painter.hLine(x + 22, chairY, 36, index === 0 ? PALETTE.indigoLight : PALETTE.vermilion, 2);
    painter.rect(x + 24, chairY + 12, 5, 13, PALETTE.inkSoft);
    painter.rect(x + 52, chairY + 12, 5, 13, PALETTE.inkSoft);
  });

  // Hanging lights: geometric glow, never blurred.
  [61, 211, 354].forEach((x, index) => {
    painter.vLine(x, 7, 28 + index * 3, PALETTE.inkSoft);
    painter.polygon(
      [
        [x - 8, 35 + index * 3],
        [x + 8, 35 + index * 3],
        [x + 12, 42 + index * 3],
        [x - 12, 42 + index * 3],
      ],
      PALETTE.amber,
    );
    painter.rect(x - 7, 41 + index * 3, 15, 3, PALETTE.glow, 0.9);
  });

  // The clipped foreground plant establishes depth without implying a broken
  // or unreachable seat at the opposite edge.
  painter.ellipse(14, height - 4, 34, 8, PALETTE.inkDeep, 0.26);
  painter.rect(0, height - 27, 23, 25, PALETTE.vermilionDark);
  painter.hLine(0, height - 27, 23, PALETTE.vermilionLight, 3);
  for (let index = 0; index < 7; index += 1) {
    const leafX = 7 + (index % 2 === 0 ? index * 5 : -index * 3);
    const leafY = height - 38 - index * 6;
    painter.line(10, height - 25, leafX, leafY, PALETTE.leafDeep, 2);
    painter.ellipse(leafX, leafY, 11, 4, index % 2 === 0 ? PALETTE.leaf : PALETTE.leafLight);
  }
  paintDapple(painter, 24, 106, 142, 82, seed, PALETTE.amberLight);
}

export function paintPark(
  painter: PixelPainter,
  width: number,
  height: number,
  seed: string | number,
  season: Season,
): void {
  painter.rect(0, 0, width, height, PALETTE.sky);
  painter.rect(0, 60, width, height - 60, PALETTE.leaf);
  paintDistantHills(painter, width, 76);
  paintGrass(painter, 0, 79, width, height - 79, {
    seed,
    autumn: season === "autumn",
    snow: season === "winter",
  });
  paintCloud(painter, 108, 19, 68);
  paintCloud(painter, 318, 28, 48, PALETTE.skyLight);

  // A narrower S-path connects the entrance to a Japanese azumaya. Dark
  // shoulders and hand-set curb stones keep the pale path from looking like a
  // flat ribbon laid on the grass.
  painter.polygon(
    [
      [146, height],
      [302, height],
      [288, 244],
      [231, 221],
      [239, 201],
      [302, 180],
      [338, 161],
      [348, 143],
      [337, 127],
      [304, 108],
      [262, 96],
      [226, 94],
      [205, 101],
      [229, 111],
      [267, 119],
      [294, 132],
      [303, 144],
      [289, 154],
      [226, 178],
      [199, 201],
      [207, 228],
    ],
    PALETTE.stoneDeep,
  );
  painter.polygon(
    [
      [162, height],
      [284, height],
      [272, 251],
      [215, 227],
      [214, 207],
      [245, 188],
      [304, 169],
      [328, 153],
      [331, 143],
      [320, 131],
      [293, 118],
      [257, 106],
      [229, 102],
      [245, 110],
      [278, 121],
      [307, 137],
      [314, 147],
      [298, 160],
      [235, 182],
      [208, 204],
      [222, 231],
    ],
    PALETTE.stoneSun,
  );
  const random = createSeededRandom(seedFrom("park-path", seed));
  for (let index = 0; index < 24; index += 1) {
    painter.rect(
      random.int(202, 304),
      random.int(118, height - 8),
      random.int(1, 3),
      1,
      index % 3 === 0 ? PALETTE.stoneLight : PALETTE.stone,
    );
  }
  const pathCurbStones = [
    [219, 115, 12],
    [298, 133, 14],
    [300, 164, 13],
    [226, 190, 15],
    [206, 218, 14],
    [235, 239, 16],
    [280, 255, 15],
  ] as const;
  pathCurbStones.forEach(([curbX, curbY, radius], index) => {
    painter.ellipse(curbX, curbY + 2, radius, 4, PALETTE.leafDeep, 0.24);
    painter.ellipse(
      curbX,
      curbY,
      radius - 2,
      3,
      index % 2 === 0 ? PALETTE.stone : PALETTE.stoneLight,
    );
  });

  // Pond and arched footbridge form a contrasting public-park landmark. The
  // rim is layered with an embankment, shoreline rocks, and reeds.
  painter.ellipse(68, 207, 81, 40, PALETTE.leafDeep, 0.28);
  painter.ellipse(67, 204, 77, 37, PALETTE.stoneDeep);
  painter.ellipse(65, 201, 71, 32, PALETTE.waterDeep);
  painter.ellipse(64, 198, 67, 28, PALETTE.water);
  painter.hLine(24, 188, 28, PALETTE.waterLight);
  painter.hLine(70, 207, 34, PALETTE.waterLight);
  painter.hLine(42, 218, 19, PALETTE.waterDeep);
  painter.ellipse(4, 184, 24, 9, PALETTE.leafDark);
  painter.hLine(1, 180, 18, PALETTE.leafLight);
  painter.ellipse(123, 217, 22, 9, PALETTE.leafDeep);
  const parkPondRocks = [
    [3, 202, 13, 7],
    [23, 226, 12, 6],
    [57, 235, 15, 7],
    [100, 229, 13, 7],
    [127, 209, 14, 7],
  ] as const;
  parkPondRocks.forEach(([rockX, rockY, radiusX, radiusY], index) => {
    painter.ellipse(rockX, rockY + 2, radiusX + 2, radiusY + 1, PALETTE.leafDeep, 0.25);
    painter.ellipse(
      rockX,
      rockY,
      radiusX,
      radiusY,
      index % 2 ? PALETTE.stone : PALETTE.stoneLight,
    );
    painter.hLine(rockX - 4, rockY - 2, 7, PALETTE.stoneSun);
  });
  paintReeds(painter, 0, 218, 7, `${seed}:park-reeds-left`);
  paintReeds(painter, 111, 221, 8, `${seed}:park-reeds-right`);
  painter.polygon(
    [
      [8, 192],
      [31, 170],
      [83, 162],
      [124, 180],
      [121, 190],
      [82, 175],
      [35, 182],
      [12, 200],
    ],
    PALETTE.vermilionDark,
  );
  painter.line(12, 189, 33, 166, PALETTE.vermilion, 3);
  painter.line(33, 166, 83, 158, PALETTE.vermilion, 3);
  painter.line(83, 158, 125, 177, PALETTE.vermilion, 3);
  painter.hLine(20, 190, 95, PALETTE.vermilionLight, 2);
  for (let x = 24; x < 119; x += 14) {
    painter.vLine(x, 164 + Math.floor(Math.abs(70 - x) / 5), 13, PALETTE.vermilionDark, 2);
  }

  // The azumaya and tiny open book make the park a believable public study
  // destination. It is deliberately pushed to the back-right to keep the lawn
  // and path junction clear.
  paintAzumaya(painter, width - 126, 158);
  paintGardenShrub(painter, width - 145, 169, 62, `${seed}:pavilion-shrub`, false);
  painter.vLine(width - 17, 120, 39, PALETTE.hinokiDark, 3);
  painter.circle(width - 16, 116, 7, PALETTE.amberDeep);
  painter.circle(width - 16, 116, 4, PALETTE.glow);

  // Asymmetric planting breaks the generic lawn while preserving a generous
  // playable pocket left of the path.
  painter.ellipse(37, 151, 63, 14, PALETTE.inkDeep, 0.15);
  painter.ellipse(165, 116, 47, 10, PALETTE.inkDeep, 0.12);
  paintTree(painter, 42, 145, 99, season, `${seed}:left`);
  paintTree(painter, 168, 112, 70, season, `${seed}:mid`);
  paintGardenShrub(painter, 92, 142, 42, `${seed}:mid-shrub`, season === "spring");
  paintGardenShrub(painter, 310, 203, 56, `${seed}:right-shrub`, false);
  paintTree(painter, width + 10, 235, 112, season, `${seed}:foreground-right`);
  paintGardenShrub(painter, -18, height - 2, 92, `${seed}:foreground-left`, false);
  paintGardenShrub(painter, width - 110, height + 2, 126, `${seed}:foreground-right`, true);

  // Public-park story details: bicycle rack and a small stone name marker,
  // abstracted at this scale without relying on readable text.
  painter.hLine(142, 156, 49, PALETTE.stoneDeep, 3);
  for (let rackX = 146; rackX < 190; rackX += 14) {
    painter.line(rackX, 156, rackX + 5, 147, PALETTE.stoneLight);
    painter.line(rackX + 5, 147, rackX + 10, 156, PALETTE.stoneLight);
  }
  painter.circle(155, 150, 7, PALETTE.inkSoft);
  painter.circle(155, 150, 5, PALETTE.leaf);
  painter.circle(178, 150, 7, PALETTE.inkSoft);
  painter.circle(178, 150, 5, PALETTE.leaf);
  painter.pixel(155, 150, PALETTE.stoneLight);
  painter.pixel(178, 150, PALETTE.stoneLight);
  painter.hLine(152, 150, 7, PALETTE.stone, 1);
  painter.vLine(155, 147, 7, PALETTE.stone, 1);
  painter.hLine(175, 150, 7, PALETTE.stone, 1);
  painter.vLine(178, 147, 7, PALETTE.stone, 1);
  painter.line(155, 150, 166, 140, PALETTE.indigoDeep, 2);
  painter.line(166, 140, 178, 150, PALETTE.indigoDeep, 2);
  painter.line(160, 148, 174, 148, PALETTE.indigoLight, 2);
  painter.line(166, 140, 170, 135, PALETTE.indigoDeep, 2);
  painter.hLine(169, 134, 7, PALETTE.inkSoft);
  painter.hLine(160, 138, 7, PALETTE.inkSoft, 2);
  painter.ellipse(284, 111, 14, 5, PALETTE.leafDeep, 0.25);
  painter.rect(275, 82, 18, 29, PALETTE.stoneDeep);
  painter.rect(278, 84, 13, 25, PALETTE.stone);
  painter.hLine(280, 90, 8, PALETTE.washiShadow);
  painter.hLine(280, 96, 6, PALETTE.stoneSun);
  painter.hLine(280, 102, 9, PALETTE.stoneSun);

  paintDapple(painter, 4, 94, width - 8, height - 104, seed, PALETTE.washi);
}

export function paintShop(
  painter: PixelPainter,
  width: number,
  height: number,
  seed: string | number,
): void {
  painter.rect(0, 0, width, height, PALETTE.inkDeep);
  paintPlaster(painter, 8, 8, width - 16, 79, { seed });
  paintWood(painter, 8, 85, width - 16, height - 93, { seed, dark: true });
  painter.rect(19, 20, width - 38, 68, PALETTE.hinokiDark);
  for (let x = 25; x < width - 60; x += 66) {
    painter.rect(x, 27, 54, 54, PALETTE.soilDeep);
    painter.hLine(x + 3, 54, 48, PALETTE.hinoki, 4);
    painter.rect(x + 8, 41, 14, 13, PALETTE.ceramic);
    painter.rect(x + 29, 35, 17, 19, PALETTE.indigo);
    painter.rect(x + 6, 62, 20, 18, PALETTE.leafDark);
    painter.rect(x + 32, 67, 14, 13, PALETTE.sakuraShadow);
  }
  painter.rect(23, 126, width - 46, 43, PALETTE.hinokiDark);
  painter.rect(27, 119, width - 54, 20, PALETTE.hinoki);
  painter.hLine(30, 119, width - 60, PALETTE.hinokiLight, 3);
  paintIndigoFabric(painter, width / 2 - 46, 9, 92, 31, { seed });
  painter.hLine(width / 2 - 24, 21, 48, PALETTE.washi, 2);
  painter.vLine(width / 2, 14, 18, PALETTE.washi);
}

export function paintStreet(
  painter: PixelPainter,
  width: number,
  height: number,
  seed: string | number,
  season: Season,
): void {
  painter.rect(0, 0, width, height, PALETTE.sky);
  paintDistantHills(painter, width, 73);
  painter.rect(0, 72, width, 86, PALETTE.soil);
  for (let x = -18; x < width; x += 92) {
    painter.rect(x, 70, 83, 79, PALETTE.hinokiDark);
    paintPlaster(painter, x + 5, 77, 73, 61, { seed: `${seed}:${x}` });
    paintRoofTiles(painter, x - 3, 62, 89, 18, { seed: `${seed}:${x}` });
    paintShoji(painter, x + 14, 94, 25, 42, { seed });
    paintIndigoFabric(painter, x + 47, 92, 24, 30, { seed });
  }
  painter.rect(0, 154, width, height - 154, PALETTE.stone);
  for (let y = 159; y < height; y += 13) {
    painter.hLine((y * 7) % 18, y, width - 10, PALETTE.stoneLight);
  }
  painter.polygon(
    [
      [190, 154],
      [287, 154],
      [349, height],
      [116, height],
    ],
    PALETTE.stoneDeep,
  );
  painter.polygon(
    [
      [207, 154],
      [272, 154],
      [311, height],
      [154, height],
    ],
    PALETTE.stoneSun,
  );
  paintTree(painter, 42, 172, 66, season, `${seed}:street`);
}

function paintTimeGrade(
  painter: PixelPainter,
  width: number,
  height: number,
  timeOfDay: TimeOfDay,
): void {
  if (timeOfDay === "morning") {
    painter.rect(0, 0, width, height, PALETTE.glow, 0.05);
  } else if (timeOfDay === "golden") {
    painter.rect(0, 0, width, height, PALETTE.vermilionLight, 0.09);
  } else if (timeOfDay === "evening") {
    painter.rect(0, 0, width, height, PALETTE.plum, 0.16);
  } else if (timeOfDay === "night") {
    painter.rect(0, 0, width, height, PALETTE.inkDeep, 0.38);
    painter.rect(Math.floor(width * 0.58), 0, Math.floor(width * 0.42), height, PALETTE.indigo, 0.09);
  }
}

export function createEnvironment(
  location: LocationId,
  options: EnvironmentOptions = {},
): PixelArt {
  const width = options.width ?? VIRTUAL_WIDTH;
  const height = options.height ?? VIRTUAL_HEIGHT;
  const seed = options.seed ?? `komorebi:${location}`;
  const timeOfDay = options.timeOfDay ?? "day";
  const season = options.season ?? "spring";
  return makePixelArt(
    width,
    height,
    (painter) => {
      switch (location) {
        case "room":
          paintJapaneseRoom(painter, width, height, seed, options.furnished ?? true);
          break;
        case "garden":
          paintGarden(painter, width, height, seed, season);
          break;
        case "cafe":
          paintCafe(painter, width, height, seed);
          break;
        case "park":
          paintPark(painter, width, height, seed, season);
          break;
        case "shop":
          paintShop(painter, width, height, seed);
          break;
        case "street":
          paintStreet(painter, width, height, seed, season);
          break;
      }
      paintTimeGrade(painter, width, height, timeOfDay);
    },
    {
      id: `environment:${location}:${season}:${timeOfDay}:${seed}`,
      renderBand: "backdrop",
      tags: [location, season, timeOfDay, "480x270", "top-down-three-quarter"],
    },
  );
}
