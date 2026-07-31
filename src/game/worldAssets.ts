import type { LocationId } from './types';

export interface WorldBackplateAsset {
  readonly key: string;
  readonly path: string;
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

export function worldBackplateAsset(location: LocationId): WorldBackplateAsset {
  return WORLD_BACKPLATES[location];
}
