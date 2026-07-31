import Phaser from 'phaser';
import {
  AVATAR_HEIGHT,
  AVATAR_WIDTH,
  createAvatarSprite,
} from '../art/avatar';
import { drawPixelArt } from '../art/pixel';
import { FALLBACK_DECOR_CATALOG } from './catalogFallback';
import type { Direction } from './types';

export const ART_KEYS = {
  shadow: 'koh:fx:shadow',
  dust: 'koh:fx:dust',
  petal: 'koh:fx:petal',
  steam: 'koh:fx:steam',
  firefly: 'koh:fx:firefly',
  cursorValid: 'koh:ui:placement-valid',
  cursorInvalid: 'koh:ui:placement-invalid',
  interaction: 'koh:ui:interaction',
  avatar: (direction: Direction, frame: 0 | 1) => `koh:avatar:${direction}:${frame}`,
  decor: (id: string) => `koh:decor:${id}`,
} as const;

type PixelContext = CanvasRenderingContext2D;
type Drawer = (ctx: PixelContext, width: number, height: number) => void;

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: Drawer,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function px(ctx: PixelContext, color: string, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function outlineRect(
  ctx: PixelContext,
  fill: string,
  outline: string,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness = 1,
): void {
  px(ctx, outline, x, y, width, height);
  px(ctx, fill, x + thickness, y + thickness, width - thickness * 2, height - thickness * 2);
}

function avatarDrawer(direction: Direction, frame: 0 | 1): Drawer {
  return (ctx) => {
    const ink = '#283f43';
    const hair = '#3c3435';
    const hairLight = '#654c45';
    const skin = '#f3c99f';
    const blush = '#db8b78';
    const shirt = '#587f78';
    const shirtLight = '#79a096';
    const pants = '#414d68';
    const sock = '#e7dfcb';
    const shoe = '#614940';

    // Feet are asymmetrical between frames, giving a restrained handheld-game
    // walk cycle without sub-pixel interpolation.
    const leftFootY = frame === 0 ? 27 : 28;
    const rightFootY = frame === 0 ? 28 : 27;
    px(ctx, shoe, 6, leftFootY, 5, 3);
    px(ctx, shoe, 13, rightFootY, 5, 3);
    px(ctx, sock, 7, leftFootY - 2, 3, 2);
    px(ctx, sock, 14, rightFootY - 2, 3, 2);
    px(ctx, pants, 7, 21, 4, 5);
    px(ctx, pants, 13, 21, 4, 5);

    // Body and sleeves.
    px(ctx, ink, 5, 13, 14, 10);
    px(ctx, shirt, 6, 13, 12, 9);
    px(ctx, shirtLight, 7, 14, 3, 6);
    px(ctx, skin, 3, 16 + (frame === 0 ? 0 : 1), 3, 5);
    px(ctx, skin, 18, 17 - (frame === 0 ? 0 : 1), 3, 5);

    // Head silhouette.
    px(ctx, ink, 5, 3, 14, 12);
    px(ctx, hair, 6, 3, 12, 5);
    px(ctx, hair, 5, 6, 3, 7);
    px(ctx, hair, 16, 6, 3, 7);
    px(ctx, skin, 7, 7, 10, 7);
    px(ctx, hairLight, 8, 4, 7, 2);

    if (direction === 'down') {
      px(ctx, ink, 8, 10, 2, 2);
      px(ctx, ink, 14, 10, 2, 2);
      px(ctx, blush, 7, 12, 2, 1);
      px(ctx, blush, 15, 12, 2, 1);
      px(ctx, '#a65f55', 11, 13, 2, 1);
    } else if (direction === 'up') {
      px(ctx, hair, 7, 7, 10, 7);
      px(ctx, hairLight, 8, 7, 2, 4);
      px(ctx, hairLight, 14, 6, 2, 5);
    } else if (direction === 'left') {
      px(ctx, hair, 5, 6, 5, 8);
      px(ctx, ink, 8, 10, 2, 2);
      px(ctx, blush, 8, 12, 2, 1);
      px(ctx, skin, 5, 9, 2, 3);
    } else {
      px(ctx, hair, 14, 6, 5, 8);
      px(ctx, ink, 14, 10, 2, 2);
      px(ctx, blush, 14, 12, 2, 1);
      px(ctx, skin, 17, 9, 2, 3);
    }
  };
}

const DECOR_SIZE: Record<string, { width: number; height: number }> = {
  'low-desk': { width: 40, height: 30 },
  'floor-chair': { width: 24, height: 24 },
  kotatsu: { width: 46, height: 38 },
  bookshelf: { width: 36, height: 50 },
  'paper-lamp': { width: 20, height: 38 },
  zabuton: { width: 24, height: 16 },
  'tea-set': { width: 22, height: 15 },
  monstera: { width: 30, height: 42 },
  'record-player': { width: 30, height: 31 },
  futon: { width: 34, height: 48 },
  'stone-lantern': { width: 30, height: 45 },
  hydrangea: { width: 38, height: 34 },
  'maple-sapling': { width: 48, height: 62 },
  'wind-chime': { width: 18, height: 35 },
};

function drawDecor(id: string): Drawer {
  return (ctx, width, height) => {
    const ink = '#263f40';
    const woodDark = '#694a37';
    const wood = '#a06d47';
    const woodLight = '#d39a61';
    const cream = '#eadfbf';
    const indigo = '#465e79';
    const green = '#527a5c';
    const greenLight = '#7e9c65';
    const moss = '#738252';
    const stone = '#89918b';
    const stoneLight = '#aeb4a7';

    switch (id) {
      case 'low-desk':
        px(ctx, '#3c3029', 3, 11, 34, 15);
        px(ctx, wood, 2, 9, 36, 8);
        px(ctx, woodLight, 3, 9, 34, 2);
        px(ctx, woodDark, 5, 17, 4, 10);
        px(ctx, woodDark, 31, 17, 4, 10);
        outlineRect(ctx, '#d9c8a2', ink, 13, 5, 14, 5);
        px(ctx, '#707d70', 22, 3, 5, 2);
        px(ctx, '#c5835e', 8, 4, 4, 5);
        break;
      case 'floor-chair':
        px(ctx, ink, 4, 6, 16, 16);
        px(ctx, indigo, 5, 6, 14, 9);
        px(ctx, '#69809a', 6, 7, 12, 3);
        px(ctx, '#38485e', 5, 16, 14, 5);
        px(ctx, cream, 10, 14, 4, 2);
        break;
      case 'kotatsu':
        px(ctx, ink, 4, 14, 38, 19);
        px(ctx, '#b95f50', 5, 16, 36, 17);
        px(ctx, '#d98264', 6, 17, 34, 5);
        px(ctx, '#77443f', 6, 27, 34, 5);
        px(ctx, woodDark, 2, 11, 42, 7);
        px(ctx, woodLight, 3, 10, 40, 4);
        px(ctx, '#e9d8b6', 17, 5, 12, 7);
        px(ctx, '#5f766b', 20, 3, 6, 4);
        break;
      case 'bookshelf':
        px(ctx, ink, 2, 2, 32, 47);
        px(ctx, woodDark, 3, 3, 30, 45);
        px(ctx, wood, 5, 5, 26, 11);
        px(ctx, wood, 5, 20, 26, 11);
        px(ctx, wood, 5, 35, 26, 10);
        ['#b75f58', '#66818c', '#d2a45d', '#70845f', '#ded0ae'].forEach((color, index) => {
          px(ctx, color, 7 + index * 4, 8 - (index % 2), 3, 8 + (index % 2));
          px(ctx, color, 25 - index * 4, 23, 3, 8);
          px(ctx, color, 7 + index * 4, 38 - (index % 2), 3, 7 + (index % 2));
        });
        break;
      case 'paper-lamp':
        px(ctx, ink, 8, 3, 4, 32);
        px(ctx, woodDark, 7, 3, 6, 3);
        px(ctx, '#f0d89d', 4, 7, 12, 20);
        px(ctx, '#fff0bd', 6, 9, 8, 16);
        px(ctx, '#d5b672', 4, 13, 12, 1);
        px(ctx, '#d5b672', 4, 20, 12, 1);
        px(ctx, woodDark, 3, 34, 14, 3);
        break;
      case 'zabuton':
        px(ctx, ink, 2, 4, 20, 10);
        px(ctx, indigo, 3, 3, 18, 10);
        px(ctx, '#7188a0', 4, 4, 16, 2);
        px(ctx, '#d4b477', 11, 7, 2, 2);
        break;
      case 'tea-set':
        px(ctx, '#345358', 3, 6, 11, 7);
        px(ctx, '#5d7865', 4, 5, 9, 7);
        px(ctx, '#8ba276', 6, 4, 5, 2);
        px(ctx, '#345358', 14, 7, 6, 5);
        px(ctx, '#7c9a78', 15, 7, 4, 4);
        px(ctx, '#d7bd88', 2, 13, 19, 2);
        break;
      case 'monstera':
        px(ctx, woodDark, 11, 30, 10, 11);
        px(ctx, '#b87955', 12, 31, 8, 9);
        px(ctx, green, 15, 8, 3, 26);
        px(ctx, greenLight, 5, 8, 12, 9);
        px(ctx, green, 4, 12, 12, 7);
        px(ctx, greenLight, 16, 4, 10, 12);
        px(ctx, green, 17, 10, 11, 9);
        px(ctx, '#385e4d', 11, 16, 12, 10);
        px(ctx, '#93af76', 8, 10, 2, 4);
        px(ctx, '#93af76', 21, 7, 2, 5);
        break;
      case 'record-player':
        px(ctx, ink, 2, 15, 26, 14);
        px(ctx, wood, 3, 16, 24, 12);
        px(ctx, '#2b4144', 7, 12, 14, 14);
        px(ctx, '#4e6162', 9, 14, 10, 10);
        px(ctx, '#c77a61', 13, 18, 2, 2);
        px(ctx, '#d3b771', 21, 13, 2, 11);
        px(ctx, '#d3b771', 18, 12, 5, 2);
        px(ctx, cream, 5, 19, 2, 2);
        break;
      case 'futon':
        px(ctx, ink, 2, 5, 30, 41);
        px(ctx, '#d7d3be', 3, 5, 28, 39);
        px(ctx, '#e9e6d4', 5, 7, 24, 13);
        px(ctx, '#91a49d', 4, 22, 26, 20);
        px(ctx, '#6f8580', 4, 29, 26, 3);
        px(ctx, '#d9ba8b', 14, 22, 5, 3);
        break;
      case 'stone-lantern':
        px(ctx, '#4b5c56', 10, 6, 10, 36);
        px(ctx, stone, 11, 19, 8, 22);
        px(ctx, ink, 5, 12, 20, 8);
        px(ctx, stone, 6, 11, 18, 8);
        px(ctx, stoneLight, 9, 13, 12, 4);
        px(ctx, '#eccb7b', 12, 13, 6, 4);
        px(ctx, stone, 3, 7, 24, 6);
        px(ctx, stoneLight, 8, 5, 14, 4);
        px(ctx, stone, 5, 40, 20, 4);
        px(ctx, moss, 5, 7, 7, 2);
        px(ctx, moss, 17, 40, 6, 2);
        break;
      case 'hydrangea':
        px(ctx, green, 7, 20, 24, 12);
        px(ctx, '#456a55', 17, 13, 3, 20);
        [
          [7, 11, '#778bc2'],
          [15, 7, '#99a5da'],
          [23, 10, '#7d91ca'],
          [12, 16, '#93a3d8'],
          [21, 17, '#6f83bd'],
          [28, 15, '#a0addb'],
        ].forEach(([x, y, color]) => {
          px(ctx, color as string, x as number, y as number, 7, 7);
          px(ctx, '#d8c4dd', (x as number) + 2, (y as number) + 2, 2, 2);
        });
        break;
      case 'maple-sapling':
        px(ctx, woodDark, 21, 26, 7, 34);
        px(ctx, wood, 24, 28, 3, 30);
        [
          [8, 12, '#b85848'],
          [17, 5, '#cf7151'],
          [28, 9, '#ab4e45'],
          [12, 21, '#d48655'],
          [27, 20, '#c46049'],
          [34, 15, '#df875a'],
        ].forEach(([x, y, color]) => {
          px(ctx, color as string, x as number, y as number, 11, 10);
          px(ctx, '#843f3b', (x as number) + 3, (y as number) + 3, 3, 3);
        });
        px(ctx, moss, 15, 57, 22, 4);
        break;
      case 'wind-chime':
        px(ctx, '#795746', 8, 1, 2, 8);
        px(ctx, '#91c7cd', 4, 8, 10, 10);
        px(ctx, '#c7e5df', 6, 9, 6, 5);
        px(ctx, '#527c88', 7, 17, 4, 3);
        px(ctx, '#795746', 8, 20, 2, 5);
        px(ctx, '#e9c4a2', 5, 25, 8, 9);
        px(ctx, '#7597a1', 7, 27, 4, 5);
        break;
      default:
        outlineRect(ctx, cream, ink, 2, 2, width - 4, height - 4);
    }
  };
}

export function registerFallbackPixelTextures(scene: Phaser.Scene): void {
  createTexture(scene, ART_KEYS.shadow, 20, 10, (ctx) => {
    ctx.fillStyle = 'rgba(27,45,45,.18)';
    ctx.fillRect(4, 2, 12, 6);
    ctx.fillStyle = 'rgba(27,45,45,.1)';
    ctx.fillRect(2, 4, 16, 3);
  });

  (['down', 'up', 'left', 'right'] as Direction[]).forEach((direction) => {
    ([0, 1] as const).forEach((frame) => {
      createTexture(
        scene,
        ART_KEYS.avatar(direction, frame),
        AVATAR_WIDTH,
        AVATAR_HEIGHT,
        (context) => {
          drawPixelArt(
            context,
            createAvatarSprite(direction, 'idle', frame),
          );
        },
      );
    });
  });

  FALLBACK_DECOR_CATALOG.forEach((item) => {
    const size = DECOR_SIZE[item.id] ?? { width: 32, height: 32 };
    createTexture(scene, ART_KEYS.decor(item.id), size.width, size.height, drawDecor(item.id));
  });

  createTexture(scene, ART_KEYS.dust, 2, 2, (ctx) => px(ctx, 'rgba(255,240,187,.8)', 0, 0, 2, 2));
  createTexture(scene, ART_KEYS.petal, 4, 3, (ctx) => {
    px(ctx, '#efb0b5', 0, 1, 3, 2);
    px(ctx, '#f7ccd0', 1, 0, 3, 2);
  });
  createTexture(scene, ART_KEYS.steam, 3, 5, (ctx) => {
    px(ctx, 'rgba(244,231,211,.65)', 1, 0, 1, 2);
    px(ctx, 'rgba(244,231,211,.45)', 0, 2, 2, 2);
    px(ctx, 'rgba(244,231,211,.25)', 1, 4, 2, 1);
  });
  createTexture(scene, ART_KEYS.firefly, 5, 5, (ctx) => {
    px(ctx, 'rgba(240,220,113,.18)', 0, 0, 5, 5);
    px(ctx, 'rgba(255,239,132,.5)', 1, 1, 3, 3);
    px(ctx, '#fff5a8', 2, 2, 1, 1);
  });
  createTexture(scene, ART_KEYS.cursorValid, 12, 12, (ctx) => {
    px(ctx, '#eef4d2', 5, 0, 2, 12);
    px(ctx, '#eef4d2', 0, 5, 12, 2);
    px(ctx, '#70956e', 5, 5, 2, 2);
  });
  createTexture(scene, ART_KEYS.cursorInvalid, 12, 12, (ctx) => {
    px(ctx, '#f0b39f', 1, 1, 3, 3);
    px(ctx, '#f0b39f', 8, 1, 3, 3);
    px(ctx, '#f0b39f', 5, 4, 2, 4);
    px(ctx, '#f0b39f', 1, 8, 3, 3);
    px(ctx, '#f0b39f', 8, 8, 3, 3);
  });
  createTexture(scene, ART_KEYS.interaction, 12, 14, (ctx) => {
    px(ctx, '#283f43', 2, 0, 8, 10);
    px(ctx, '#f4e6ba', 3, 1, 6, 8);
    px(ctx, '#283f43', 5, 10, 2, 2);
    px(ctx, '#f4e6ba', 5, 3, 2, 4);
    px(ctx, '#cc7a61', 5, 7, 2, 1);
  });
}
