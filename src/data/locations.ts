import { PALETTES } from "./palettes";
import type { LocationDefinition, LocationId } from "./types";

export const LOCATION_CATALOG = [
  {
    id: "home-room",
    name: { ja: "木漏れ日の間", en: "Komorebi Room" },
    description: {
      ja: "畳と障子にやわらかな光が差す、自分だけの勉強部屋。",
      en: "Your own tatami study room, softened by light through shoji.",
    },
    kind: "home",
    unlock: { type: "starter" },
    supportsDecoration: true,
    study: {
      enabled: true,
      suggestedMinutes: [10, 25, 45],
      ambience: ["room-tone", "page-turns", "distant-cicadas"],
      focusMood: 4,
    },
    activities: [
      { ja: "部屋を飾る", en: "Decorate the room" },
      { ja: "机で勉強する", en: "Study at the desk" },
      { ja: "お茶でひと休み", en: "Take a tea break" },
    ],
    palette: PALETTES.tatami,
  },
  {
    id: "home-garden",
    name: { ja: "小さな坪庭", en: "Little Courtyard Garden" },
    description: {
      ja: "苔、飛び石、季節の草花を育てられる静かな坪庭。",
      en: "A quiet courtyard for moss, stepping stones, and seasonal flowers.",
    },
    kind: "home",
    unlock: { type: "focus-minutes", minutes: 45 },
    supportsDecoration: true,
    study: {
      enabled: true,
      suggestedMinutes: [10, 25],
      ambience: ["bamboo-fountain", "sparrows", "summer-breeze"],
      focusMood: 4,
    },
    activities: [
      { ja: "庭を整える", en: "Arrange the garden" },
      { ja: "縁側で読む", en: "Read on the engawa" },
      { ja: "草花を眺める", en: "Admire the plants" },
    ],
    palette: PALETTES.moss,
  },
  {
    id: "kissaten-cafe",
    name: { ja: "喫茶こもれび", en: "Kissa Komorebi Café" },
    description: {
      ja: "深煎り珈琲とレコードの音が落ち着く、昔ながらの喫茶店。",
      en: "An old-fashioned kissaten with dark roast coffee and warm records.",
    },
    kind: "cafe",
    unlock: { type: "focus-minutes", minutes: 90 },
    supportsDecoration: false,
    study: {
      enabled: true,
      suggestedMinutes: [25, 45, 60],
      ambience: ["quiet-cafe", "vinyl-hiss", "cup-clinks"],
      focusMood: 5,
    },
    activities: [
      { ja: "窓辺で勉強する", en: "Study by the window" },
      { ja: "ブレンドを飲む", en: "Sip the house blend" },
      { ja: "家具カタログを見る", en: "Browse the furnishing catalog" },
    ],
    palette: PALETTES.kissaten,
  },
  {
    id: "riverside-park",
    name: { ja: "夕凪川公園", en: "Yunagi Riverside Park" },
    description: {
      ja: "柳の木と川風が心地よい、町はずれの小さな公園。",
      en: "A small edge-of-town park with willow shade and a riverside breeze.",
    },
    kind: "park",
    unlock: { type: "focus-minutes", minutes: 180 },
    supportsDecoration: false,
    study: {
      enabled: true,
      suggestedMinutes: [10, 25, 45],
      ambience: ["river-water", "leaves", "faraway-train"],
      focusMood: 4,
    },
    activities: [
      { ja: "ベンチで読む", en: "Read on a bench" },
      { ja: "スケッチする", en: "Sketch the scenery" },
      { ja: "季節の音を聴く", en: "Listen to the season" },
    ],
    palette: PALETTES.hydrangea,
  },
  {
    id: "shopping-street",
    name: { ja: "ひだまり商店街", en: "Hidamari Shopping Street" },
    description: {
      ja: "家具屋、文具店、園芸店が並ぶ、屋根付きの小さな商店街。",
      en: "A covered neighborhood arcade lined with furniture, stationery, and garden shops.",
    },
    kind: "shopping",
    unlock: { type: "starter" },
    supportsDecoration: false,
    study: {
      enabled: false,
      suggestedMinutes: [],
      ambience: ["shopping-arcade", "bicycle-bells", "shop-curtains"],
      focusMood: 1,
    },
    activities: [
      { ja: "家具を買う", en: "Shop for furniture" },
      { ja: "文具を見る", en: "Browse stationery" },
      { ja: "園芸店に寄る", en: "Visit the garden shop" },
    ],
    palette: PALETTES.washi,
  },
] as const satisfies readonly LocationDefinition[];

export const LOCATION_BY_ID = Object.fromEntries(
  LOCATION_CATALOG.map((location) => [location.id, location]),
) as Readonly<Record<LocationId, (typeof LOCATION_CATALOG)[number]>>;

export function getLocation(id: LocationId): LocationDefinition {
  return LOCATION_BY_ID[id];
}
