import type { SavedWorldState } from './types';

export const DEFAULT_WORLD_STATE: SavedWorldState = {
  version: 1,
  location: 'room',
  coins: 1_260,
  ownedItems: {
    'patchwork-zabuton': 2,
    'round-chabudai': 1,
    'folded-futon': 1,
    'seigaiha-notebook': 1,
    'milk-glass-desk-lamp': 1,
    'steam-tea-tray': 1,
    'blue-hydrangea-cluster': 1,
  },
  placedDecor: [
    { instanceId: 'starter-table', itemId: 'round-chabudai', location: 'room', x: 294, y: 190, rotation: 0 },
    { instanceId: 'starter-cushion', itemId: 'patchwork-zabuton', location: 'room', x: 294, y: 210, rotation: 0 },
    { instanceId: 'starter-futon', itemId: 'folded-futon', location: 'room', x: 194, y: 212, rotation: 0 },
    { instanceId: 'starter-notebook', itemId: 'seigaiha-notebook', location: 'room', x: 285, y: 169, rotation: 270, support: { parentInstanceId: 'starter-table', socket: 'notebook', offset: { x: -9, y: -21 } } },
    { instanceId: 'starter-lamp', itemId: 'milk-glass-desk-lamp', location: 'room', x: 297.5, y: 169.5, rotation: 0, support: { parentInstanceId: 'starter-table', socket: 'lamp', offset: { x: 3.5, y: -20.5 } } },
  ],
};

export function createDefaultWorldState(): SavedWorldState {
  return {
    ...DEFAULT_WORLD_STATE,
    ownedItems: { ...DEFAULT_WORLD_STATE.ownedItems },
    placedDecor: DEFAULT_WORLD_STATE.placedDecor.map((item) => ({ ...item })),
  };
}
