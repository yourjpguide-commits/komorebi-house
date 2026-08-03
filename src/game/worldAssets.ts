import type { LocationId } from './types';

export interface WorldBackplateAsset {
  readonly key: string;
  readonly path: string;
}

export interface WorldFurnitureAsset {
  readonly key: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

const publicAsset = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

/**
 * Stable runtime keys keep authored world art replaceable without letting
 * filenames leak into scene or simulation code.
 */
export const WORLD_BACKPLATES: Readonly<Record<LocationId, WorldBackplateAsset>> =
  Object.freeze({
    room: Object.freeze({
      key: 'koh:world:room',
      path: publicAsset('assets/world/room-base.png'),
    }),
    garden: Object.freeze({
      key: 'koh:world:garden',
      path: publicAsset('assets/world/garden-base.png'),
    }),
    cafe: Object.freeze({
      key: 'koh:world:cafe',
      path: publicAsset('assets/world/cafe-base.png'),
    }),
    park: Object.freeze({
      key: 'koh:world:park',
      path: publicAsset('assets/world/park-base.png'),
    }),
  });

export const WORLD_FURNITURE_ASSETS: ReadonlyArray<WorldFurnitureAsset> =
  Object.freeze([
    Object.freeze({
      key: 'koh:decor:round-chabudai',
      path: publicAsset('assets/v2/furniture/round-chabudai.png'),
      width: 58,
      height: 34,
    }),
    Object.freeze({
      key: 'koh:decor:patchwork-zabuton',
      path: publicAsset('assets/v2/furniture/patchwork-zabuton.png'),
      width: 32,
      height: 17,
    }),
    Object.freeze({
      key: 'koh:decor:folded-futon',
      path: publicAsset('assets/v2/furniture/folded-futon.png'),
      width: 62,
      height: 35,
    }),
    Object.freeze({
      key: 'koh:decor:seigaiha-notebook',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook.png'),
      width: 20,
      height: 13,
    }),
    Object.freeze({
      key: 'koh:decor:milk-glass-desk-lamp',
      path: publicAsset('assets/v2/furniture/milk-glass-desk-lamp.png'),
      width: 20,
      height: 28,
    }),
    Object.freeze({
      key: 'koh:decor:patchwork-zabuton:r90',
      path: publicAsset('assets/v2/furniture/patchwork-zabuton-r90.png'),
      width: 17,
      height: 32,
    }),
    Object.freeze({
      key: 'koh:decor:patchwork-zabuton:r180',
      path: publicAsset('assets/v2/furniture/patchwork-zabuton-r180.png'),
      width: 32,
      height: 17,
    }),
    Object.freeze({
      key: 'koh:decor:patchwork-zabuton:r270',
      path: publicAsset('assets/v2/furniture/patchwork-zabuton-r270.png'),
      width: 17,
      height: 32,
    }),
    Object.freeze({
      key: 'koh:decor:seigaiha-notebook:r90',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook-r90.png'),
      width: 13,
      height: 20,
    }),
    Object.freeze({
      key: 'koh:decor:seigaiha-notebook:r180',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook-r180.png'),
      width: 20,
      height: 13,
    }),
    Object.freeze({
      key: 'koh:decor:seigaiha-notebook:r270',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook-r270.png'),
      width: 13,
      height: 20,
    }),
  ]);

export function worldBackplateAsset(location: LocationId): WorldBackplateAsset {
  return WORLD_BACKPLATES[location];
}
