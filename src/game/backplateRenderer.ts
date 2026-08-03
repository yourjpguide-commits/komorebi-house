import Phaser from 'phaser';
import { DEPTH } from './constants';
import type { LocationBlueprint } from './types';
import { worldBackplateAsset } from './worldAssets';

/**
 * Draws an authored location plate when it loaded successfully. Returning
 * `null` allows retained fallbacks only for non-required locations.
 */
export function renderAuthoredBackplate(
  scene: Phaser.Scene,
  blueprint: LocationBlueprint,
): Phaser.GameObjects.Image | null {
  const { key } = worldBackplateAsset(blueprint.id);
  if (!scene.textures.exists(key)) return null;

  return scene.add
    .image(blueprint.bounds.x, blueprint.bounds.y, key)
    .setOrigin(0, 0)
    .setDisplaySize(blueprint.bounds.width, blueprint.bounds.height)
    .setDepth(DEPTH.ground);
}
