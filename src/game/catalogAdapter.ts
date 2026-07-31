import { ITEM_CATALOG } from '../data/catalog';
import { WORLD_GRID } from './constants';
import { ART_KEYS } from './pixelTextures';
import { FALLBACK_DECOR_CATALOG } from './catalogFallback';
import type { DecorDefinition, LocationId } from './types';

const DATA_TO_SCENE_LOCATION: Readonly<Record<string, LocationId | undefined>> = {
  'home-room': 'room',
  'home-garden': 'garden',
  'kissaten-cafe': 'cafe',
  'riverside-park': 'park',
};

const FALLBACK_ART_ALIASES: Readonly<Record<string, string>> = {
  'patchwork-zabuton': 'zabuton',
  'round-chabudai': 'kotatsu',
  'folded-futon': 'futon',
  'hinoki-writing-desk': 'low-desk',
  'indigo-tansu': 'bookshelf',
  'low-manga-shelf': 'bookshelf',
  'engawa-bench': 'floor-chair',
  'persimmon-kotatsu': 'kotatsu',
  'woven-lounge-chair': 'floor-chair',
  'moon-shoji-divider': 'bookshelf',
  'well-read-book-stack': 'tea-set',
  'dictionary-reading-stand': 'low-desk',
  'walnut-focus-radio': 'record-player',
  'low-desk-hinoki': 'low-desk',
  'amber-desk-lamp': 'paper-lamp',
  'floor-cushion-matcha': 'zabuton',
  'little-bonsai': 'monstera',
  'book-stack': 'tea-set',
  'paper-lantern': 'paper-lamp',
  'ceramic-tea-set': 'tea-set',
  'garden-stone-lamp': 'stone-lantern',
  'indigo-rug': 'zabuton',
  'retro-radio': 'record-player',
};

function mappedCategory(
  category: (typeof ITEM_CATALOG)[number]['category'],
  placementSurface: (typeof ITEM_CATALOG)[number]['footprint']['surface'],
): DecorDefinition['category'] {
  if (placementSurface === 'tabletop') return 'tabletop';
  switch (category) {
    case 'furniture':
      return 'seating';
    case 'study':
      return 'desk';
    case 'lighting':
      return 'lighting';
    case 'garden':
      return 'garden';
    case 'decor':
      return 'soft';
    case 'cafe':
      return 'tabletop';
  }
}

const DATA_DECOR_CATALOG: readonly DecorDefinition[] = ITEM_CATALOG.map((item) => {
  const locations = item.locations
    .map((location) => DATA_TO_SCENE_LOCATION[location])
    .filter((location): location is LocationId => location !== undefined);
  const alias = FALLBACK_ART_ALIASES[item.id];
  return {
    id: item.id,
    name: item.name.en,
    nameJa: item.name.ja,
    description: item.description.en,
    price: item.price,
    footprint: {
      width: Math.max(WORLD_GRID, item.footprint.width * WORLD_GRID * 2),
      height: Math.max(WORLD_GRID, item.footprint.height * WORLD_GRID * 1.5),
    },
    locations,
    category: mappedCategory(item.category, item.footprint.surface),
    placementSurface: item.footprint.surface,
    placementMount: item.footprint.mount,
    textureKey: alias ? ART_KEYS.decor(alias) : undefined,
  };
});

const SHELL_ALIAS_CATALOG: readonly DecorDefinition[] = [
  ['low-desk-hinoki', 'Hinoki study desk', 'ひのきの文机', 680, 'low-desk', 'room', 'desk'],
  ['amber-desk-lamp', 'Amber desk lamp', '琥珀のデスク灯', 340, 'paper-lamp', 'room', 'lighting'],
  ['floor-cushion-matcha', 'Matcha floor cushion', '抹茶の座布団', 180, 'zabuton', 'room', 'soft'],
  ['little-bonsai', 'Little pine bonsai', '小さな松盆栽', 420, 'monstera', 'room', 'plants'],
  ['book-stack', 'Well-loved books', '読みかけの本', 140, 'tea-set', 'room', 'tabletop'],
  ['paper-lantern', 'Persimmon lantern', '柿色の行灯', 520, 'paper-lamp', 'room', 'lighting'],
  ['ceramic-tea-set', 'Tea for one', 'ひとりのお茶', 260, 'tea-set', 'room', 'tabletop'],
  ['garden-stone-lamp', 'Stone garden lamp', '小さな石灯籠', 760, 'stone-lantern', 'garden', 'garden'],
  ['indigo-rug', 'Indigo woven rug', '藍染めの敷物', 390, 'zabuton', 'room', 'soft'],
  ['retro-radio', 'Little walnut radio', '木のラジオ', 590, 'record-player', 'room', 'tabletop'],
].map(
  ([id, name, nameJa, price, artId, location, category]): DecorDefinition => {
    const base = FALLBACK_DECOR_CATALOG.find((item) => item.id === artId);
    return {
      id: id as string,
      name: name as string,
      nameJa: nameJa as string,
      price: price as number,
      textureKey: ART_KEYS.decor(artId as string),
      footprint: base?.footprint ?? { width: 16, height: 16 },
      locations: [location as LocationId],
      category: category as DecorDefinition['category'],
      placementSurface: category === 'tabletop' ? 'tabletop' : category === 'garden' ? 'outdoor-ground' : 'floor',
    };
  },
);

export const SCENE_DECOR_CATALOG: readonly DecorDefinition[] = [
  ...FALLBACK_DECOR_CATALOG,
  ...DATA_DECOR_CATALOG.filter(
    (definition) =>
      !FALLBACK_DECOR_CATALOG.some((fallback) => fallback.id === definition.id),
  ),
  ...SHELL_ALIAS_CATALOG.filter(
    (definition) =>
      !DATA_DECOR_CATALOG.some((dataItem) => dataItem.id === definition.id),
  ),
];

const SCENE_DECOR_BY_ID = new Map(
  SCENE_DECOR_CATALOG.map((definition) => [definition.id, definition]),
);

export function sceneDecorById(id: string): DecorDefinition | undefined {
  return SCENE_DECOR_BY_ID.get(id);
}

export function resolveDecorTextureKey(
  textures: Phaser.Textures.TextureManager,
  definition: DecorDefinition,
): string {
  const canonicalKey = ART_KEYS.decor(definition.id);
  if (textures.exists(canonicalKey)) return canonicalKey;
  if (definition.textureKey && textures.exists(definition.textureKey)) {
    return definition.textureKey;
  }
  const alias = FALLBACK_ART_ALIASES[definition.id];
  if (alias && textures.exists(ART_KEYS.decor(alias))) {
    return ART_KEYS.decor(alias);
  }
  return '__MISSING';
}
