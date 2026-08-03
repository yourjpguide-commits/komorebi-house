export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 270;
export const RENDER_WIDTH = 960;
export const RENDER_HEIGHT = 540;
export const WORLD_RENDER_SCALE = 2;
export const WORLD_GRID = 8;

export const SCENE_KEYS = {
  boot: 'BootScene',
  world: 'WorldScene',
} as const;

export const PLAYER_SPEED = 76;
export const PLAYER_RUN_MULTIPLIER = 1.34;
export const INTERACTION_RADIUS = 34;

/**
 * Depth is deliberately split into broad bands. Within a band, the final
 * on-screen y coordinate is added so feet, furniture and foliage naturally
 * sort around one another.
 */
export const DEPTH = {
  ground: 0,
  groundDetail: 200,
  shadow: 900,
  worldObject: 1_000,
  actor: 1_000,
  canopy: 3_000,
  weather: 5_000,
  placement: 7_000,
  transition: 9_000,
} as const;

export const DEFAULT_SAVE_KEY = 'komorebi-house.world.v1';
