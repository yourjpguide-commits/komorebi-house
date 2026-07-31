import {
  HIRES_AVATAR_ANCHOR,
  HIRES_AVATAR_FRAME_COUNTS,
  HIRES_AVATAR_HEIGHT,
  HIRES_AVATAR_WIDTH,
} from "./avatar-hires";

/**
 * Runtime avatar contract.
 *
 * The authored grid is 1.5x denser than the former 24x32 source. Dividing the
 * desktop/mobile display scales by the same factor preserves the established
 * world footprint while giving hair, face, fabric, hands, and shoes a finer
 * source-pixel cadence against the native 480x270 backplates.
 */
export const AVATAR_WIDTH = HIRES_AVATAR_WIDTH;
export const AVATAR_HEIGHT = HIRES_AVATAR_HEIGHT;
export const AVATAR_ANCHOR = HIRES_AVATAR_ANCHOR;
export const AVATAR_FRAME_COUNTS = HIRES_AVATAR_FRAME_COUNTS;
export const AVATAR_WORLD_SCALE = 0.8;
export const AVATAR_MOBILE_WORLD_SCALE = 1;

export {
  createHiResAvatarSprite as createAvatarSprite,
  normalizeAvatarDirection,
  type AvatarAppearance,
  type HiResAvatarAppearance,
} from "./avatar-hires";
