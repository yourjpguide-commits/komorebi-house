import type { LocationId } from './types';

export interface WorldBackplateAsset {
  readonly key: string;
  readonly path: string;
}

/**
 * Stable runtime keys keep authored world art replaceable without letting
 * filenames leak into scene or simulation code.
 */
export const WORLD_BACKPLATES: Readonly<Record<LocationId, WorldBackplateAsset>> =
  Object.freeze({
    room: Object.freeze({
      key: 'koh:world:room',
      path: '/assets/world/room-base.png',
    }),
    garden: Object.freeze({
      key: 'koh:world:garden',
      path: '/assets/world/garden-base.png',
    }),
    cafe: Object.freeze({
      key: 'koh:world:cafe',
      path: '/assets/world/cafe-base.png',
    }),
    park: Object.freeze({
      key: 'koh:world:park',
      path: '/assets/world/park-base.png',
    }),
  });

export function worldBackplateAsset(location: LocationId): WorldBackplateAsset {
  return WORLD_BACKPLATES[location];
}
