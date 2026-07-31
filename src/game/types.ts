export const LOCATION_IDS = ['room', 'garden', 'cafe', 'park'] as const;
export type LocationId = (typeof LOCATION_IDS)[number];

export type Direction = 'down' | 'up' | 'left' | 'right';
export type SurfaceKind = 'tatami' | 'wood' | 'stone' | 'grass';
export type AmbienceKind = 'dust' | 'petals' | 'steam' | 'fireflies';

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface DecorDefinition {
  id: string;
  name: string;
  nameJa?: string;
  description?: string;
  textureKey?: string;
  price?: number;
  footprint: {
    width: number;
    height: number;
  };
  locations: LocationId[];
  category?: 'seating' | 'desk' | 'lighting' | 'plants' | 'storage' | 'soft' | 'tabletop' | 'garden';
  placementSurface?: 'floor' | 'wall' | 'tabletop' | 'ceiling' | 'outdoor-ground' | 'water-edge';
  placementMount?: import('../data').PlacementMount;
}

export interface PlacedDecor {
  instanceId: string;
  itemId: string;
  location: LocationId;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface InteractionDefinition extends Point {
  id: string;
  label: string;
  labelJa?: string;
  kind: 'study' | 'rest' | 'shop' | 'listen' | 'read' | 'drink' | 'observe' | 'travel' | 'water';
  radius?: number;
  destination?: LocationId;
  spawnId?: string;
  message?: string;
}

export interface PortalDefinition extends Rect {
  id: string;
  destination: LocationId;
  destinationSpawn: string;
  label: string;
}

export interface LocationBlueprint {
  id: LocationId;
  name: string;
  nameJa: string;
  subtitle: string;
  bounds: Rect;
  surface: SurfaceKind;
  skyColor: number;
  groundColor: number;
  groundAccent: number;
  spawns: Record<string, Point>;
  defaultSpawn: string;
  placementAreas: Rect[];
  obstacles: Rect[];
  portals: PortalDefinition[];
  interactions: InteractionDefinition[];
  ambience: AmbienceKind;
}

export interface InteractionPrompt {
  id: string;
  label: string;
  labelJa?: string;
  kind: InteractionDefinition['kind'];
}

export interface WorldSnapshot {
  location: LocationId;
  locationName: string;
  locationNameJa: string;
  coins: number;
  mode: 'explore' | 'placement' | 'transition';
  selectedItem: string | null;
  editingExisting: boolean;
  rotation: 0 | 90 | 180 | 270;
  placementValid: boolean;
  prompt: string;
  interaction: InteractionPrompt | null;
  ownedItems: Record<string, number>;
  placedDecor: PlacedDecor[];
}

export type SceneCommand =
  | { type: 'travel'; payload: { location: LocationId; spawnId?: string } }
  | { type: 'toggle-placement'; payload?: { itemId?: string; active?: boolean } }
  | { type: 'select-item'; payload: { itemId: string } }
  | { type: 'purchase'; payload: { itemId: string; price?: number } }
  | { type: 'rotate' }
  | { type: 'place' }
  | { type: 'cancel'; payload?: { action?: string } }
  | { type: 'interact' }
  | {
      type: 'move';
      payload:
        | { x: number; y: number; running?: boolean }
        | {
            direction: Direction;
            active: boolean;
            running?: boolean;
          };
    }
  | { type: 'move-stop' };

export interface GameAudioEvent {
  type: 'footstep' | 'interact' | 'place' | 'rotate' | 'travel' | 'ui';
  surface?: SurfaceKind;
  valid?: boolean;
  location?: LocationId;
  action?: 'hover' | 'confirm' | 'back';
}

export interface SavedWorldState {
  version: 1;
  location: LocationId;
  coins: number;
  ownedItems: Record<string, number>;
  placedDecor: PlacedDecor[];
}
