import Phaser from 'phaser';
import { furnitureTextureKey } from '../art';
import { renderAuthoredBackplate } from './backplateRenderer';
import { DEPTH, WORLD_GRID } from './constants';
import type { LocationBlueprint, Rect } from './types';

export interface LocationRenderResult {
  displayObjects: Phaser.GameObjects.GameObject[];
  lightObjects: Phaser.GameObjects.GameObject[];
}

type Palette = {
  ink: number;
  deep: number;
  wood: number;
  woodLight: number;
  cream: number;
  paper: number;
  green: number;
  greenLight: number;
  water: number;
  waterLight: number;
  stone: number;
  accent: number;
};

const PALETTE: Palette = {
  ink: 0x263f40,
  deep: 0x3f4e4c,
  wood: 0x76513d,
  woodLight: 0xa8764d,
  cream: 0xe8dfbe,
  paper: 0xf2e8c9,
  green: 0x57745c,
  greenLight: 0x7f9b6e,
  water: 0x557d80,
  waterLight: 0x86a9a1,
  stone: 0x87918a,
  accent: 0xc66e59,
};

function graphics(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Graphics {
  return scene.add.graphics().setDepth(depth);
}

function addAuthoredDecor(
  scene: Phaser.Scene,
  itemId: string,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Image | null {
  const key = furnitureTextureKey(itemId);
  if (!scene.textures.exists(key)) return null;
  return scene.add
    .image(x, y, key)
    .setOrigin(0.5, 1)
    .setScale(scale)
    .setDepth(DEPTH.worldObject + y);
}

function rect(
  target: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
): void {
  target.fillStyle(color, alpha);
  target.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function outlinedRect(
  target: Phaser.GameObjects.Graphics,
  fill: number,
  outline: number,
  x: number,
  y: number,
  width: number,
  height: number,
  border = 2,
): void {
  rect(target, outline, x, y, width, height);
  rect(target, fill, x + border, y + border, width - border * 2, height - border * 2);
}

function pixelEllipse(
  target: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
): void {
  target.fillStyle(color, alpha);
  target.fillEllipse(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawTatami(target: Phaser.GameObjects.Graphics, area: Rect): void {
  rect(target, 0xcdbf83, area.x, area.y, area.width, area.height);
  for (let y = area.y; y < area.y + area.height; y += 48) {
    for (let x = area.x; x < area.x + area.width; x += 96) {
      const alternate = ((x - area.x) / 96 + (y - area.y) / 48) % 2 === 1;
      const tileX = x + (alternate ? 48 : 0);
      outlinedRect(target, alternate ? 0xd8cb91 : 0xd2c58a, 0x778069, tileX, y, 92, 44, 2);
      for (let stripe = 6; stripe < 42; stripe += 6) {
        rect(target, alternate ? 0xcabf85 : 0xc6b97e, tileX + 3, y + stripe, 86, 1, 0.65);
      }
    }
  }
}

function drawWoodFloor(target: Phaser.GameObjects.Graphics, area: Rect): void {
  rect(target, 0x94644a, area.x, area.y, area.width, area.height);
  for (let y = area.y; y < area.y + area.height; y += 12) {
    rect(target, y % 24 === 0 ? 0x9d6b4f : 0x895a45, area.x, y, area.width, 11);
    for (let x = area.x + ((y / 12) % 2) * 36; x < area.x + area.width; x += 72) {
      rect(target, 0x704839, x, y, 1, 11, 0.7);
      rect(target, 0xbd815a, x + 12, y + 3, 15, 1, 0.4);
    }
  }
}

function drawGrass(target: Phaser.GameObjects.Graphics, area: Rect, base: number, accent: number): void {
  rect(target, base, area.x, area.y, area.width, area.height);
  for (let y = area.y + 5; y < area.y + area.height; y += 16) {
    for (let x = area.x + ((y / 16) % 2) * 7; x < area.x + area.width; x += 23) {
      rect(target, accent, x, y, 1, 4, 0.56);
      rect(target, accent, x + 2, y + 2, 1, 3, 0.42);
      rect(target, 0xa5ad78, x + 9, y + 7, 2, 1, 0.25);
    }
  }
}

function drawStonePath(target: Phaser.GameObjects.Graphics, points: Rect[]): void {
  points.forEach((stone, index) => {
    const fill = index % 3 === 0 ? 0x9b9b88 : index % 3 === 1 ? 0xaaa38c : 0x8f9587;
    pixelEllipse(target, 0x485c57, stone.x + stone.width / 2, stone.y + stone.height / 2 + 2, stone.width, stone.height);
    pixelEllipse(target, fill, stone.x + stone.width / 2, stone.y + stone.height / 2, stone.width - 2, stone.height - 3);
    rect(target, 0xc3bca0, stone.x + stone.width * 0.25, stone.y + 3, stone.width * 0.35, 2, 0.45);
  });
}

function drawShoji(
  target: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  glow = 0xf5dfad,
): void {
  outlinedRect(target, PALETTE.paper, PALETTE.ink, x, y, width, height, 3);
  rect(target, glow, x + 3, y + 3, width - 6, height - 6, 0.32);
  for (let gridX = x + 12; gridX < x + width - 4; gridX += 12) rect(target, PALETTE.wood, gridX, y + 2, 2, height - 4);
  for (let gridY = y + 12; gridY < y + height - 4; gridY += 12) rect(target, PALETTE.wood, x + 2, gridY, width - 4, 2);
}

function addTree(
  scene: Phaser.Scene,
  x: number,
  y: number,
  variant: 'green' | 'maple' | 'cherry' = 'green',
  scale = 1,
): Phaser.GameObjects.Graphics {
  const tree = scene.add.graphics({ x, y }).setDepth(DEPTH.worldObject + y);
  const trunkDark = 0x58483b;
  const trunk = 0x816047;
  rect(tree, trunkDark, -4 * scale, -8 * scale, 10 * scale, 28 * scale);
  rect(tree, trunk, -2 * scale, -8 * scale, 5 * scale, 26 * scale);
  rect(tree, 0x59624a, -12 * scale, 16 * scale, 26 * scale, 4 * scale);
  const colors: readonly [number, number, number, number] =
    variant === 'maple'
      ? [0x98483f, 0xb45c45, 0xcf7850, 0xdf955e]
      : variant === 'cherry'
        ? [0x9d6d75, 0xc78991, 0xe2a6aa, 0xf1c2bd]
        : [0x395f50, 0x52775a, 0x729367, 0x91a874];
  const clusters = [
    [-17, -27, 24, 19, colors[1]],
    [0, -32, 28, 22, colors[2]],
    [18, -22, 24, 19, colors[0]],
    [-3, -15, 34, 24, colors[1]],
    [-26, -12, 22, 18, colors[0]],
    [22, -5, 22, 18, colors[2]],
  ] as const;
  clusters.forEach(([cx, cy, w, h, color], index) => {
    pixelEllipse(tree, 0x2b4b45, cx * scale, (cy + 2) * scale, w * scale, h * scale);
    pixelEllipse(tree, color, cx * scale, cy * scale, (w - 2) * scale, (h - 2) * scale);
    rect(tree, colors[3], (cx - w * 0.15) * scale, (cy - h * 0.2) * scale, Math.max(2, w * 0.22 * scale), 2 * scale, index % 2 ? 0.65 : 0.4);
  });
  return tree;
}

function addShrub(scene: Phaser.Scene, x: number, y: number, color = 0x64835f): Phaser.GameObjects.Graphics {
  const shrub = scene.add.graphics({ x, y }).setDepth(DEPTH.worldObject + y);
  pixelEllipse(shrub, 0x395a4e, 0, 4, 32, 17);
  pixelEllipse(shrub, color, 0, 1, 30, 16);
  pixelEllipse(shrub, 0x87a06e, -7, -3, 11, 7);
  pixelEllipse(shrub, 0x769263, 8, 0, 12, 8);
  return shrub;
}

function addBench(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const bench = scene.add.graphics({ x, y }).setDepth(DEPTH.worldObject + y);
  rect(bench, PALETTE.ink, -24, -14, 48, 18);
  rect(bench, PALETTE.woodLight, -22, -13, 44, 7);
  rect(bench, PALETTE.wood, -22, -4, 44, 7);
  rect(bench, PALETTE.ink, -18, 3, 4, 11);
  rect(bench, PALETTE.ink, 14, 3, 4, 11);
  rect(bench, 0xcb9360, -19, -12, 25, 2, 0.5);
  return bench;
}

function addRock(scene: Phaser.Scene, x: number, y: number, scale = 1): Phaser.GameObjects.Graphics {
  const rock = scene.add.graphics({ x, y }).setDepth(DEPTH.worldObject + y);
  pixelEllipse(rock, 0x4b5d57, 0, 5 * scale, 31 * scale, 17 * scale);
  pixelEllipse(rock, 0x858e84, 0, 2 * scale, 29 * scale, 16 * scale);
  rect(rock, 0xaeb09e, -8 * scale, -2 * scale, 11 * scale, 3 * scale, 0.65);
  rect(rock, 0x697a61, 4 * scale, 6 * scale, 10 * scale, 3 * scale);
  return rock;
}

function addStoneLantern(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Graphics {
  const lantern = scene.add
    .graphics({ x, y })
    .setDepth(DEPTH.worldObject + y);
  rect(lantern, 0x435650, -13 * scale, 7 * scale, 27 * scale, 5 * scale);
  rect(lantern, 0x7f887f, -10 * scale, 4 * scale, 21 * scale, 5 * scale);
  rect(lantern, 0x566862, -4 * scale, -18 * scale, 9 * scale, 25 * scale);
  rect(lantern, 0x92978a, -3 * scale, -18 * scale, 5 * scale, 23 * scale);
  rect(lantern, 0x435650, -11 * scale, -26 * scale, 23 * scale, 5 * scale);
  outlinedRect(
    lantern,
    0x8d9387,
    0x435650,
    -8 * scale,
    -39 * scale,
    17 * scale,
    15 * scale,
    Math.max(1, Math.round(2 * scale)),
  );
  rect(lantern, 0xf0c77b, -4 * scale, -35 * scale, 9 * scale, 7 * scale, 0.78);
  rect(lantern, 0x435650, -13 * scale, -43 * scale, 27 * scale, 5 * scale);
  rect(lantern, 0x9a9e90, -9 * scale, -47 * scale, 19 * scale, 4 * scale);
  rect(lantern, 0x60735f, 2 * scale, 7 * scale, 9 * scale, 3 * scale);
  return lantern;
}

function addHydrangea(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color = 0x7886b6,
  scale = 1,
): Phaser.GameObjects.Graphics {
  const plant = scene.add
    .graphics({ x, y })
    .setDepth(DEPTH.worldObject + y);
  rect(plant, 0x3f604f, -2 * scale, -13 * scale, 4 * scale, 18 * scale);
  pixelEllipse(plant, 0x456b55, -7 * scale, -5 * scale, 15 * scale, 9 * scale);
  pixelEllipse(plant, 0x557b5d, 8 * scale, -3 * scale, 16 * scale, 9 * scale);
  ([
    [-9, -17],
    [1, -22],
    [10, -15],
    [-1, -11],
  ] as const).forEach(([clusterX, clusterY], index) => {
    pixelEllipse(
      plant,
      0x4d5f75,
      clusterX * scale,
      (clusterY + 2) * scale,
      15 * scale,
      12 * scale,
    );
    pixelEllipse(
      plant,
      index % 2 ? color : 0x9a92c0,
      clusterX * scale,
      clusterY * scale,
      14 * scale,
      11 * scale,
    );
    rect(
      plant,
      0xc6b7d0,
      (clusterX - 2) * scale,
      (clusterY - 3) * scale,
      3 * scale,
      2 * scale,
      0.72,
    );
  });
  return plant;
}

function addForegroundPlant(
  scene: Phaser.Scene,
  x: number,
  y: number,
  mirror = false,
  scale = 1,
): Phaser.GameObjects.Graphics {
  const plant = scene.add
    .graphics({ x, y })
    .setDepth(DEPTH.canopy + y);
  const direction = mirror ? -1 : 1;
  rect(plant, 0x334b45, -12 * scale, -5 * scale, 24 * scale, 9 * scale);
  rect(plant, 0x8b5c45, -9 * scale, -12 * scale, 18 * scale, 9 * scale);
  for (let index = 0; index < 7; index += 1) {
    const leafY = -17 - index * 7;
    const reach = (18 + (index % 3) * 5) * direction;
    plant.lineStyle(Math.max(2, Math.round(3 * scale)), 0x38584a, 1);
    plant.beginPath();
    plant.moveTo(0, -10 * scale);
    plant.lineTo(reach * scale, leafY * scale);
    plant.strokePath();
    pixelEllipse(
      plant,
      index % 2 ? 0x4e7457 : 0x638864,
      reach * scale,
      leafY * scale,
      18 * scale,
      8 * scale,
    );
    rect(
      plant,
      0x89a36f,
      (reach - 4) * scale,
      (leafY - 2) * scale,
      6 * scale,
      2 * scale,
      0.55,
    );
  }
  return plant;
}

function addPendantLamp(
  scene: Phaser.Scene,
  x: number,
  y: number,
  shade = 0xc57855,
): Phaser.GameObjects.Graphics {
  const lamp = scene.add
    .graphics({ x, y })
    .setDepth(DEPTH.canopy + y);
  rect(lamp, 0x332f2d, -1, -42, 3, 29);
  rect(lamp, 0x332f2d, -9, -15, 19, 4);
  rect(lamp, shade, -13, -12, 27, 8);
  rect(lamp, 0xe9b66f, -9, -4, 19, 4);
  pixelEllipse(lamp, 0xffd899, 0, 1, 32, 11, 0.18);
  return lamp;
}

function addCafeBooth(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width = 86,
): Phaser.GameObjects.Graphics {
  const booth = scene.add
    .graphics({ x, y })
    .setDepth(DEPTH.worldObject + y);
  outlinedRect(booth, 0x74453f, 0x332f2d, -width / 2, -32, width, 35, 3);
  for (let stripe = -25; stripe < -3; stripe += 7) {
    rect(booth, stripe % 2 ? 0x8e5148 : 0x68403b, -width / 2 + 4, stripe, width - 8, 4);
  }
  rect(booth, 0x3b302e, -width / 2 - 3, 0, width + 6, 6);
  rect(booth, 0x9b684b, -width / 2, 0, width, 8);
  rect(booth, 0x513936, -width / 2 + 8, 7, 5, 15);
  rect(booth, 0x513936, width / 2 - 13, 7, 5, 15);
  return booth;
}

function addReeds(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
  foreground = false,
): Phaser.GameObjects.Graphics {
  const reeds = scene.add
    .graphics({ x, y })
    .setDepth((foreground ? DEPTH.canopy : DEPTH.worldObject) + y);
  for (let index = 0; index < 9; index += 1) {
    const reedX = (index - 4) * 4 * scale;
    const height = (18 + (index % 4) * 6) * scale;
    rect(reeds, 0x38594b, reedX, -height, Math.max(1, 2 * scale), height + 4 * scale);
    rect(reeds, index % 2 ? 0x7f965f : 0x617f56, reedX + 1, -height, Math.max(1, scale), height);
    rect(reeds, 0x90754e, reedX - scale, -height - 5 * scale, 4 * scale, 6 * scale);
  }
  pixelEllipse(reeds, 0x456650, 0, 1, 48 * scale, 12 * scale);
  return reeds;
}

function addBicycle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frameColor = 0x9c5c4f,
): Phaser.GameObjects.Graphics {
  const bicycle = scene.add
    .graphics({ x, y })
    .setDepth(DEPTH.worldObject + y);
  bicycle.lineStyle(2, 0x314743, 1);
  bicycle.strokeEllipse(-15, -4, 22, 22);
  bicycle.strokeEllipse(17, -4, 22, 22);
  bicycle.lineStyle(3, frameColor, 1);
  bicycle.beginPath();
  bicycle.moveTo(-15, -4);
  bicycle.lineTo(-2, -16);
  bicycle.lineTo(8, -3);
  bicycle.lineTo(-15, -4);
  bicycle.lineTo(2, -4);
  bicycle.lineTo(17, -4);
  bicycle.strokePath();
  rect(bicycle, 0x314743, -7, -20, 13, 3);
  rect(bicycle, 0x314743, 5, -22, 3, 18);
  rect(bicycle, 0x314743, 5, -23, 10, 2);
  return bicycle;
}

function renderGarden(scene: Phaser.Scene, blueprint: LocationBlueprint): LocationRenderResult {
  const displayObjects: Phaser.GameObjects.GameObject[] = [];
  const ground = graphics(scene, DEPTH.ground);
  displayObjects.push(ground);
  drawGrass(ground, blueprint.bounds, blueprint.groundColor, blueprint.groundAccent);

  // Perimeter wall and the connected house/engawa.
  rect(ground, 0x405c54, 48, 48, 704, 368);
  rect(ground, blueprint.groundColor, 82, 88, 632, 294);
  for (let x = 60; x < 742; x += 24) {
    outlinedRect(ground, x % 48 ? 0x8b8c7e : 0x979889, 0x4a5a55, x, 60, 22, 18, 2);
  }
  outlinedRect(ground, 0x9a6d4d, PALETTE.ink, 98, 78, 174, 44, 3);
  rect(ground, 0xc49563, 104, 102, 162, 14);
  for (let x = 108; x < 264; x += 17) rect(ground, 0x7d543f, x, 103, 2, 12);
  drawShoji(ground, 116, 82, 132, 28, 0xbcd4b9);

  // A small karesansui pocket and bamboo screen break up the lawn with
  // location-specific craft while keeping both decoration plots open.
  pixelEllipse(ground, 0x465b55, 392, 147, 190, 83);
  pixelEllipse(ground, 0xb7ae90, 392, 143, 180, 73);
  pixelEllipse(ground, 0xc9bea0, 382, 137, 154, 56, 0.62);
  ([
    [329, 123, 119],
    [318, 133, 145],
    [312, 143, 156],
    [319, 153, 141],
    [334, 163, 112],
  ] as const).forEach(([x, y, width], index) => {
    rect(ground, index % 2 ? 0x9d9984 : 0xd7cba9, x, y, width, 2, 0.72);
  });
  ([
    [306, 142, 9, 7],
    [326, 111, 11, 7],
    [375, 105, 10, 6],
    [430, 108, 12, 7],
    [476, 139, 9, 7],
    [457, 170, 11, 7],
    [405, 180, 10, 6],
    [344, 175, 12, 7],
  ] as const).forEach(([x, y, width, height]) => {
    pixelEllipse(ground, 0x596a63, x, y + 1, width + 2, height + 2);
    pixelEllipse(ground, 0x8b9187, x, y, width, height);
  });
  pixelEllipse(ground, 0x717a72, 348, 145, 34, 20);
  pixelEllipse(ground, 0xa4a594, 348, 142, 30, 17);
  pixelEllipse(ground, 0x667168, 428, 128, 26, 17);
  pixelEllipse(ground, 0x989b8e, 428, 125, 23, 14);
  rect(ground, 0x5a5947, 504, 95, 166, 5);
  for (let x = 508; x < 668; x += 12) {
    rect(ground, 0x9b8352, x, 91, 6, 48);
    rect(ground, 0xc0a36a, x + 1, 92, 2, 44);
  }

  // Pond with blocky ripples and a timber bridge.
  pixelEllipse(ground, 0x3a5b58, 406, 260, 174, 108);
  pixelEllipse(ground, PALETTE.water, 406, 254, 166, 98);
  pixelEllipse(ground, PALETTE.waterLight, 380, 230, 44, 13, 0.5);
  pixelEllipse(ground, 0x355c54, 443, 270, 38, 11, 0.6);
  for (let ripple = 0; ripple < 4; ripple += 1) {
    rect(ground, 0xa7c2af, 357 + ripple * 26, 244 + (ripple % 2) * 22, 17, 2, 0.55);
  }
  ([
    [378, 275, 13, 7],
    [425, 229, 15, 8],
    [450, 282, 11, 6],
  ] as const).forEach(([x, y, width, height]) => {
    pixelEllipse(ground, 0x4e7757, x, y, width, height);
    rect(ground, 0xdd9b9e, x - 1, y - 4, 3, 4);
  });
  rect(ground, 0x3d524d, 312, 204, 24, 112);
  rect(ground, 0x72513f, 315, 204, 18, 112);
  for (let y = 210; y < 310; y += 12) {
    rect(ground, 0x9f704b, 316, y, 17, 10);
    rect(ground, 0xc09160, 318, y + 1, 12, 2);
  }
  rect(ground, 0xc39867, 313, 202, 22, 4);

  drawStonePath(ground, [
    { x: 154, y: 123, width: 32, height: 18 },
    { x: 178, y: 146, width: 29, height: 17 },
    { x: 208, y: 170, width: 34, height: 18 },
    { x: 242, y: 193, width: 30, height: 17 },
    { x: 272, y: 220, width: 32, height: 18 },
    { x: 492, y: 286, width: 31, height: 18 },
    { x: 528, y: 305, width: 34, height: 18 },
    { x: 568, y: 326, width: 30, height: 18 },
    { x: 608, y: 340, width: 33, height: 18 },
    { x: 650, y: 352, width: 34, height: 18 },
  ]);

  const bridge = graphics(scene, DEPTH.worldObject + 270);
  rect(bridge, PALETTE.ink, 458, 242, 63, 27);
  rect(bridge, 0xa76c47, 459, 239, 61, 25);
  for (let x = 463; x < 520; x += 8) rect(bridge, 0x704737, x, 241, 2, 22);
  rect(bridge, 0xd59a5b, 461, 241, 57, 3);
  displayObjects.push(bridge);

  const heroMaple =
    addAuthoredDecor(scene, 'miniature-maple-tree', 214, 264, 1.12) ??
    addTree(scene, 214, 258, 'maple', 1.15);
  const heroLantern =
    addAuthoredDecor(scene, 'stone-garden-lantern', 286, 210, 1.15) ??
    addStoneLantern(scene, 286, 204, 1.18);
  displayObjects.push(
    heroMaple,
    addTree(scene, 650, 155, 'green', 1.05),
    addShrub(scene, 126, 332),
    addShrub(scene, 552, 130, 0x6f8f68),
    addShrub(scene, 626, 318, 0x55775d),
    addBench(scene, 254, 306),
    addRock(scene, 516, 206),
    addRock(scene, 586, 250, 0.8),
    heroLantern,
    addHydrangea(scene, 484, 183, 0x7687b6, 0.9),
    addHydrangea(scene, 676, 290, 0x8d82b4, 1.02),
    addReeds(scene, 340, 286, 0.78),
    addReeds(scene, 478, 278, 0.72),
    addForegroundPlant(scene, 82, 322, false, 1.18),
    addForegroundPlant(scene, 716, 416, true, 1.25),
  );

  // Bamboo water basin.
  const basin = graphics(scene, DEPTH.worldObject + 196);
  rect(basin, 0x4a5d56, 572, 190, 32, 13);
  pixelEllipse(basin, 0x92958a, 588, 191, 31, 16);
  pixelEllipse(basin, 0x527a78, 588, 189, 22, 9);
  rect(basin, 0xa78955, 579, 172, 5, 21);
  rect(basin, 0xc1a464, 580, 173, 27, 5);
  rect(basin, 0x6f825e, 601, 177, 8, 3);
  displayObjects.push(basin);

  return { displayObjects, lightObjects: [] };
}

function renderCafe(scene: Phaser.Scene, blueprint: LocationBlueprint): LocationRenderResult {
  const displayObjects: Phaser.GameObjects.GameObject[] = [];
  const lightObjects: Phaser.GameObjects.GameObject[] = [];
  const ground = graphics(scene, DEPTH.ground);
  displayObjects.push(ground);
  rect(ground, blueprint.skyColor, 0, 0, blueprint.bounds.width, blueprint.bounds.height);
  rect(ground, 0x432f31, 45, 42, 630, 342);
  rect(ground, 0xcaa777, 76, 74, 568, 275);
  drawWoodFloor(ground, { x: 84, y: 98, width: 552, height: 254 });

  // Amber walls, picture rails and broad rain windows.
  rect(ground, 0x724842, 84, 64, 552, 40);
  rect(ground, 0x3e3332, 84, 94, 552, 8);
  drawShoji(ground, 390, 70, 126, 32, 0xd9b886);
  rect(ground, 0x567473, 395, 75, 116, 22, 0.75);
  rect(ground, 0x9ab3a6, 404, 80, 32, 3, 0.5);
  rect(ground, 0x9ab3a6, 463, 89, 39, 2, 0.4);
  outlinedRect(ground, 0x4f5650, 0x312f2f, 546, 68, 70, 34, 3);
  rect(ground, 0xe1bc77, 550, 72, 62, 26, 0.2);
  pixelEllipse(ground, 0xd9b169, 581, 84, 29, 18, 0.7);
  outlinedRect(ground, 0x3b3937, 0x2d3231, 270, 65, 99, 38, 2);
  rect(ground, 0xc5a36f, 273, 68, 93, 3);
  for (let panel = 0; panel < 4; panel += 1) {
    rect(ground, panel % 2 ? 0x435c65 : 0x384f5d, 276 + panel * 22, 71, 19, 28);
    rect(ground, 0xd9c9a0, 283 + panel * 22, 81, 5, 8, 0.52);
  }

  // Counter and back bar.
  outlinedRect(ground, 0x654236, PALETTE.ink, 104, 106, 264, 48, 3);
  rect(ground, 0xa36c4d, 108, 106, 256, 9);
  rect(ground, 0xd09960, 110, 108, 252, 3);
  for (let x = 118; x < 350; x += 18) {
    rect(ground, x % 36 ? 0x8d5c46 : 0x75483b, x, 119, 14, 31);
  }
  outlinedRect(ground, 0x5b4038, PALETTE.ink, 112, 72, 150, 32, 2);
  for (let x = 120; x < 252; x += 18) {
    const jarColors = [0x779081, 0xd0aa72, 0xb35f52] as const;
    rect(ground, jarColors[x % jarColors.length]!, x, 82, 10, 18);
    rect(ground, 0xe3d6b2, x + 2, 84, 6, 3);
  }
  // Siphon, cake dome, handwritten menu, and kissaten ephemera make the back
  // bar unmistakably Showa-era rather than a generic coffee counter.
  pixelEllipse(ground, 0x90aaa1, 282, 91, 13, 15, 0.72);
  pixelEllipse(ground, 0xe3d4ac, 282, 90, 8, 10, 0.42);
  rect(ground, 0x4b3a34, 279, 98, 7, 5);
  rect(ground, 0xb48355, 300, 84, 4, 17);
  pixelEllipse(ground, 0x8baba4, 302, 85, 15, 16, 0.68);
  rect(ground, 0xe2b66e, 297, 98, 14, 3);
  outlinedRect(ground, 0x44433d, 0x2f3130, 318, 74, 40, 28, 2);
  rect(ground, 0xe5d8ae, 324, 80, 27, 2, 0.7);
  rect(ground, 0xe5d8ae, 324, 87, 21, 2, 0.55);
  rect(ground, 0xe5d8ae, 324, 94, 24, 2, 0.55);

  // Two study tables, stools and tabletop details.
  const tables = graphics(scene, DEPTH.worldObject + 250);
  ([
    [266, 220],
    [466, 220],
  ] as const).forEach(([x, y], tableIndex) => {
    pixelEllipse(tables, PALETTE.ink, x, y, 69, 35);
    pixelEllipse(tables, tableIndex ? 0x966549 : 0xa16b4d, x, y - 3, 65, 30);
    rect(tables, 0x6a4539, x - 3, y + 10, 6, 30);
    rect(tables, 0xf0d5a0, x - 11, y - 9, 15, 10);
    rect(tables, 0x55726b, x + 9, y - 10, 7, 9);
    pixelEllipse(tables, 0xe7c887, x + 12, y - 11, 11, 6);
  });
  displayObjects.push(tables);
  const counterHero = graphics(scene, DEPTH.worldObject + 156);
  rect(counterHero, 0x4a3732, 286, 112, 58, 5);
  rect(counterHero, 0xb47b51, 289, 109, 52, 4);
  rect(counterHero, 0x7c5b42, 301, 90, 4, 21);
  pixelEllipse(counterHero, 0x8eaaa3, 303, 91, 17, 18, 0.74);
  pixelEllipse(counterHero, 0xe7d8b3, 303, 90, 10, 12, 0.38);
  rect(counterHero, 0x3d3431, 298, 101, 11, 7);
  rect(counterHero, 0xa47b50, 322, 87, 4, 23);
  pixelEllipse(counterHero, 0x9eb6ad, 324, 89, 16, 18, 0.7);
  rect(counterHero, 0xd5a260, 316, 105, 18, 4);
  rect(counterHero, 0xe7dcc0, 334, 100, 9, 8);
  rect(counterHero, 0x7d5841, 337, 107, 4, 5);
  rect(counterHero, 0xf4dec0, 298, 80, 2, 7, 0.55);
  rect(counterHero, 0xf4dec0, 308, 76, 2, 9, 0.42);
  rect(counterHero, 0xf4dec0, 326, 78, 2, 7, 0.48);
  displayObjects.push(counterHero);
  ([
    [236, 255],
    [296, 255],
    [436, 255],
    [496, 255],
  ] as const).forEach(([x, y]) => {
    const stool = scene.add.graphics({ x, y }).setDepth(DEPTH.worldObject + y);
    pixelEllipse(stool, PALETTE.ink, 0, 0, 24, 13);
    pixelEllipse(stool, 0x62766f, 0, -2, 22, 11);
    rect(stool, 0x3b4d4b, -7, 4, 3, 12);
    rect(stool, 0x3b4d4b, 4, 4, 3, 12);
    displayObjects.push(stool);
  });

  // Doorways and old jukebox.
  outlinedRect(ground, 0x6d8790, PALETTE.ink, 110, 316, 64, 40, 3);
  outlinedRect(ground, 0x6d8790, PALETTE.ink, 546, 316, 64, 40, 3);
  const jukebox = graphics(scene, DEPTH.worldObject + 166);
  outlinedRect(jukebox, 0x7e463e, PALETTE.ink, 566, 112, 40, 58, 3);
  pixelEllipse(jukebox, 0xd8a55e, 586, 132, 27, 29);
  pixelEllipse(jukebox, 0x4f6262, 586, 132, 19, 21);
  rect(jukebox, 0xcf7255, 573, 146, 26, 15);
  rect(jukebox, 0xf0d28d, 577, 150, 18, 3);
  displayObjects.push(jukebox);
  displayObjects.push(
    addPendantLamp(scene, 266, 190, 0xb45f47),
    addPendantLamp(scene, 466, 190, 0x6f776d),
    addCafeBooth(scene, 466, 205, 96),
    addForegroundPlant(scene, 82, 364, false, 0.86),
    addForegroundPlant(scene, 640, 364, true, 0.9),
  );

  const amberLight = graphics(scene, DEPTH.groundDetail);
  amberLight.fillStyle(0xffd58e, 0.08);
  amberLight.fillTriangle(392, 101, 516, 101, 482, 302);
  rect(amberLight, 0xffddb0, 402, 164, 88, 7, 0.055);
  displayObjects.push(amberLight);
  lightObjects.push(amberLight);
  return { displayObjects, lightObjects };
}

function renderPark(scene: Phaser.Scene, blueprint: LocationBlueprint): LocationRenderResult {
  const displayObjects: Phaser.GameObjects.GameObject[] = [];
  const lightObjects: Phaser.GameObjects.GameObject[] = [];
  const ground = graphics(scene, DEPTH.ground);
  displayObjects.push(ground);
  drawGrass(ground, blueprint.bounds, blueprint.groundColor, blueprint.groundAccent);

  // Perimeter hedge, river overlook and winding stone path.
  rect(ground, 0x3c5d52, 32, 24, 836, 42);
  rect(ground, 0x3c5d52, 32, 24, 42, 448);
  rect(ground, 0x3c5d52, 826, 24, 42, 448);
  rect(ground, 0x3c5d52, 32, 432, 836, 40);
  rect(ground, 0x68865f, 70, 66, 756, 366);
  for (let x = 75; x < 825; x += 28) {
    pixelEllipse(ground, 0x4b7058, x, 59, 31, 20);
    pixelEllipse(ground, 0x709065, x + 3, 55, 22, 13);
  }
  // The actual river occupies the overlook, with a dark cut-bank and broken
  // reflections; the pond below connects as a quiet backwater.
  rect(ground, 0x344f50, 334, 164, 492, 101);
  rect(ground, 0x4f777b, 340, 169, 486, 85);
  rect(ground, 0x648e8c, 340, 174, 486, 19, 0.65);
  for (let x = 352; x < 818; x += 38) {
    rect(ground, x % 76 ? 0x93b4aa : 0xb2c5b4, x, 188 + (x % 4) * 9, 24, 2, 0.54);
    rect(ground, 0x3d6668, x + 11, 222 + (x % 3) * 7, 31, 2, 0.55);
  }
  rect(ground, 0x3a514c, 334, 250, 492, 13);
  rect(ground, 0x788061, 334, 250, 492, 5);

  ground.lineStyle(25, 0x58675f, 0.72);
  ground.beginPath();
  ground.moveTo(146, 444);
  ground.lineTo(176, 368);
  ground.lineTo(286, 318);
  ground.lineTo(420, 314);
  ground.lineTo(548, 352);
  ground.lineTo(780, 440);
  ground.strokePath();
  ground.lineStyle(17, 0x9f9782, 1);
  ground.strokePath();
  ground.lineStyle(2, 0xc9bea2, 0.72);
  ground.strokePath();

  // Pond and little drainage stream.
  pixelEllipse(ground, 0x3b5b59, 662, 148, 252, 146);
  pixelEllipse(ground, PALETTE.water, 662, 142, 242, 136);
  pixelEllipse(ground, PALETTE.waterLight, 630, 116, 82, 16, 0.45);
  rect(ground, 0x94b5aa, 680, 172, 46, 2, 0.5);
  rect(ground, 0x94b5aa, 596, 147, 34, 2, 0.45);
  for (let i = 0; i < 7; i += 1) {
    const x = 566 + i * 28;
    const y = 115 + (i % 3) * 27;
    pixelEllipse(ground, i % 2 ? 0x507c60 : 0x608766, x, y, 18, 9);
    if (i % 3 === 0) rect(ground, 0xe1a3aa, x - 1, y - 6, 3, 5);
  }

  // Picnic blanket and playground-like radio nook.
  pixelEllipse(ground, 0x52635b, 312, 354, 70, 18, 0.55);
  outlinedRect(ground, 0xa85f55, PALETTE.ink, 282, 321, 62, 38, 2);
  for (let x = 286; x < 341; x += 10) {
    rect(ground, 0xdfc498, x, 325, 4, 30, 0.62);
  }
  outlinedRect(ground, 0xeadcb9, 0x40534f, 294, 329, 18, 12, 1);
  rect(ground, 0x6f8068, 316, 331, 5, 15);
  pixelEllipse(ground, 0xd4a266, 319, 331, 8, 5);
  outlinedRect(ground, 0x647b73, PALETTE.ink, 486, 326, 39, 30, 2);
  rect(ground, 0xd4ba7c, 493, 332, 25, 4);
  pixelEllipse(ground, 0x263f40, 499, 345, 8, 8);
  pixelEllipse(ground, 0x263f40, 513, 345, 8, 8);

  // Neighborhood-park details: a tiled drinking fountain, enamel sign and
  // vending machine make this recognisably Japanese without theme-park cliché.
  outlinedRect(ground, 0x6d8782, 0x334a47, 190, 288, 34, 30, 2);
  rect(ground, 0xa9b7a8, 196, 294, 22, 8);
  pixelEllipse(ground, 0x567a79, 207, 298, 14, 6);
  rect(ground, 0x405e5a, 204, 303, 5, 13);
  outlinedRect(ground, 0x476b67, 0x2f4543, 226, 278, 44, 68, 3);
  rect(ground, 0xe8dfbf, 232, 286, 32, 23);
  rect(ground, 0xb45f58, 234, 310, 28, 8);
  for (let column = 0; column < 4; column += 1) {
    rect(ground, 0xe1c68c, 233 + column * 7, 322, 5, 8);
  }
  rect(ground, 0xd5d4b2, 240, 338, 16, 3);
  outlinedRect(ground, 0xd5c58e, 0x40534f, 786, 274, 38, 27, 2);
  rect(ground, 0x536e62, 792, 281, 26, 3);
  rect(ground, 0x536e62, 792, 288, 20, 3);
  rect(ground, 0x40534f, 803, 300, 4, 19);

  displayObjects.push(
    addTree(scene, 148, 170, 'cherry', 1.05),
    addTree(scene, 306, 142, 'green', 1),
    addTree(scene, 754, 332, 'maple', 1.05),
    addTree(scene, 116, 332, 'green', 0.95),
    addShrub(scene, 408, 106, 0x668760),
    addShrub(scene, 448, 126, 0x59785b),
    addBench(scene, 456, 248),
    addRock(scene, 546, 206),
    addRock(scene, 770, 104, 0.9),
    addStoneLantern(scene, 370, 244, 0.78),
    addHydrangea(scene, 234, 224, 0x7d8fc1, 0.9),
    addHydrangea(scene, 804, 352, 0x8b80b6, 1.05),
    addReeds(scene, 346, 258, 0.9),
    addReeds(scene, 810, 255, 0.95),
    addBicycle(scene, 664, 382, 0xa85f51),
    addForegroundPlant(scene, 66, 470, false, 1.1),
    addForegroundPlant(scene, 838, 470, true, 1.1),
  );

  // Riverside rail adds a strong horizontal boundary and readable depth.
  const rail = graphics(scene, DEPTH.worldObject + 274);
  rect(rail, PALETTE.ink, 342, 263, 484, 5);
  rect(rail, 0x8f6247, 344, 260, 480, 5);
  for (let x = 350; x < 820; x += 28) {
    rect(rail, PALETTE.ink, x, 258, 5, 27);
    rect(rail, 0xa4714b, x + 1, 259, 3, 24);
  }
  displayObjects.push(rail);

  const benchStudy = graphics(scene, DEPTH.worldObject + 249);
  outlinedRect(benchStudy, 0xe9dab5, 0x40534f, 441, 232, 19, 11, 1);
  rect(benchStudy, 0xb66c59, 450, 233, 2, 9);
  rect(benchStudy, 0x456864, 467, 235, 7, 8);
  pixelEllipse(benchStudy, 0xd8ae70, 470, 235, 9, 5);
  displayObjects.push(benchStudy);

  // Dappled patches are intentionally sparse so UI and avatars remain legible.
  const light = graphics(scene, DEPTH.groundDetail);
  ([
    [226, 196, 42, 12],
    [378, 186, 58, 14],
    [288, 388, 48, 10],
    [698, 350, 54, 12],
  ] as const).forEach(([x, y, width, height]) => pixelEllipse(light, 0xf1d694, x, y, width, height, 0.07));
  displayObjects.push(light);
  lightObjects.push(light);
  return { displayObjects, lightObjects };
}

export function renderLocationEnvironment(
  scene: Phaser.Scene,
  blueprint: LocationBlueprint,
): LocationRenderResult {
  const authoredBackplate = renderAuthoredBackplate(scene, blueprint);
  if (authoredBackplate) {
    return {
      displayObjects: [authoredBackplate],
      lightObjects: [],
    };
  }

  switch (blueprint.id) {
    case 'room':
      throw new Error('Required authored room backplate is missing: koh:world:room');
    case 'garden':
      return renderGarden(scene, blueprint);
    case 'cafe':
      return renderCafe(scene, blueprint);
    case 'park':
      return renderPark(scene, blueprint);
  }
}

export function snapWorldCoordinate(value: number): number {
  return Math.round(value / WORLD_GRID) * WORLD_GRID;
}
