import {
  worldFurnitureSupportGeometry,
  worldFurnitureSupportSocket,
} from '../game/worldAssets';

export type TabletopRotation = 0 | 90 | 180 | 270;

export interface TabletopPlacementLike {
  readonly instanceId: string;
  readonly itemId: string;
  readonly location: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: TabletopRotation;
  readonly support?: {
    readonly parentInstanceId: string;
    readonly socket: string;
    readonly offset?: Readonly<{ x: number; y: number }>;
  };
}

export interface ResolvedTabletopSupport {
  readonly parentInstanceId: string;
  readonly socket: string;
  readonly offset: Readonly<{ x: number; y: number }>;
  readonly x: number;
  readonly y: number;
  readonly rotation: TabletopRotation;
}

export type TabletopResolution =
  | { readonly status: 'none' }
  | { readonly status: 'occupied'; readonly parentInstanceId: string }
  | { readonly status: 'supported'; readonly support: ResolvedTabletopSupport };

const TABLETOP_ITEM_IDS = new Set([
  'seigaiha-notebook', 'cedar-pencil-cup', 'well-read-book-stack',
  'dictionary-reading-stand', 'washi-desk-organizer', 'daruma-study-timer',
  'slim-laptop-riser', 'sumi-calligraphy-set', 'kana-flashcard-ring',
  'walnut-focus-radio', 'milk-glass-desk-lamp', 'firefly-glass-jar',
  'star-map-projector', 'steam-tea-tray', 'single-stem-ikebana',
  'ceramic-sleepy-cat', 'striped-coffee-cup', 'brass-siphon-brewer',
  'daily-cake-dome', 'cream-soda-lamp', 'tea-set', 'record-player',
  'book-stack', 'ceramic-tea-set', 'retro-radio',
]);

type Provider = Readonly<{
  polygon: readonly (readonly [number, number])[];
  sockets: readonly Readonly<{ id: string; offset: Readonly<{ x: number; y: number }> }>[];
}>;

function rectangularProvider(width: number, height: number): Provider {
  return {
    polygon: [[-width / 2, -height], [width / 2, -height], [width / 2, 0], [-width / 2, 0]],
    sockets: [
      { id: 'tabletop-left', offset: { x: -width / 4, y: -height / 2 } },
      { id: 'tabletop-center', offset: { x: 0, y: -height / 2 } },
      { id: 'tabletop-right', offset: { x: width / 4, y: -height / 2 } },
    ],
  };
}

const PROVIDERS: Readonly<Record<string, Provider>> = {
  'low-desk': rectangularProvider(32, 18),
  'low-desk-hinoki': rectangularProvider(32, 18),
  kotatsu: rectangularProvider(38, 28),
  'hinoki-writing-desk': rectangularProvider(48, 24),
  'persimmon-kotatsu': rectangularProvider(48, 36),
};

export function isTabletopCatalogItem(itemId: string): boolean {
  return TABLETOP_ITEM_IDS.has(itemId);
}

export function rotateTabletopOffset(
  offset: Readonly<{ x: number; y: number }>,
  rotation: TabletopRotation,
): { x: number; y: number } {
  switch (rotation) {
    case 90: return { x: -offset.y, y: offset.x };
    case 180: return { x: -offset.x, y: -offset.y };
    case 270: return { x: offset.y, y: -offset.x };
    default: return { ...offset };
  }
}

function providerFor(parentItemId: string): Provider | undefined {
  const authored = worldFurnitureSupportGeometry(parentItemId);
  if (!authored) return PROVIDERS[parentItemId];
  return {
    polygon: authored.sourcePolygon.map(([x, y]) => [
      (x - authored.sourceAnchor[0]) * authored.displayScale,
      (y - authored.sourceAnchor[1]) * authored.displayScale,
    ]),
    sockets: [
      { id: 'tabletop-left', offset: { x: -12, y: -20 } },
      { id: 'tabletop-center', offset: { x: 0, y: -24.5 } },
      { id: 'tabletop-right', offset: { x: 12, y: -20 } },
    ],
  };
}

function socketsFor(parentItemId: string, childItemId: string): Provider['sockets'] {
  const authored = worldFurnitureSupportSocket(parentItemId, childItemId);
  if (authored) return [{ id: authored.id, offset: authored.offset }];
  return providerFor(parentItemId)?.sockets ?? [];
}

function pointInPolygon(
  x: number,
  y: number,
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index]!;
    const [x2, y2] = polygon[previous]!;
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

export function savedTabletopSupportIsValid(
  placements: readonly TabletopPlacementLike[],
  child: TabletopPlacementLike,
): boolean {
  if (!child.support || !isTabletopCatalogItem(child.itemId)) return false;
  const parent = placements.find((candidate) =>
    candidate.instanceId === child.support!.parentInstanceId && candidate.location === child.location);
  if (!parent || !providerFor(parent.itemId)) return false;
  return socketsFor(parent.itemId, child.itemId).some((socket) => socket.id === child.support!.socket);
}

export function resolveTabletopSupport(
  placements: readonly TabletopPlacementLike[],
  child: TabletopPlacementLike,
): TabletopResolution {
  if (!isTabletopCatalogItem(child.itemId)) return { status: 'none' };
  const providerCandidates = placements.flatMap((parent) => {
    if (parent.instanceId === child.instanceId || parent.location !== child.location) return [];
    const provider = providerFor(parent.itemId);
    if (!provider) return [];
    const polygon = provider.polygon.map(([x, y]) => {
      const world = rotateTabletopOffset({ x, y }, parent.rotation);
      return [parent.x + world.x, parent.y + world.y] as const;
    });
    if (!pointInPolygon(child.x, child.y, polygon)) return [];
    return [{ parent, sockets: socketsFor(parent.itemId, child.itemId) }];
  }).sort((left, right) => right.parent.y - left.parent.y ||
    left.parent.instanceId.localeCompare(right.parent.instanceId));
  const candidate = providerCandidates[0];
  if (!candidate) return { status: 'none' };
  const free = candidate.sockets.filter((socket) => !placements.some((placed) =>
    placed.instanceId !== child.instanceId &&
    placed.support?.parentInstanceId === candidate.parent.instanceId &&
    placed.support.socket === socket.id));
  if (free.length === 0) return { status: 'occupied', parentInstanceId: candidate.parent.instanceId };
  free.sort((left, right) => {
    const leftWorld = rotateTabletopOffset(left.offset, candidate.parent.rotation);
    const rightWorld = rotateTabletopOffset(right.offset, candidate.parent.rotation);
    return Math.hypot(child.x - candidate.parent.x - leftWorld.x, child.y - candidate.parent.y - leftWorld.y) -
      Math.hypot(child.x - candidate.parent.x - rightWorld.x, child.y - candidate.parent.y - rightWorld.y) ||
      left.id.localeCompare(right.id);
  });
  const socket = free[0]!;
  const authored = worldFurnitureSupportSocket(candidate.parent.itemId, child.itemId);
  const worldOffset = rotateTabletopOffset(socket.offset, candidate.parent.rotation);
  return { status: 'supported', support: {
    parentInstanceId: candidate.parent.instanceId,
    socket: socket.id,
    offset: socket.offset,
    x: candidate.parent.x + worldOffset.x,
    y: candidate.parent.y + worldOffset.y,
    rotation: authored?.rotation ?? child.rotation,
  } };
}
