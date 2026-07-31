import type {
  CatalogItem,
  DeepPartial,
  GameUIState,
  InventoryItem,
  LocationOption,
} from "./types";
import { ITEM_CATALOG, STARTER_ITEM_IDS } from "../data";
import type { ItemDefinition } from "../data";

export const DEFAULT_LOCATIONS: LocationOption[] = [
  {
    id: "room",
    nameEn: "My room",
    nameJa: "わたしの部屋",
    detail: "A small room filled with morning light.",
    unlocked: true,
    accent: "persimmon",
    icon: "home",
  },
  {
    id: "garden",
    nameEn: "Garden",
    nameJa: "小さな庭",
    detail: "Moss, stepping stones, and a quiet pond.",
    unlocked: true,
    accent: "matcha",
    icon: "garden",
  },
  {
    id: "cafe",
    nameEn: "Kissa Komorebi Café",
    nameJa: "喫茶こもれび",
    detail: "A window seat and freshly brewed coffee.",
    unlocked: true,
    accent: "indigo",
    icon: "coffee",
  },
  {
    id: "park",
    nameEn: "Riverside park",
    nameJa: "川辺公園",
    detail: "A shady bench beside the slow river.",
    unlocked: true,
    accent: "sakura",
    icon: "park",
  },
];

const HANDCRAFTED_SAMPLE_CATALOG: CatalogItem[] = [
  {
    id: "low-desk-hinoki",
    nameEn: "Hinoki study desk",
    nameJa: "ひのきの文机",
    description: "A low desk with a soft cedar scent.",
    category: "study",
    price: 680,
    rarity: "artisan",
    new: true,
    visual: "desk",
  },
  {
    id: "amber-desk-lamp",
    nameEn: "Amber desk lamp",
    nameJa: "琥珀のデスク灯",
    description: "Makes late-night pages glow warmly.",
    category: "lighting",
    price: 340,
    rarity: "special",
    visual: "lamp",
  },
  {
    id: "floor-cushion-matcha",
    nameEn: "Matcha floor cushion",
    nameJa: "抹茶の座布団",
    description: "Firm, woven, and perfect for reading.",
    category: "furniture",
    price: 180,
    visual: "cushion",
  },
  {
    id: "little-bonsai",
    nameEn: "Little pine bonsai",
    nameJa: "小さな松盆栽",
    description: "Carefully trained by a neighborhood gardener.",
    category: "plants",
    price: 420,
    rarity: "artisan",
    visual: "bonsai",
  },
  {
    id: "book-stack",
    nameEn: "Well-loved books",
    nameJa: "読みかけの本",
    description: "Essays, stories, and a slim dictionary.",
    category: "study",
    price: 140,
    visual: "books",
  },
  {
    id: "paper-lantern",
    nameEn: "Persimmon lantern",
    nameJa: "柿色の行灯",
    description: "Washi paper casts a gentle pool of light.",
    category: "lighting",
    price: 520,
    rarity: "special",
    visual: "lantern",
  },
  {
    id: "ceramic-tea-set",
    nameEn: "Tea for one",
    nameJa: "ひとりのお茶",
    description: "A small blue cup and a speckled teapot.",
    category: "decor",
    price: 260,
    visual: "tea",
  },
  {
    id: "garden-stone-lamp",
    nameEn: "Stone garden lamp",
    nameJa: "小さな石灯籠",
    description: "A mossy marker for the garden path.",
    category: "garden",
    price: 760,
    rarity: "artisan",
    visual: "lantern",
  },
  {
    id: "indigo-rug",
    nameEn: "Indigo woven rug",
    nameJa: "藍染めの敷物",
    description: "A geometric sashiko-inspired weave.",
    category: "decor",
    price: 390,
    visual: "rug",
  },
  {
    id: "retro-radio",
    nameEn: "Little walnut radio",
    nameJa: "木のラジオ",
    description: "Quiet jazz and the evening weather.",
    category: "decor",
    price: 590,
    rarity: "special",
    visual: "radio",
  },
];

function visualForItem(item: ItemDefinition): CatalogItem["visual"] {
  const words = `${item.id} ${item.visual.textureKey} ${item.tags.join(" ")}`;
  if (/radio|record|speaker/.test(words)) return "radio";
  if (/book|magazine|dictionary/.test(words)) return "books";
  if (/bonsai|maple|tree|plant|flower|hydrangea|moss|herb/.test(words)) {
    return /bonsai|maple|tree/.test(words) ? "bonsai" : "plant";
  }
  if (/lamp|light|lantern|sconce|projector|pendant/.test(words)) {
    return /lantern|washi|stone/.test(words) ? "lantern" : "lamp";
  }
  if (/tea|cup|siphon|brewer|cake|soda/.test(words)) return "tea";
  if (/futon|bed/.test(words)) return "futon";
  if (/cushion|zabuton|rug|mat|textile/.test(words)) {
    return /rug|mat/.test(words) ? "rug" : "cushion";
  }
  if (/shelf|rack|tansu|storage|bookcase/.test(words)) return "shelf";
  if (/desk|table|chabudai|counter/.test(words)) return "desk";
  if (/chair|stool|bench|booth|seating/.test(words)) return "chair";
  if (/vase|ikebana|jar|ceramic|furin/.test(words)) return "vase";
  return item.category === "furniture"
    ? "chair"
    : item.category === "garden"
      ? "bonsai"
      : "vase";
}

function categoryForItem(item: ItemDefinition): CatalogItem["category"] {
  if (item.category === "cafe") return "cafe";
  if (item.category === "garden") return "garden";
  if (item.category === "lighting") return "lighting";
  if (item.category === "study") return "study";
  if (item.category === "furniture") return "furniture";
  const words = `${item.id} ${item.tags.join(" ")}`.toLocaleLowerCase();
  if (
    /plant|bonsai|ikebana|flower|hydrangea|maple|tree|moss|herb/.test(words)
  ) {
    return "plants";
  }
  return "decor";
}

function rarityForItem(item: ItemDefinition): CatalogItem["rarity"] {
  if (item.unlock.type === "rhythm-days") return "artisan";
  if (
    item.unlock.type === "focus-minutes" &&
    item.unlock.minutes >= 180
  ) {
    return "artisan";
  }
  if (item.unlock.type !== "starter") return "special";
  return "everyday";
}

export const SAMPLE_CATALOG: CatalogItem[] =
  ITEM_CATALOG.length > 0
    ? ITEM_CATALOG.map((item) => ({
        id: item.id,
        nameEn: item.name.en,
        nameJa: item.name.ja,
        description: item.description.en,
        category: categoryForItem(item),
        price: item.price,
        rarity: rarityForItem(item),
        new:
          item.unlock.type === "starter" &&
          !STARTER_ITEM_IDS.includes(item.id),
        owned: STARTER_ITEM_IDS.includes(item.id) ? 1 : 0,
        visual: visualForItem(item),
        palette: item.visual.palette.mid,
        rotatable: item.footprint.rotatable,
        placementLocations: item.locations.map((location) =>
          location === "home-room" ? "room" : "garden",
        ),
      }))
    : HANDCRAFTED_SAMPLE_CATALOG;

export const SAMPLE_INVENTORY: InventoryItem[] = SAMPLE_CATALOG.filter((item) =>
  STARTER_ITEM_IDS.includes(item.id),
).map(
  (item, index) => ({
    ...item,
    quantity: 1,
    placed: index < 2 ? 1 : 0,
    owned: 1,
  }),
);

export const DEFAULT_UI_STATE: GameUIState = {
  playerName: "Haru",
  dayLabel: "Saturday · Day 8",
  seasonLabel: "Early summer",
  timeLabel: "09:24",
  weather: "breeze",
  coins: 240,
  currentLocation: "room",
  locations: DEFAULT_LOCATIONS,
  prompt: "Make this little place your own.",
  goalTitle: "A corner for slow mornings",
  goalDetail: "Place a lamp beside your study desk",
  goalProgress: 0.4,
  catalog: SAMPLE_CATALOG,
  catalogCategory: "featured",
  catalogQuery: "",
  customizerMode: false,
  inventory: SAMPLE_INVENTORY,
  inventoryCategory: "all",
  selectedItemId: undefined,
  decorMode: false,
  placementValid: false,
  editingExisting: false,
  existingMoveActive: false,
  rotation: 0,
  canUndo: false,
  canRedo: false,
  focus: {
    phase: "idle",
    activity: "study",
    durationSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    streak: 3,
  },
  dialogue: null,
  activePanel: null,
  settings: {
    music: 0.7,
    ambience: 0.82,
    effects: 0.8,
    muted: false,
    fullscreen: false,
    reducedMotion: false,
    highContrast: false,
    largeText: false,
    showTouchControls: true,
    pixelScale: 2,
  },
  onboarding: {
    active: false,
    step: 0,
    playerName: "Haru",
  },
  isNight: false,
  isTouch: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isRecord(base) || !isRecord(patch)) {
    return patch as T;
  }

  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const previous = output[key];
    output[key] =
      isRecord(previous) && isRecord(value)
        ? deepMerge(previous, value as never)
        : value;
  }
  return output as T;
}

export function createInitialState(
  patch: DeepPartial<GameUIState> = {},
): GameUIState {
  return deepMerge(DEFAULT_UI_STATE, patch);
}

export function mergeUIState(
  state: GameUIState,
  patch: DeepPartial<GameUIState>,
): GameUIState {
  return deepMerge(state, patch);
}
