import Phaser from 'phaser';
import {
  PROCEDURAL_FURNITURE_IDS,
  registerPixelArtTextures,
  type PixelTextureSceneLike,
} from '../art';
import { SCENE_KEYS } from '../game/constants';
import { registerFallbackPixelTextures } from '../game/pixelTextures';
import { WORLD_BACKPLATES, WORLD_FURNITURE_ASSETS } from '../game/worldAssets';

function assertTextureDimensions(
  scene: Phaser.Scene,
  key: string,
  expectedWidth: number,
  expectedHeight: number,
): void {
  if (!scene.textures.exists(key)) {
    throw new Error(`Required texture is missing: ${key}`);
  }
  const sourceImage = scene.textures.get(key).getSourceImage();
  if (sourceImage.width !== expectedWidth || sourceImage.height !== expectedHeight) {
    throw new Error(
      `Required texture ${key} is ${sourceImage.width}x${sourceImage.height}; expected ${expectedWidth}x${expectedHeight}`,
    );
  }
}

/**
 * Boot is intentionally synchronous: authored world and furniture textures
 * are loaded and dimension-checked before procedural registration begins.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    Object.values(WORLD_BACKPLATES).forEach(({ key, path }) => {
      this.load.image(key, path);
    });
    WORLD_FURNITURE_ASSETS.forEach(({ key, path }) => {
      this.load.image(key, path);
    });
  }

  create(): void {
    assertTextureDimensions(this, WORLD_BACKPLATES.room.key, 960, 540);
    WORLD_FURNITURE_ASSETS.forEach(({ key, width, height }) => {
      assertTextureDimensions(this, key, width, height);
    });
    registerPixelArtTextures(this as unknown as PixelTextureSceneLike, {
      locations: ['room', 'garden', 'cafe', 'park'],
      itemIds: PROCEDURAL_FURNITURE_IDS,
      furnitureRotations: [0, 90, 180, 270],
      avatarActions: ['idle', 'walk'],
      effects: ['dust', 'petals', 'steam', 'fireflies'],
      effectFrames: 4,
      effectSeed: 'komorebi-house',
    });
    registerFallbackPixelTextures(this);

    this.game.canvas.dataset.testid = 'game-canvas';
    this.game.canvas.dataset.scene = 'boot';
    this.game.canvas.setAttribute(
      'aria-label',
      'Komorebi House — a cozy Japanese room customizer',
    );

    for (const textureKey of this.textures.getTextureKeys()) {
      if (textureKey.startsWith('koh:')) {
        this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    this.scene.start(SCENE_KEYS.world);
  }
}

export default BootScene;
