import type { LocationId } from './types';

export interface WorldBackplateAsset {
  readonly key: string;
  readonly path: string;
}

export interface WorldFurnitureAsset {
  readonly key: string;
  readonly path: string;
  readonly sourceSize: readonly [width: number, height: number];
  readonly displayScale?: number;
  readonly origin?: readonly [x: number, y: number];
  readonly contactMask?: WorldFurnitureLayerAsset;
  readonly castMask?: WorldFurnitureLayerAsset;
}

export interface WorldFurnitureLayerAsset {
  readonly key: string;
  readonly path: string;
  readonly alpha?: number;
}

const furnitureAsset = (
  asset: WorldFurnitureAsset,
): Readonly<WorldFurnitureAsset> => Object.freeze(asset);

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
    furnitureAsset({
      key: 'koh:decor:round-chabudai',
      path: publicAsset('assets/v2/furniture/round-chabudai.png'),
      sourceSize: [58, 34],
    }),
    furnitureAsset({
      key: 'koh:decor:patchwork-zabuton',
      path: publicAsset('assets/v3/furniture/zabuton-facing-0.png'),
      sourceSize: [72, 44],
      displayScale: 0.5,
      origin: [0.5, 1],
      castMask: {
        key: 'koh:decor:patchwork-zabuton:cast',
        path: publicAsset('assets/v3/furniture/zabuton-facing-0-cast-mask.png'),
      },
      contactMask: {
        key: 'koh:decor:patchwork-zabuton:contact',
        path: publicAsset('assets/v3/furniture/zabuton-facing-0-contact-mask.png'),
      },
    }),
    furnitureAsset({
      key: 'koh:decor:folded-futon',
      path: publicAsset('assets/v3/furniture/futon-bedding-native-v2.png'),
      sourceSize: [144, 76],
      displayScale: 0.5,
      origin: [0.5, 74 / 76],
      castMask: {
        key: 'koh:decor:folded-futon:cast',
        path: publicAsset('assets/v3/furniture/futon-shadow-cast-native-v2.png'),
      },
      contactMask: {
        key: 'koh:decor:folded-futon:contact',
        path: publicAsset('assets/v3/furniture/futon-shadow-contact-native-v2.png'),
      },
    }),
    furnitureAsset({
      key: 'koh:decor:seigaiha-notebook',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook.png'),
      sourceSize: [20, 13],
    }),
    furnitureAsset({
      key: 'koh:decor:milk-glass-desk-lamp',
      path: publicAsset('assets/v2/furniture/milk-glass-desk-lamp.png'),
      sourceSize: [20, 28],
    }),
    furnitureAsset({
      key: 'koh:decor:patchwork-zabuton:r90',
      path: publicAsset('assets/v3/furniture/zabuton-facing-90.png'),
      sourceSize: [48, 68],
      displayScale: 0.5,
      origin: [0.5, 1],
      castMask: {
        key: 'koh:decor:patchwork-zabuton:r90:cast',
        path: publicAsset('assets/v3/furniture/zabuton-facing-90-cast-mask.png'),
      },
      contactMask: {
        key: 'koh:decor:patchwork-zabuton:r90:contact',
        path: publicAsset('assets/v3/furniture/zabuton-facing-90-contact-mask.png'),
      },
    }),
    furnitureAsset({
      key: 'koh:decor:patchwork-zabuton:r180',
      path: publicAsset('assets/v3/furniture/zabuton-facing-180.png'),
      sourceSize: [72, 44],
      displayScale: 0.5,
      origin: [0.5, 1],
      castMask: {
        key: 'koh:decor:patchwork-zabuton:r180:cast',
        path: publicAsset('assets/v3/furniture/zabuton-facing-180-cast-mask.png'),
      },
      contactMask: {
        key: 'koh:decor:patchwork-zabuton:r180:contact',
        path: publicAsset('assets/v3/furniture/zabuton-facing-180-contact-mask.png'),
      },
    }),
    furnitureAsset({
      key: 'koh:decor:patchwork-zabuton:r270',
      path: publicAsset('assets/v3/furniture/zabuton-facing-270.png'),
      sourceSize: [48, 68],
      displayScale: 0.5,
      origin: [0.5, 1],
      castMask: {
        key: 'koh:decor:patchwork-zabuton:r270:cast',
        path: publicAsset('assets/v3/furniture/zabuton-facing-270-cast-mask.png'),
      },
      contactMask: {
        key: 'koh:decor:patchwork-zabuton:r270:contact',
        path: publicAsset('assets/v3/furniture/zabuton-facing-270-contact-mask.png'),
      },
    }),
    furnitureAsset({
      key: 'koh:decor:seigaiha-notebook:r90',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook-r90.png'),
      sourceSize: [13, 20],
    }),
    furnitureAsset({
      key: 'koh:decor:seigaiha-notebook:r180',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook-r180.png'),
      sourceSize: [20, 13],
    }),
    furnitureAsset({
      key: 'koh:decor:seigaiha-notebook:r270',
      path: publicAsset('assets/v2/furniture/seigaiha-notebook-r270.png'),
      sourceSize: [13, 20],
    }),
  ]);

const WORLD_FURNITURE_ASSET_BY_KEY = new Map(
  WORLD_FURNITURE_ASSETS.map((asset) => [asset.key, asset] as const),
);

export function worldFurnitureAsset(
  key: string,
): WorldFurnitureAsset | undefined {
  return WORLD_FURNITURE_ASSET_BY_KEY.get(key);
}

export function worldBackplateAsset(location: LocationId): WorldBackplateAsset {
  return WORLD_BACKPLATES[location];
}
