import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { WorldScene } from '../scenes/WorldScene';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';

export function createGameConfig(
  parent: string | HTMLElement,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      expandParent: true,
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
