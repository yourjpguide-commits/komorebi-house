import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { WorldScene } from '../scenes/WorldScene';
import { RENDER_HEIGHT, RENDER_WIDTH } from './constants';

export function createGameConfig(
  parent: HTMLElement,
): Phaser.Types.Core.GameConfig {
  const useIntegerPresentation =
    parent.clientWidth >= RENDER_WIDTH && parent.clientHeight >= RENDER_HEIGHT;
  return {
    type: Phaser.AUTO,
    parent,
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
    backgroundColor: '#263f40',
    transparent: false,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    banner: false,
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
      powerPreference: 'high-performance',
      batchSize: 2_048,
    },
    scale: {
      mode: useIntegerPresentation ? Phaser.Scale.NONE : Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      expandParent: true,
      autoRound: true,
      zoom: useIntegerPresentation ? Phaser.Scale.MAX_ZOOM : Phaser.Scale.NO_ZOOM,
    },
    fps: {
      target: 60,
      min: 30,
      smoothStep: false,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fps: 60,
      },
    },
    input: {
      activePointers: 3,
      smoothFactor: 0,
    },
    scene: [BootScene, WorldScene],
  };
}
