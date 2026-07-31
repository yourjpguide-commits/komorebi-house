import Phaser from 'phaser';
import {
  FURNITURE_IDS,
  registerPixelArtTextures,
  type PixelTextureSceneLike,
} from '../art';
import { SCENE_KEYS } from '../game/constants';
import { registerFallbackPixelTextures } from '../game/pixelTextures';
import { WORLD_BACKPLATES } from '../game/worldAssets';

/**
 * Boot is intentionally synchronous: all critical runtime sprites have
 * deterministic generated fallbacks, so a slow or offline connection never
 * leaves the player staring at a loading bar.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    Object.values(WORLD_BACKPLATES).forEach(({ key, path }) => {
      this.load.image(key, path);
    });
  }

  create(): void {
    registerPixelArtTextures(this as unknown as PixelTextureSceneLike, {
      locations: ['room', 'garden', 'cafe', 'park'],
      itemIds: FURNITURE_IDS,
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
