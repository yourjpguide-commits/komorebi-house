import { PALETTES, type PaletteName } from "./palettes";
import { isItemUnlocked } from "./economy";
import { mountForSurface } from "./placement";
import type {
  ItemDefinition,
  ItemFootprint,
  ItemInteraction,
  PlacementLocationId,
  PlacementSurface,
  RenderBand,
  UnlockContext,
  UnlockRequirement,
  VisualRecipe,
} from "./types";

const room = ["home-room"] as const;
const garden = ["home-garden"] as const;
const home = ["home-room", "home-garden"] as const;

const starter = (): UnlockRequirement => ({ type: "starter" });
const at = (minutes: number): UnlockRequirement => ({
  type: "focus-minutes",
  minutes,
});
const afterSessions = (
  locationId: "kissaten-cafe" | "riverside-park",
  sessions: number,
): UnlockRequirement => ({ type: "location-sessions", locationId, sessions });
const afterRhythmDays = (days: number): UnlockRequirement => ({
  type: "rhythm-days",
  days,
});

const footprint = (
  width: number,
  height: number,
  surface: PlacementSurface,
  collision: ItemFootprint["collision"] = "solid",
  rotatable = true,
): ItemFootprint => ({
  width,
  height,
  surface,
  collision,
  mount: mountForSurface(surface),
  rotatable,
});

const visual = (
  textureKey: string,
  palette: PaletteName,
  materials: readonly string[],
  layers: readonly string[],
  renderBand: RenderBand,
  options: Partial<
    Pick<VisualRecipe, "anchor" | "shadow" | "animation">
  > = {},
): VisualRecipe => ({
  textureKey,
  palette: PALETTES[palette],
  materials,
  layers,
  renderBand,
  anchor: options.anchor ?? { x: 0.5, y: 0.88 },
  shadow: options.shadow ?? "soft",
  ...(options.animation ? { animation: options.animation } : {}),
});

const interaction = (
  id: string,
  ja: string,
  en: string,
  mode: ItemInteraction["mode"],
  options: Pick<ItemInteraction, "ambience" | "focusBonus"> = {},
): ItemInteraction => ({
  id,
  label: { ja, en },
  mode,
  ...options,
});

const FURNITURE_ITEMS = [
  {
    id: "patchwork-zabuton",
    name: { ja: "継ぎ布の座布団", en: "Patchwork Zabuton" },
    description: {
      ja: "藍と柿色の端切れを丁寧につないだ、ふかふかの座布団。",
      en: "A plump floor cushion pieced together from indigo and persimmon cloth.",
    },
    category: "furniture",
    price: 0,
    unlock: starter(),
    footprint: footprint(1, 1, "floor", "walkable"),
    locations: room,
    visual: visual(
      "patchwork-zabuton",
      "indigo",
      ["cotton", "sashiko-thread"],
      ["floor-shadow", "cushion-body", "patchwork-panels", "stitch-highlights"],
      "floor",
    ),
    interactions: [
      interaction("sit", "座る", "Sit", "sit", { ambience: "cloth-rustle" }),
    ],
    tags: ["starter", "seating", "textile", "washitsu"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "round-chabudai",
    name: { ja: "丸いちゃぶ台", en: "Round Chabudai" },
    description: {
      ja: "湯のみも教科書も手の届くところに置ける、小ぶりな桧の机。",
      en: "A compact hinoki table that keeps tea and textbooks within easy reach.",
    },
    category: "furniture",
    price: 110,
    unlock: starter(),
    footprint: footprint(2, 2, "floor"),
    locations: room,
    visual: visual(
      "round-chabudai",
      "hinoki",
      ["hinoki-wood", "brass"],
      ["elliptical-shadow", "four-legs", "round-top", "wood-grain", "brass-caps"],
      "furniture-low",
    ),
    interactions: [
      interaction("study", "ここで勉強する", "Study here", "study", {
        ambience: "pencil-on-paper",
        focusBonus: 1,
      }),
      interaction("set-tea", "お茶を置く", "Set down tea", "toggle"),
    ],
    tags: ["table", "low", "hinoki", "study"],
    coziness: 3,
    focus: 3,
  },
  {
    id: "folded-futon",
    name: { ja: "朝色の布団", en: "Morning-Sky Futon" },
    description: {
      ja: "淡い空色の縁取りが清々しい、毎朝きちんと畳める布団。",
      en: "A neatly foldable futon trimmed in the pale blue of an early sky.",
    },
    category: "furniture",
    price: 0,
    unlock: starter(),
    footprint: footprint(2, 1, "floor"),
    locations: room,
    visual: visual(
      "folded-futon",
      "washi",
      ["cotton", "linen"],
      ["floor-shadow", "folded-mattress", "quilt-roll", "edge-binding"],
      "furniture-low",
    ),
    interactions: [
      interaction("unfold", "布団を敷く", "Unfold futon", "toggle", {
        ambience: "bedding-fluff",
      }),
    ],
    tags: ["starter", "bed", "textile", "rest"],
    coziness: 5,
    focus: 0,
  },
  {
    id: "hinoki-writing-desk",
    name: { ja: "桧の文机", en: "Hinoki Writing Desk" },
    description: {
      ja: "引き出しの取っ手まで丸く磨かれた、長く使える文机。",
      en: "A lasting writing desk polished smooth down to its rounded drawer pulls.",
    },
    category: "furniture",
    price: 180,
    unlock: at(45),
    footprint: footprint(3, 2, "floor"),
    locations: room,
    visual: visual(
      "hinoki-writing-desk",
      "hinoki",
      ["hinoki-wood", "aged-brass"],
      ["desk-shadow", "rear-legs", "drawer-case", "desktop", "grain", "pulls"],
      "furniture-high",
    ),
    interactions: [
      interaction("study", "机に向かう", "Settle in to study", "study", {
        ambience: "wooden-chair",
        focusBonus: 3,
      }),
      interaction("open-drawer", "引き出しを開ける", "Open drawer", "toggle"),
    ],
    tags: ["desk", "wood", "study", "storage"],
    coziness: 3,
    focus: 5,
  },
  {
    id: "indigo-tansu",
    name: { ja: "藍染めの箪笥", en: "Indigo Tansu Chest" },
    description: {
      ja: "藍色の引き出しと黒鉄の金具が静かに映える、小さな箪笥。",
      en: "A small chest whose indigo drawers are set off by quiet black-iron fittings.",
    },
    category: "furniture",
    price: 160,
    unlock: at(90),
    footprint: footprint(2, 1, "floor"),
    locations: room,
    visual: visual(
      "indigo-tansu",
      "indigo",
      ["paulownia-wood", "indigo-lacquer", "blackened-iron"],
      ["case-shadow", "chest-case", "drawer-faces", "iron-corners", "pulls"],
      "furniture-high",
    ),
    interactions: [
      interaction("store", "小物をしまう", "Store small items", "toggle", {
        ambience: "wood-drawer",
      }),
    ],
    tags: ["storage", "indigo", "traditional", "wood"],
    coziness: 3,
    focus: 1,
  },
  {
    id: "low-manga-shelf",
    name: { ja: "低い本棚", en: "Low Bookcase" },
    description: {
      ja: "漫画も辞書も横一列に並ぶ、窓を隠さない背の低い本棚。",
      en: "A low shelf that lines up manga and dictionaries without blocking the window.",
    },
    category: "furniture",
    price: 210,
    unlock: at(120),
    footprint: footprint(3, 1, "floor"),
    locations: room,
    visual: visual(
      "low-manga-shelf",
      "kissaten",
      ["walnut", "paper", "book-cloth"],
      ["shelf-shadow", "wood-case", "book-blocks", "spine-pixels", "top-highlight"],
      "furniture-high",
    ),
    interactions: [
      interaction("browse", "一冊選ぶ", "Choose a book", "observe", {
        ambience: "book-slide",
      }),
    ],
    tags: ["books", "storage", "reading", "low-profile"],
    coziness: 4,
    focus: 3,
  },
  {
    id: "engawa-bench",
    name: { ja: "縁側の腰掛け", en: "Engawa Bench" },
    description: {
      ja: "部屋にも庭先にも似合う、雨上がりの香りがする杉の腰掛け。",
      en: "A cedar bench equally at home indoors or beside a rain-fresh garden.",
    },
    category: "furniture",
    price: 240,
    unlock: at(180),
    footprint: footprint(3, 1, "floor"),
    locations: home,
    visual: visual(
      "engawa-bench",
      "hinoki",
      ["cedar", "cotton-cord"],
      ["long-shadow", "bench-legs", "seat-planks", "joinery", "cord-detail"],
      "furniture-low",
    ),
    interactions: [
      interaction("sit", "腰掛ける", "Sit awhile", "sit", {
        ambience: "garden-breeze",
      }),
      interaction("read", "本を読む", "Read", "study", { focusBonus: 1 }),
    ],
    tags: ["seating", "engawa", "indoor-outdoor", "cedar"],
    coziness: 5,
    focus: 2,
  },
  {
    id: "persimmon-kotatsu",
    name: { ja: "柿色のこたつ", en: "Persimmon Kotatsu" },
    description: {
      ja: "冬の日を丸ごと過ごしたくなる、柿色の布団を掛けたこたつ。",
      en: "A kotatsu wrapped in persimmon cloth, made for lingering through winter days.",
    },
    category: "furniture",
    price: 360,
    unlock: at(300),
    footprint: footprint(3, 3, "floor"),
    locations: room,
    visual: visual(
      "persimmon-kotatsu",
      "amber",
      ["oak", "quilted-cotton", "heater-mesh"],
      ["wide-shadow", "quilt-skirt", "table-frame", "tabletop", "quilt-pattern"],
      "furniture-low",
      { animation: "subtle-heat-shimmer" },
    ),
    interactions: [
      interaction("warm-up", "こたつに入る", "Get cozy", "sit", {
        ambience: "kotatsu-hum",
      }),
      interaction("study", "ぬくぬく勉強する", "Study in the warmth", "study", {
        focusBonus: 2,
      }),
    ],
    tags: ["seasonal", "winter", "table", "seating"],
    coziness: 8,
    focus: 3,
  },
  {
    id: "woven-lounge-chair",
    name: { ja: "籐編みの読書椅子", en: "Woven Reading Chair" },
    description: {
      ja: "深く座ると籐が小さく鳴る、読書のための丸い椅子。",
      en: "A rounded reading chair whose woven cane gives a tiny creak when you sink in.",
    },
    category: "furniture",
    price: 280,
    unlock: at(240),
    footprint: footprint(2, 2, "floor"),
    locations: room,
    visual: visual(
      "woven-lounge-chair",
      "copper",
      ["rattan", "linen", "beech"],
      ["chair-shadow", "rear-cane", "seat-cushion", "woven-arms", "rim-light"],
      "furniture-high",
    ),
    interactions: [
      interaction("sit", "深く座る", "Sink in", "sit", {
        ambience: "rattan-creak",
      }),
      interaction("read", "読書する", "Read", "study", { focusBonus: 2 }),
    ],
    tags: ["chair", "reading", "woven", "relaxing"],
    coziness: 6,
    focus: 3,
  },
  {
    id: "moon-shoji-divider",
    name: { ja: "月影の衝立", en: "Moonlit Shoji Divider" },
    description: {
      ja: "和紙越しの丸い月が部屋をそっと分ける、二枚折りの衝立。",
      en: "A two-panel shoji screen with a round paper moon that gently divides the room.",
    },
    category: "furniture",
    price: 320,
    unlock: at(420),
    footprint: footprint(3, 1, "floor"),
    locations: room,
    visual: visual(
      "moon-shoji-divider",
      "night",
      ["dark-cedar", "washi", "mica"],
      ["screen-shadow", "wood-frame", "paper-panels", "moon-inlay", "lattice"],
      "furniture-high",
    ),
    interactions: [
      interaction("fold", "衝立をたたむ", "Fold the divider", "toggle", {
        ambience: "paper-screen",
      }),
    ],
    tags: ["divider", "shoji", "moon", "privacy"],
    coziness: 5,
    focus: 2,
  },
] as const satisfies readonly ItemDefinition[];

const STUDY_ITEMS = [
  {
    id: "seigaiha-notebook",
    name: { ja: "青海波のノート", en: "Seigaiha Notebook" },
    description: {
      ja: "青海波の表紙を開くと、まっさらな方眼紙が待っている。",
      en: "A seigaiha-covered notebook filled with inviting blank graph paper.",
    },
    category: "study",
    price: 0,
    unlock: starter(),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "seigaiha-notebook",
      "indigo",
      ["paper", "book-cloth"],
      ["contact-shadow", "page-block", "indigo-cover", "wave-motif", "bookmark"],
      "tabletop",
      { anchor: { x: 0.5, y: 0.72 } },
    ),
    interactions: [
      interaction("write", "今日の目標を書く", "Write today's goal", "study", {
        ambience: "pencil-on-paper",
        focusBonus: 1,
      }),
    ],
    tags: ["starter", "stationery", "notebook", "pattern"],
    coziness: 1,
    focus: 3,
  },
  {
    id: "cedar-pencil-cup",
    name: { ja: "杉の鉛筆立て", en: "Cedar Pencil Cup" },
    description: {
      ja: "短くなった鉛筆まで大切に並べる、杉の小さな鉛筆立て。",
      en: "A tiny cedar cup that keeps even well-loved pencil stubs standing proudly.",
    },
    category: "study",
    price: 50,
    unlock: starter(),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "cedar-pencil-cup",
      "hinoki",
      ["cedar", "graphite", "painted-wood"],
      ["cup-shadow", "wood-cup", "pencil-cluster", "erasers", "grain"],
      "tabletop",
    ),
    interactions: [
      interaction("choose-pencil", "鉛筆を選ぶ", "Choose a pencil", "instant", {
        ambience: "pencils-click",
      }),
    ],
    tags: ["stationery", "desktop", "wood", "small"],
    coziness: 1,
    focus: 2,
  },
  {
    id: "well-read-book-stack",
    name: { ja: "読みかけの本", en: "Well-Read Book Stack" },
    description: {
      ja: "栞や付箋が少しずつ覗く、三冊の読みかけの本。",
      en: "Three books in progress, with bookmarks and tiny notes peeking out.",
    },
    category: "study",
    price: 70,
    unlock: at(30),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "well-read-book-stack",
      "washi",
      ["paper", "book-cloth", "washi-tabs"],
      ["stack-shadow", "bottom-book", "middle-book", "top-book", "tabs"],
      "tabletop",
    ),
    interactions: [
      interaction("read", "続きを読む", "Continue reading", "study", {
        ambience: "page-turn",
        focusBonus: 1,
      }),
    ],
    tags: ["books", "desktop", "reading", "lived-in"],
    coziness: 3,
    focus: 2,
  },
  {
    id: "dictionary-reading-stand",
    name: { ja: "辞書の見台", en: "Dictionary Reading Stand" },
    description: {
      ja: "厚い辞書を好きな頁で開いておける、角度のついた木の見台。",
      en: "An angled wooden stand that holds a heavy dictionary open to just the right page.",
    },
    category: "study",
    price: 90,
    unlock: at(60),
    footprint: footprint(2, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "dictionary-reading-stand",
      "hinoki",
      ["beech", "paper", "linen-tape"],
      ["stand-shadow", "angled-frame", "open-pages", "page-lines", "ribbon"],
      "tabletop",
    ),
    interactions: [
      interaction("look-up", "言葉を調べる", "Look up a word", "study", {
        ambience: "thin-pages",
        focusBonus: 2,
      }),
    ],
    tags: ["language", "dictionary", "reading", "desktop"],
    coziness: 1,
    focus: 4,
  },
  {
    id: "washi-desk-organizer",
    name: { ja: "和紙の書類箱", en: "Washi Desk Organizer" },
    description: {
      ja: "プリントと手紙を三段に分ける、貼り箱仕立ての書類箱。",
      en: "A three-tier pasted-paper tray for sorting worksheets and letters.",
    },
    category: "study",
    price: 120,
    unlock: at(90),
    footprint: footprint(2, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "washi-desk-organizer",
      "sakura",
      ["chipboard", "washi", "paper"],
      ["tray-shadow", "lower-tray", "middle-tray", "upper-tray", "paper-edges"],
      "tabletop",
    ),
    interactions: [
      interaction("tidy", "プリントを整える", "Tidy papers", "instant", {
        ambience: "paper-shuffle",
      }),
    ],
    tags: ["organization", "paper", "desktop", "washi"],
    coziness: 2,
    focus: 4,
  },
  {
    id: "daruma-study-timer",
    name: { ja: "だるまの勉強時計", en: "Daruma Study Timer" },
    description: {
      ja: "片目が終了を知らせる、ころんとした手巻きの勉強時計。",
      en: "A round wind-up timer whose little daruma eye marks a finished session.",
    },
    category: "study",
    price: 160,
    unlock: at(120),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "daruma-study-timer",
      "ceramic",
      ["painted-tin", "glass", "brass"],
      ["timer-shadow", "round-case", "dial", "daruma-face", "hand", "glint"],
      "tabletop",
      { animation: "single-tick" },
    ),
    interactions: [
      interaction("start-timer", "集中時間を始める", "Start a focus timer", "study", {
        ambience: "soft-clock-tick",
        focusBonus: 3,
      }),
    ],
    tags: ["timer", "focus", "daruma", "desktop"],
    coziness: 2,
    focus: 5,
  },
  {
    id: "slim-laptop-riser",
    name: { ja: "薄型ノート台", en: "Slim Laptop Riser" },
    description: {
      ja: "現代の道具も和室に馴染ませる、竹と黒鉄の薄いノート台。",
      en: "A slim bamboo-and-black-iron riser that lets modern tools belong in a washitsu.",
    },
    category: "study",
    price: 220,
    unlock: at(240),
    footprint: footprint(2, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "slim-laptop-riser",
      "night",
      ["bamboo", "blackened-steel", "felt"],
      ["riser-shadow", "steel-feet", "bamboo-platform", "felt-pads", "edge-light"],
      "tabletop",
    ),
    interactions: [
      interaction("open-laptop", "ノートPCを開く", "Open laptop", "toggle", {
        ambience: "laptop-open",
      }),
      interaction("study", "オンラインで勉強する", "Study online", "study", {
        focusBonus: 3,
      }),
    ],
    tags: ["modern", "laptop", "ergonomic", "bamboo"],
    coziness: 1,
    focus: 5,
  },
  {
    id: "sumi-calligraphy-set",
    name: { ja: "小さな書道具", en: "Little Calligraphy Set" },
    description: {
      ja: "硯、墨、細筆を木箱に収めた、静かな練習のための書道具。",
      en: "Inkstone, ink stick, and fine brush nested in a box for quiet practice.",
    },
    category: "study",
    price: 180,
    unlock: at(180),
    footprint: footprint(2, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "sumi-calligraphy-set",
      "indigo",
      ["slate", "sumi-ink", "bamboo", "paulownia"],
      ["box-shadow", "wood-tray", "inkstone", "ink-stick", "brush", "wet-glint"],
      "tabletop",
    ),
    interactions: [
      interaction("practice", "一文字書く", "Practice one character", "study", {
        ambience: "brush-on-paper",
        focusBonus: 3,
      }),
    ],
    tags: ["calligraphy", "traditional", "ink", "practice"],
    coziness: 3,
    focus: 4,
  },
  {
    id: "kana-flashcard-ring",
    name: { ja: "かな単語帳", en: "Kana Flashcard Ring" },
    description: {
      ja: "色分けした小さなカードを、真鍮の輪にまとめた単語帳。",
      en: "A color-coded set of small study cards held together by a brass ring.",
    },
    category: "study",
    price: 130,
    unlock: at(120),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "kana-flashcard-ring",
      "sakura",
      ["cardstock", "brass", "ink"],
      ["card-shadow", "fanned-cards", "color-tabs", "kana-marks", "brass-ring"],
      "tabletop",
    ),
    interactions: [
      interaction("review", "五枚復習する", "Review five cards", "study", {
        ambience: "cards-flick",
        focusBonus: 2,
      }),
    ],
    tags: ["language", "flashcards", "portable", "stationery"],
    coziness: 1,
    focus: 4,
  },
  {
    id: "walnut-focus-radio",
    name: { ja: "木箱の集中ラジオ", en: "Walnut Focus Radio" },
    description: {
      ja: "雨音や静かな音楽を選べる、手のひらサイズの木箱ラジオ。",
      en: "A palm-sized walnut radio tuned to rain sounds and quiet instrumental stations.",
    },
    category: "study",
    price: 260,
    unlock: afterSessions("kissaten-cafe", 3),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "walnut-focus-radio",
      "kissaten",
      ["walnut", "woven-speaker-cloth", "brass"],
      ["radio-shadow", "wood-case", "speaker-grille", "dial", "antenna", "pilot-light"],
      "tabletop",
      { animation: "pilot-light-pulse" },
    ),
    interactions: [
      interaction("tune", "集中放送を選ぶ", "Tune focus station", "toggle", {
        ambience: "lofi-radio",
        focusBonus: 3,
      }),
    ],
    tags: ["audio", "focus", "radio", "kissaten"],
    coziness: 4,
    focus: 4,
  },
] as const satisfies readonly ItemDefinition[];

const LIGHTING_ITEMS = [
  {
    id: "milk-glass-desk-lamp",
    name: { ja: "乳白硝子の机灯", en: "Milk-Glass Desk Lamp" },
    description: {
      ja: "手元だけをやさしく照らす、乳白硝子と真鍮の小さな机灯。",
      en: "A small brass and milk-glass lamp that keeps its warm light on the page.",
    },
    category: "lighting",
    price: 0,
    unlock: starter(),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "milk-glass-desk-lamp",
      "amber",
      ["opal-glass", "brass", "cloth-cord"],
      ["lamp-shadow", "brass-base", "stem", "glass-shade", "warm-core", "rim"],
      "tabletop",
      { animation: "warm-light-breathe" },
    ),
    interactions: [
      interaction("switch-light", "灯りをつける", "Switch light", "toggle", {
        ambience: "pull-chain",
        focusBonus: 1,
      }),
    ],
    tags: ["starter", "desk-lamp", "warm-light", "glass"],
    coziness: 3,
    focus: 3,
  },
  {
    id: "cedar-andon",
    name: { ja: "杉枠の行灯", en: "Cedar Andon" },
    description: {
      ja: "杉の細い格子から和紙の光がこぼれる、床置きの行灯。",
      en: "A floor andon whose washi glow spills between a fine cedar lattice.",
    },
    category: "lighting",
    price: 100,
    unlock: starter(),
    footprint: footprint(1, 1, "floor"),
    locations: room,
    visual: visual(
      "cedar-andon",
      "washi",
      ["cedar", "washi", "warm-led"],
      ["floor-glow", "wood-feet", "paper-body", "lattice", "light-core"],
      "furniture-high",
      { animation: "paper-lantern-flicker" },
    ),
    interactions: [
      interaction("switch-light", "行灯をともす", "Light the andon", "toggle", {
        ambience: "soft-switch",
      }),
    ],
    tags: ["andon", "floor-lamp", "washi", "traditional"],
    coziness: 5,
    focus: 2,
  },
  {
    id: "pleated-washi-pendant",
    name: { ja: "折り和紙の吊り灯", en: "Pleated Washi Pendant" },
    description: {
      ja: "折り目が光の濃淡をつくる、軽やかな和紙の吊り灯。",
      en: "A weightless washi pendant whose pleats turn one glow into many shades.",
    },
    category: "lighting",
    price: 150,
    unlock: at(60),
    footprint: footprint(2, 2, "ceiling", "none", false),
    locations: room,
    visual: visual(
      "pleated-washi-pendant",
      "washi",
      ["washi", "bamboo", "braided-cord"],
      ["cord", "bamboo-ribs", "pleated-shade", "light-core", "lower-fringe"],
      "canopy",
      {
        anchor: { x: 0.5, y: 0.18 },
        shadow: "none",
        animation: "pendant-sway",
      },
    ),
    interactions: [
      interaction("dim", "明るさを変える", "Adjust brightness", "toggle", {
        ambience: "dimmer-click",
      }),
    ],
    tags: ["ceiling", "washi", "pendant", "soft-light"],
    coziness: 4,
    focus: 2,
  },
  {
    id: "shoji-window-lamp",
    name: { ja: "障子窓の灯り", en: "Shoji Window Light" },
    description: {
      ja: "曇りの日にも夕陽を思わせる、障子の裏に置く間接照明。",
      en: "A hidden shoji light that recalls evening sun even on cloudy days.",
    },
    category: "lighting",
    price: 180,
    unlock: at(120),
    footprint: footprint(2, 1, "wall", "none", false),
    locations: room,
    visual: visual(
      "shoji-window-lamp",
      "amber",
      ["washi", "cedar", "diffused-led"],
      ["wall-halo", "paper-panel", "lattice", "sunset-gradient", "frame"],
      "wall",
      {
        anchor: { x: 0.5, y: 0.5 },
        shadow: "none",
        animation: "sunset-glow-cycle",
      },
    ),
    interactions: [
      interaction("set-glow", "光の色を選ぶ", "Choose glow color", "toggle", {
        ambience: "paper-touch",
      }),
    ],
    tags: ["shoji", "wall-light", "ambient", "sunset"],
    coziness: 5,
    focus: 2,
  },
  {
    id: "firefly-glass-jar",
    name: { ja: "蛍色の硝子瓶", en: "Firefly Glass Jar" },
    description: {
      ja: "本物の蛍ではなく、小さな光粒がゆっくり瞬く再生硝子の瓶。",
      en: "A recycled-glass jar of tiny artificial lights that blink like summer fireflies.",
    },
    category: "lighting",
    price: 130,
    unlock: at(180),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: home,
    visual: visual(
      "firefly-glass-jar",
      "moss",
      ["recycled-glass", "cork", "micro-led"],
      ["jar-shadow", "glass-body", "cork", "light-specks", "glass-glints"],
      "tabletop",
      { animation: "firefly-twinkle" },
    ),
    interactions: [
      interaction("release-light", "光を眺める", "Watch the lights", "observe", {
        ambience: "summer-night",
      }),
    ],
    tags: ["glass", "firefly", "summer", "ambient"],
    coziness: 5,
    focus: 1,
  },
  {
    id: "crescent-wall-sconce",
    name: { ja: "三日月の壁灯", en: "Crescent Wall Sconce" },
    description: {
      ja: "漆喰の壁に細い月影を映す、銅色の小さな壁灯。",
      en: "A copper-toned sconce that throws a slender moon shadow on plaster.",
    },
    category: "lighting",
    price: 140,
    unlock: at(180),
    footprint: footprint(1, 1, "wall", "none", false),
    locations: room,
    visual: visual(
      "crescent-wall-sconce",
      "copper",
      ["hammered-copper", "frosted-glass"],
      ["wall-halo", "mount", "crescent-shell", "glass-core", "edge-glint"],
      "wall",
      {
        anchor: { x: 0.5, y: 0.5 },
        shadow: "none",
        animation: "moonlight-pulse",
      },
    ),
    interactions: [
      interaction("switch-light", "月灯りをつける", "Switch moonlight", "toggle"),
    ],
    tags: ["wall-light", "moon", "copper", "night"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "stone-garden-lantern",
    name: { ja: "小さな石灯籠", en: "Little Stone Lantern" },
    description: {
      ja: "苔むした笠の下に夕方だけ灯る、小ぶりな石灯籠。",
      en: "A modest moss-touched stone lantern that wakes only at dusk.",
    },
    category: "lighting",
    price: 220,
    unlock: at(240),
    footprint: footprint(1, 1, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "stone-garden-lantern",
      "moss",
      ["granite", "moss", "warm-led"],
      ["ground-shadow", "stone-base", "hollow-chamber", "roof-stone", "moss", "glow"],
      "furniture-high",
      { animation: "dusk-lantern-flicker" },
    ),
    interactions: [
      interaction("light", "夕灯りをともす", "Light at dusk", "toggle", {
        ambience: "evening-insects",
      }),
    ],
    tags: ["garden", "stone", "lantern", "dusk"],
    coziness: 5,
    focus: 1,
  },
  {
    id: "kissaten-pendant",
    name: { ja: "喫茶店の琥珀灯", en: "Kissaten Amber Pendant" },
    description: {
      ja: "古い喫茶店のカウンターを思わせる、琥珀硝子の吊り灯。",
      en: "An amber-glass pendant recalling the counter of a beloved old kissaten.",
    },
    category: "lighting",
    price: 200,
    unlock: at(240),
    footprint: footprint(1, 1, "ceiling", "none", false),
    locations: room,
    visual: visual(
      "kissaten-pendant",
      "kissaten",
      ["amber-glass", "dark-brass", "cloth-cord"],
      ["cord", "brass-cap", "glass-shade", "filament", "amber-glow"],
      "canopy",
      {
        anchor: { x: 0.5, y: 0.12 },
        shadow: "none",
        animation: "filament-flicker",
      },
    ),
    interactions: [
      interaction("dim", "琥珀色に調節する", "Tune the amber glow", "toggle", {
        ambience: "rotary-dimmer",
      }),
    ],
    tags: ["kissaten", "ceiling", "glass", "vintage"],
    coziness: 6,
    focus: 2,
  },
  {
    id: "rain-chain-light",
    name: { ja: "鎖樋のきらめき", en: "Rain-Chain Light" },
    description: {
      ja: "雨粒の形をした小灯が軒下で揺れる、銅の鎖樋風ライト。",
      en: "Copper rain-chain lights whose droplet bulbs sway beneath the eaves.",
    },
    category: "lighting",
    price: 240,
    unlock: afterRhythmDays(3),
    footprint: footprint(1, 2, "wall", "none", false),
    locations: garden,
    visual: visual(
      "rain-chain-light",
      "copper",
      ["patinated-copper", "glass", "micro-led"],
      ["hanging-hook", "copper-cups", "glass-drops", "light-specks", "patina"],
      "wall",
      {
        anchor: { x: 0.5, y: 0.15 },
        shadow: "none",
        animation: "rain-chain-sway",
      },
    ),
    interactions: [
      interaction("listen", "雨の音を聴く", "Listen to rain", "observe", {
        ambience: "rain-chain",
      }),
    ],
    tags: ["garden", "rain", "copper", "hanging"],
    coziness: 6,
    focus: 1,
  },
  {
    id: "star-map-projector",
    name: { ja: "星図の投影灯", en: "Star-Map Projector" },
    description: {
      ja: "天井に季節の星座を映す、藍色の手回し投影灯。",
      en: "An indigo hand-wound lamp that projects seasonal constellations overhead.",
    },
    category: "lighting",
    price: 280,
    unlock: at(540),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "star-map-projector",
      "night",
      ["painted-tin", "etched-glass", "brass"],
      ["projector-shadow", "round-body", "star-apertures", "crank", "blue-glow"],
      "tabletop",
      { animation: "constellation-rotate" },
    ),
    interactions: [
      interaction("project", "星空を映す", "Project the stars", "toggle", {
        ambience: "quiet-night",
      }),
    ],
    tags: ["stars", "projector", "night", "seasonal"],
    coziness: 7,
    focus: 1,
  },
] as const satisfies readonly ItemDefinition[];

const DECOR_ITEMS = [
  {
    id: "steam-tea-tray",
    name: { ja: "湯気の茶盆", en: "Steaming Tea Tray" },
    description: {
      ja: "急須と二つの湯のみが揃った、すぐにひと休みできる茶盆。",
      en: "A ready tea tray with a small pot and two cups for an unhurried break.",
    },
    category: "decor",
    price: 0,
    unlock: starter(),
    footprint: footprint(2, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "steam-tea-tray",
      "ceramic",
      ["glazed-clay", "lacquered-wood", "tea"],
      ["tray-shadow", "lacquer-tray", "teapot", "cups", "tea-glints", "steam"],
      "tabletop",
      { animation: "tea-steam-curl" },
    ),
    interactions: [
      interaction("pour-tea", "お茶をいれる", "Pour tea", "instant", {
        ambience: "tea-pour",
      }),
    ],
    tags: ["starter", "tea", "ceramic", "break"],
    coziness: 5,
    focus: 0,
  },
  {
    id: "single-stem-ikebana",
    name: { ja: "一輪の生け花", en: "Single-Stem Ikebana" },
    description: {
      ja: "季節の枝を一輪だけ生けた、余白の美しい小さな花器。",
      en: "A small vessel holding one seasonal stem and plenty of breathing room.",
    },
    category: "decor",
    price: 80,
    unlock: starter(),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "single-stem-ikebana",
      "sakura",
      ["stoneware", "water", "seasonal-branch"],
      ["vase-shadow", "asymmetric-vase", "branch", "leaves", "single-bloom"],
      "tabletop",
      { animation: "petal-breathe" },
    ),
    interactions: [
      interaction("arrange", "枝の向きを整える", "Adjust the stem", "toggle", {
        ambience: "leaf-touch",
      }),
    ],
    tags: ["flowers", "ikebana", "minimal", "seasonal"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "rainy-town-print",
    name: { ja: "雨町の版画", en: "Rainy Town Print" },
    description: {
      ja: "傘の灯りが濡れた路地に映る、小さな多色刷りの版画。",
      en: "A small multicolor print of umbrella lights reflected in a wet alley.",
    },
    category: "decor",
    price: 100,
    unlock: at(45),
    footprint: footprint(2, 1, "wall", "none", false),
    locations: room,
    visual: visual(
      "rainy-town-print",
      "indigo",
      ["washi", "water-based-ink", "cedar-frame"],
      ["frame-shadow", "wood-frame", "washi-field", "town-blocks", "rain-lines", "seal"],
      "wall",
      { anchor: { x: 0.5, y: 0.5 }, shadow: "none" },
    ),
    interactions: [
      interaction("observe", "雨町を眺める", "Study the rainy town", "observe", {
        ambience: "soft-rain",
      }),
    ],
    tags: ["wall-art", "print", "rain", "town"],
    coziness: 3,
    focus: 1,
  },
  {
    id: "blue-glass-furin",
    name: { ja: "青硝子の風鈴", en: "Blue-Glass Furin" },
    description: {
      ja: "窓辺の風に澄んだ音を返す、朝顔模様の青い風鈴。",
      en: "A blue morning-glory wind bell that answers every breeze with a clear note.",
    },
    category: "decor",
    price: 120,
    unlock: at(90),
    footprint: footprint(1, 1, "ceiling", "none", false),
    locations: home,
    visual: visual(
      "blue-glass-furin",
      "hydrangea",
      ["blown-glass", "washi-strip", "cotton-thread"],
      ["hanging-thread", "glass-bell", "morning-glory", "clapper", "paper-strip"],
      "canopy",
      {
        anchor: { x: 0.5, y: 0.12 },
        shadow: "none",
        animation: "furin-sway-ring",
      },
    ),
    interactions: [
      interaction("listen", "風鈴の音を聴く", "Listen to the bell", "observe", {
        ambience: "glass-furin",
      }),
    ],
    tags: ["summer", "wind-bell", "glass", "hanging"],
    coziness: 5,
    focus: 1,
  },
  {
    id: "linen-noren",
    name: { ja: "麻の短い暖簾", en: "Short Linen Noren" },
    description: {
      ja: "山並みを一筆で染めた、光を通す短めの麻暖簾。",
      en: "A short, light-catching linen curtain dyed with one sweeping mountain line.",
    },
    category: "decor",
    price: 150,
    unlock: at(120),
    footprint: footprint(2, 1, "wall", "none", false),
    locations: room,
    visual: visual(
      "linen-noren",
      "indigo",
      ["linen", "indigo-dye", "bamboo-rod"],
      ["bamboo-rod", "left-panel", "right-panel", "mountain-brushstroke", "hem"],
      "wall",
      {
        anchor: { x: 0.5, y: 0.12 },
        shadow: "none",
        animation: "noren-breathe",
      },
    ),
    interactions: [
      interaction("part-curtain", "暖簾をくぐる", "Part the curtain", "toggle", {
        ambience: "linen-swish",
      }),
    ],
    tags: ["textile", "noren", "indigo", "doorway"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "ceramic-sleepy-cat",
    name: { ja: "眠り猫の置物", en: "Sleepy Cat Figurine" },
    description: {
      ja: "丸い尻尾に顎をのせた、白磁の小さな眠り猫。",
      en: "A tiny porcelain cat resting its chin on a perfectly round tail.",
    },
    category: "decor",
    price: 160,
    unlock: at(180),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "ceramic-sleepy-cat",
      "ceramic",
      ["porcelain", "underglaze"],
      ["figurine-shadow", "curled-body", "tail", "sleepy-face", "glaze-glints"],
      "tabletop",
      { animation: "sleepy-cat-breathe" },
    ),
    interactions: [
      interaction("greet", "そっと挨拶する", "Greet softly", "observe", {
        ambience: "tiny-purr-imagination",
      }),
    ],
    tags: ["cat", "ceramic", "figurine", "cute"],
    coziness: 5,
    focus: 0,
  },
  {
    id: "quiet-cuckoo-clock",
    name: { ja: "静かな鳩時計", en: "Quiet Cuckoo Clock" },
    description: {
      ja: "正時に一度だけ小鳥が顔を出す、音控えめの木の時計。",
      en: "A gentle wooden clock whose bird appears just once on the hour.",
    },
    category: "decor",
    price: 180,
    unlock: at(240),
    footprint: footprint(1, 2, "wall", "none", false),
    locations: room,
    visual: visual(
      "quiet-cuckoo-clock",
      "hinoki",
      ["walnut", "brass", "paper-dial"],
      ["wall-shadow", "clock-house", "roof", "dial", "pendulum", "tiny-door"],
      "wall",
      {
        anchor: { x: 0.5, y: 0.35 },
        shadow: "none",
        animation: "pendulum-slow",
      },
    ),
    interactions: [
      interaction("check-time", "時刻を見る", "Check the time", "observe", {
        ambience: "single-clock-note",
      }),
    ],
    tags: ["clock", "wall", "bird", "wood"],
    coziness: 4,
    focus: 2,
  },
  {
    id: "season-wheel-scroll",
    name: { ja: "七十二候の掛け軸", en: "Microseasons Scroll" },
    description: {
      ja: "季節の小さな変化を円に描いた、淡彩の掛け軸。",
      en: "A softly painted scroll charting Japan's subtle microseasons in a wheel.",
    },
    category: "decor",
    price: 200,
    unlock: at(300),
    footprint: footprint(2, 2, "wall", "none", false),
    locations: room,
    visual: visual(
      "season-wheel-scroll",
      "washi",
      ["washi", "mineral-pigment", "silk-brocade", "cedar"],
      ["top-rod", "brocade-border", "paper-field", "season-wheel", "calligraphy", "bottom-rod"],
      "wall",
      { anchor: { x: 0.5, y: 0.28 }, shadow: "none" },
    ),
    interactions: [
      interaction("observe-season", "今日の季節を読む", "Read today's season", "observe", {
        ambience: "paper-scroll",
      }),
    ],
    tags: ["scroll", "seasons", "wall-art", "calendar"],
    coziness: 4,
    focus: 2,
  },
  {
    id: "walnut-record-player",
    name: { ja: "胡桃のレコード台", en: "Walnut Record Player" },
    description: {
      ja: "低い音で古いジャズを鳴らす、胡桃材の小型レコード台。",
      en: "A compact walnut record player made for old jazz at considerate volume.",
    },
    category: "decor",
    price: 220,
    unlock: afterSessions("kissaten-cafe", 2),
    footprint: footprint(2, 1, "floor"),
    locations: room,
    visual: visual(
      "walnut-record-player",
      "kissaten",
      ["walnut", "vinyl", "brushed-aluminum", "felt"],
      ["cabinet-shadow", "wood-cabinet", "platter", "record", "tonearm", "pilot-light"],
      "furniture-high",
      { animation: "record-spin" },
    ),
    interactions: [
      interaction("play-record", "レコードをかける", "Play a record", "toggle", {
        ambience: "warm-vinyl-jazz",
      }),
    ],
    tags: ["music", "vinyl", "kissaten", "wood"],
    coziness: 7,
    focus: 2,
  },
  {
    id: "plush-tanuki",
    name: { ja: "まるい狸のぬいぐるみ", en: "Round Tanuki Plush" },
    description: {
      ja: "本棚の隅からいつも見守る、手縫いのまるい狸。",
      en: "A round hand-sewn tanuki who keeps watch from the corner of a shelf.",
    },
    category: "decor",
    price: 260,
    unlock: at(540),
    footprint: footprint(1, 1, "floor", "walkable"),
    locations: room,
    visual: visual(
      "plush-tanuki",
      "copper",
      ["brushed-cotton", "felt", "embroidery-thread"],
      ["plush-shadow", "round-body", "ears", "tail", "face-mask", "stitches"],
      "furniture-low",
      { animation: "plush-idle-bob" },
    ),
    interactions: [
      interaction("pat", "頭をなでる", "Pat its head", "instant", {
        ambience: "plush-squish",
      }),
    ],
    tags: ["plush", "tanuki", "cute", "handmade"],
    coziness: 7,
    focus: 0,
  },
] as const satisfies readonly ItemDefinition[];

const GARDEN_ITEMS = [
  {
    id: "river-stone-path",
    name: { ja: "川石の飛び石", en: "River-Stone Path" },
    description: {
      ja: "雨に濡れると色が深くなる、丸い川石三つの飛び石。",
      en: "Three rounded river stones whose colors deepen whenever it rains.",
    },
    category: "garden",
    price: 0,
    unlock: at(45),
    footprint: footprint(3, 1, "outdoor-ground", "walkable"),
    locations: garden,
    visual: visual(
      "river-stone-path",
      "moss",
      ["river-stone", "moss", "sand"],
      ["ground-darkening", "rear-stone", "middle-stone", "front-stone", "moss-seams", "wet-glints"],
      "ground",
      { animation: "rain-wet-glint" },
    ),
    interactions: [
      interaction("step", "飛び石を渡る", "Cross the stones", "instant", {
        ambience: "stone-footsteps",
      }),
    ],
    tags: ["starter-garden", "path", "stone", "rain"],
    coziness: 2,
    focus: 1,
  },
  {
    id: "pillow-moss-rock",
    name: { ja: "苔のまくら石", en: "Pillow-Moss Rock" },
    description: {
      ja: "やわらかな苔が片側を包む、枕のように丸い庭石。",
      en: "A pillow-shaped garden rock tucked beneath a soft cap of moss.",
    },
    category: "garden",
    price: 0,
    unlock: at(45),
    footprint: footprint(1, 1, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "pillow-moss-rock",
      "moss",
      ["granite", "moss", "lichen"],
      ["ground-shadow", "rounded-stone", "moss-cap", "lichen-dots", "edge-light"],
      "floor",
      { animation: "moss-dew-sparkle" },
    ),
    interactions: [
      interaction("observe", "苔を眺める", "Admire the moss", "observe", {
        ambience: "garden-stillness",
      }),
    ],
    tags: ["starter-garden", "rock", "moss", "small"],
    coziness: 3,
    focus: 1,
  },
  {
    id: "herb-planter-box",
    name: { ja: "香草の木箱", en: "Herb Planter Box" },
    description: {
      ja: "紫蘇と三つ葉が風に香る、古材で作った細長い木箱。",
      en: "A slim reclaimed-wood box of shiso and mitsuba that scents the breeze.",
    },
    category: "garden",
    price: 80,
    unlock: at(90),
    footprint: footprint(2, 1, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "herb-planter-box",
      "hinoki",
      ["reclaimed-cedar", "soil", "shiso", "mitsuba"],
      ["soil-shadow", "wood-box", "dark-soil", "herb-stems", "leaf-clusters", "label"],
      "furniture-low",
      { animation: "herbs-breeze" },
    ),
    interactions: [
      interaction("tend", "香草を手入れする", "Tend the herbs", "instant", {
        ambience: "leaves-brush",
      }),
    ],
    tags: ["plants", "herbs", "planter", "edible"],
    coziness: 3,
    focus: 1,
  },
  {
    id: "bamboo-water-basin",
    name: { ja: "竹筧の手水鉢", en: "Bamboo Water Basin" },
    description: {
      ja: "竹筧から一滴ずつ水が落ちる、浅い石の手水鉢。",
      en: "A shallow stone basin fed one clear drop at a time by a bamboo spout.",
    },
    category: "garden",
    price: 120,
    unlock: at(120),
    footprint: footprint(2, 1, "water-edge"),
    locations: garden,
    visual: visual(
      "bamboo-water-basin",
      "ceramic",
      ["granite", "bamboo", "water", "moss"],
      ["ground-shadow", "stone-basin", "water-surface", "bamboo-spout", "moss", "ripples"],
      "furniture-low",
      { animation: "drop-and-ripple" },
    ),
    interactions: [
      interaction("listen", "水音を聴く", "Listen to the water", "observe", {
        ambience: "single-water-drops",
      }),
    ],
    tags: ["water", "bamboo", "stone", "garden"],
    coziness: 5,
    focus: 2,
  },
  {
    id: "blue-hydrangea-cluster",
    name: { ja: "青い紫陽花", en: "Blue Hydrangea Cluster" },
    description: {
      ja: "梅雨の光を受けて青紫に揺れる、丸い紫陽花の株。",
      en: "A rounded hydrangea bush shifting blue-violet in rainy-season light.",
    },
    category: "garden",
    price: 160,
    unlock: at(180),
    footprint: footprint(2, 2, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "blue-hydrangea-cluster",
      "hydrangea",
      ["foliage", "petals", "rainwater"],
      ["plant-shadow", "leaf-mass", "rear-flower-heads", "front-flower-heads", "petal-pixels", "dew"],
      "furniture-high",
      { animation: "hydrangea-rain-bob" },
    ),
    interactions: [
      interaction("observe", "花色を眺める", "Admire the colors", "observe", {
        ambience: "rain-on-leaves",
      }),
    ],
    tags: ["flowers", "hydrangea", "rainy-season", "blue"],
    coziness: 6,
    focus: 1,
  },
  {
    id: "split-bamboo-fence",
    name: { ja: "割竹の小垣", en: "Split-Bamboo Fence" },
    description: {
      ja: "庭の一角をやさしく区切る、低い割竹と棕櫚縄の垣根。",
      en: "A low split-bamboo fence tied with palm rope to gently shape the garden.",
    },
    category: "garden",
    price: 180,
    unlock: at(240),
    footprint: footprint(3, 1, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "split-bamboo-fence",
      "tatami",
      ["split-bamboo", "palm-rope"],
      ["fence-shadow", "rear-posts", "horizontal-rails", "split-slats", "rope-knots", "cut-ends"],
      "furniture-high",
    ),
    interactions: [
      interaction("open-panel", "小垣を開ける", "Open fence panel", "toggle", {
        ambience: "bamboo-knock",
      }),
    ],
    tags: ["fence", "bamboo", "boundary", "traditional"],
    coziness: 3,
    focus: 0,
  },
  {
    id: "miniature-maple-tree",
    name: { ja: "小さな山紅葉", en: "Little Mountain Maple" },
    description: {
      ja: "季節とともに若葉から深紅へ色づく、庭の主役になる紅葉。",
      en: "A garden centerpiece whose leaves travel from spring green to autumn crimson.",
    },
    category: "garden",
    price: 240,
    unlock: at(300),
    footprint: footprint(2, 2, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "miniature-maple-tree",
      "sakura",
      ["maple-bark", "foliage", "moss"],
      ["canopy-shadow", "trunk", "rear-branches", "leaf-masses", "leaf-sparks", "moss-base"],
      "canopy",
      { anchor: { x: 0.5, y: 0.92 }, animation: "maple-season-shift" },
    ),
    interactions: [
      interaction("observe-season", "葉の色を見る", "Check the leaves", "observe", {
        ambience: "maple-leaves",
      }),
    ],
    tags: ["tree", "maple", "seasonal", "canopy"],
    coziness: 7,
    focus: 2,
  },
  {
    id: "moon-viewing-bench",
    name: { ja: "月見の腰掛け", en: "Moon-Viewing Bench" },
    description: {
      ja: "二人で夜空を見上げられる、杉板の低い庭腰掛け。",
      en: "A low cedar garden bench wide enough for two people to watch the moon.",
    },
    category: "garden",
    price: 260,
    unlock: at(360),
    footprint: footprint(3, 1, "outdoor-ground"),
    locations: garden,
    visual: visual(
      "moon-viewing-bench",
      "night",
      ["weathered-cedar", "iron"],
      ["long-shadow", "stone-feet", "cedar-seat", "joinery", "moonlit-edge"],
      "furniture-low",
    ),
    interactions: [
      interaction("sit", "月を待つ", "Wait for the moon", "sit", {
        ambience: "night-garden",
      }),
      interaction("read", "外で読む", "Read outside", "study", { focusBonus: 1 }),
    ],
    tags: ["bench", "moon-viewing", "seating", "night"],
    coziness: 6,
    focus: 2,
  },
  {
    id: "rain-fed-lily-pond",
    name: { ja: "雨水の睡蓮鉢", en: "Rain-Fed Lily Pond" },
    description: {
      ja: "雨水をたたえ、白い睡蓮と小さな波紋を映す丸い水鉢。",
      en: "A round rainwater bowl reflecting one white lily and a world of ripples.",
    },
    category: "garden",
    price: 300,
    unlock: at(480),
    footprint: footprint(2, 2, "water-edge"),
    locations: garden,
    visual: visual(
      "rain-fed-lily-pond",
      "ceramic",
      ["dark-ceramic", "water", "lily-pad", "water-lily"],
      ["pond-shadow", "ceramic-rim", "water-surface", "lily-pads", "white-bloom", "ripples"],
      "floor",
      { animation: "pond-ripple-loop" },
    ),
    interactions: [
      interaction("observe", "水面を眺める", "Watch the water", "observe", {
        ambience: "pond-ripples",
      }),
    ],
    tags: ["pond", "water", "lily", "rain"],
    coziness: 7,
    focus: 2,
  },
  {
    id: "arched-garden-bridge",
    name: { ja: "朱塗りの反り橋", en: "Arched Garden Bridge" },
    description: {
      ja: "水鉢や砂紋の上に置ける、深い朱色の小さな反り橋。",
      en: "A small, deep-vermilion bridge for spanning a pond bowl or raked sand.",
    },
    category: "garden",
    price: 340,
    unlock: at(660),
    footprint: footprint(3, 2, "water-edge", "walkable"),
    locations: garden,
    visual: visual(
      "arched-garden-bridge",
      "amber",
      ["lacquered-cypress", "brass"],
      ["bridge-shadow", "arched-beams", "deck-planks", "rail-posts", "curved-rails", "brass-caps"],
      "furniture-high",
    ),
    interactions: [
      interaction("cross", "小橋を渡る", "Cross the bridge", "instant", {
        ambience: "wooden-bridge-step",
      }),
    ],
    tags: ["bridge", "vermilion", "water", "statement"],
    coziness: 7,
    focus: 1,
  },
] as const satisfies readonly ItemDefinition[];

const CAFE_ITEMS = [
  {
    id: "striped-coffee-cup",
    name: { ja: "縞模様の珈琲椀", en: "Striped Coffee Cup" },
    description: {
      ja: "喫茶店の濃い珈琲が似合う、飴色の縞模様の厚手カップ。",
      en: "A thick amber-striped cup made for the deep roast of a neighborhood kissaten.",
    },
    category: "cafe",
    price: 0,
    unlock: at(90),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "striped-coffee-cup",
      "kissaten",
      ["stoneware", "coffee", "glaze"],
      ["saucer-shadow", "saucer", "cup", "coffee-surface", "stripe", "steam"],
      "tabletop",
      { animation: "coffee-steam-curl" },
    ),
    interactions: [
      interaction("sip", "珈琲をひと口", "Take a sip", "instant", {
        ambience: "coffee-sip",
      }),
    ],
    tags: ["coffee", "cup", "kissaten", "starter-cafe"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "brass-siphon-brewer",
    name: { ja: "真鍮のサイフォン", en: "Brass Siphon Brewer" },
    description: {
      ja: "珈琲が上下する様子まで楽しい、真鍮台の小さなサイフォン。",
      en: "A brass-mounted siphon brewer as delightful to watch as the coffee is to drink.",
    },
    category: "cafe",
    price: 90,
    unlock: at(120),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "brass-siphon-brewer",
      "copper",
      ["borosilicate-glass", "brass", "coffee", "cloth-filter"],
      ["brewer-shadow", "brass-base", "lower-globe", "upper-globe", "stand", "coffee", "flame"],
      "tabletop",
      { animation: "siphon-brew-cycle" },
    ),
    interactions: [
      interaction("brew", "珈琲を淹れる", "Brew coffee", "toggle", {
        ambience: "siphon-bubbles",
      }),
    ],
    tags: ["coffee", "brewer", "glass", "brass"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "daily-cake-dome",
    name: { ja: "本日のケーキドーム", en: "Cake of the Day Dome" },
    description: {
      ja: "季節のケーキが一切れだけ入った、丸い硝子のケーキドーム。",
      en: "A round glass dome presenting one perfect slice of the seasonal cake.",
    },
    category: "cafe",
    price: 120,
    unlock: at(180),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "daily-cake-dome",
      "sakura",
      ["glass", "porcelain", "sponge-cake", "cream", "seasonal-fruit"],
      ["plate-shadow", "porcelain-plate", "cake-slice", "fruit", "glass-dome", "glass-glints"],
      "tabletop",
      { animation: "glass-highlight-pass" },
    ),
    interactions: [
      interaction("choose-slice", "今日のケーキを見る", "See today's cake", "observe", {
        ambience: "glass-dome-lift",
      }),
    ],
    tags: ["cake", "glass", "dessert", "seasonal"],
    coziness: 5,
    focus: 0,
  },
  {
    id: "handwritten-menu-board",
    name: { ja: "手書きの品書き", en: "Handwritten Menu Board" },
    description: {
      ja: "本日の珈琲と甘味を白墨で書ける、木枠の小さな黒板。",
      en: "A wood-framed chalkboard for writing today's coffee and sweets by hand.",
    },
    category: "cafe",
    price: 140,
    unlock: at(180),
    footprint: footprint(2, 1, "wall", "none", false),
    locations: room,
    visual: visual(
      "handwritten-menu-board",
      "kissaten",
      ["slate", "chalk", "walnut"],
      ["wall-shadow", "wood-frame", "slate-field", "chalk-heading", "menu-lines", "tiny-flourish"],
      "wall",
      { anchor: { x: 0.5, y: 0.5 }, shadow: "none" },
    ),
    interactions: [
      interaction("rewrite", "品書きを書き替える", "Rewrite the menu", "toggle", {
        ambience: "chalk-writing",
      }),
    ],
    tags: ["menu", "chalkboard", "wall", "kissaten"],
    coziness: 3,
    focus: 1,
  },
  {
    id: "green-velvet-cafe-stool",
    name: { ja: "緑天鵞絨の丸椅子", en: "Green Velvet Cafe Stool" },
    description: {
      ja: "深い緑の座面と真鍮の足掛けが光る、喫茶店風の丸椅子。",
      en: "A kissaten-style round stool with deep green velvet and a brass foot rail.",
    },
    category: "cafe",
    price: 180,
    unlock: at(240),
    footprint: footprint(1, 1, "floor"),
    locations: room,
    visual: visual(
      "green-velvet-cafe-stool",
      "kissaten",
      ["velvet", "dark-oak", "brass"],
      ["stool-shadow", "wood-legs", "brass-ring", "round-seat", "velvet-highlight"],
      "furniture-low",
    ),
    interactions: [
      interaction("sit", "丸椅子に座る", "Sit on the stool", "sit", {
        ambience: "stool-creak",
      }),
    ],
    tags: ["seating", "velvet", "cafe", "brass"],
    coziness: 4,
    focus: 2,
  },
  {
    id: "kissaten-magazine-rack",
    name: { ja: "喫茶店の雑誌立て", en: "Kissaten Magazine Rack" },
    description: {
      ja: "旅、音楽、建築の古い雑誌が並ぶ、細身の木製ラック。",
      en: "A slender wooden rack of old magazines about travel, music, and architecture.",
    },
    category: "cafe",
    price: 200,
    unlock: at(300),
    footprint: footprint(2, 1, "floor"),
    locations: room,
    visual: visual(
      "kissaten-magazine-rack",
      "kissaten",
      ["walnut", "printed-paper", "brass-labels"],
      ["rack-shadow", "wood-frame", "magazine-pockets", "cover-blocks", "titles", "brass-labels"],
      "furniture-high",
    ),
    interactions: [
      interaction("browse", "雑誌をめくる", "Browse a magazine", "observe", {
        ambience: "magazine-pages",
      }),
    ],
    tags: ["magazines", "storage", "reading", "cafe"],
    coziness: 4,
    focus: 1,
  },
  {
    id: "cream-soda-lamp",
    name: { ja: "クリームソーダ灯", en: "Cream Soda Lamp" },
    description: {
      ja: "翡翠色のソーダと赤いさくらんぼが光る、遊び心のある卓上灯。",
      en: "A playful table light glowing like jade soda beneath a red cherry.",
    },
    category: "cafe",
    price: 240,
    unlock: afterRhythmDays(5),
    footprint: footprint(1, 1, "tabletop", "none"),
    locations: room,
    visual: visual(
      "cream-soda-lamp",
      "moss",
      ["tinted-glass", "resin", "micro-led", "painted-metal"],
      ["glass-shadow", "soda-glass", "green-glow", "ice-cream-globe", "cherry", "straw"],
      "tabletop",
      { animation: "soda-bubbles-rise" },
    ),
    interactions: [
      interaction("switch-light", "ソーダ灯をつける", "Switch soda light", "toggle", {
        ambience: "soda-fizz",
      }),
    ],
    tags: ["lamp", "cream-soda", "retro", "playful"],
    coziness: 6,
    focus: 1,
  },
  {
    id: "walnut-listening-speaker",
    name: { ja: "胡桃の喫茶スピーカー", en: "Walnut Listening Speaker" },
    description: {
      ja: "低音を丸く響かせる、格子布張りの小さな木製スピーカー。",
      en: "A small wood speaker with woven grille cloth and beautifully rounded bass.",
    },
    category: "cafe",
    price: 280,
    unlock: afterSessions("kissaten-cafe", 5),
    footprint: footprint(2, 1, "floor"),
    locations: room,
    visual: visual(
      "walnut-listening-speaker",
      "kissaten",
      ["walnut", "woven-cloth", "paper-cone", "brass"],
      ["speaker-shadow", "wood-cabinet", "woven-grille", "woofer-ring", "badge", "pilot-light"],
      "furniture-high",
      { animation: "speaker-cone-subtle" },
    ),
    interactions: [
      interaction("play", "静かな曲を流す", "Play a quiet record", "toggle", {
        ambience: "kissaten-listening-room",
      }),
    ],
    tags: ["speaker", "audio", "walnut", "kissaten"],
    coziness: 7,
    focus: 2,
  },
  {
    id: "window-cafe-booth",
    name: { ja: "窓辺の喫茶ボックス席", en: "Window Cafe Booth" },
    description: {
      ja: "雨の日に長居したくなる、赤茶の革張りボックス席。",
      en: "A russet leather booth made for lingering beside a rainy window.",
    },
    category: "cafe",
    price: 320,
    unlock: at(540),
    footprint: footprint(3, 2, "floor"),
    locations: room,
    visual: visual(
      "window-cafe-booth",
      "kissaten",
      ["aged-leather", "walnut", "brass"],
      ["booth-shadow", "wood-plinth", "seat", "tufted-back", "piping", "brass-feet"],
      "furniture-high",
    ),
    interactions: [
      interaction("sit", "ボックス席に座る", "Slide into the booth", "sit", {
        ambience: "leather-seat",
      }),
      interaction("study", "喫茶気分で勉強する", "Study cafe-style", "study", {
        focusBonus: 2,
      }),
    ],
    tags: ["booth", "leather", "seating", "statement"],
    coziness: 8,
    focus: 3,
  },
  {
    id: "mini-kissaten-counter",
    name: { ja: "小さな喫茶カウンター", en: "Mini Kissaten Counter" },
    description: {
      ja: "珈琲道具と二席をまとめられる、飴色に磨いた本格カウンター。",
      en: "A polished amber-toned counter with room for coffee tools and two seats.",
    },
    category: "cafe",
    price: 360,
    unlock: at(660),
    footprint: footprint(4, 2, "floor"),
    locations: room,
    visual: visual(
      "mini-kissaten-counter",
      "kissaten",
      ["walnut", "aged-brass", "green-tile", "glass"],
      ["counter-shadow", "cabinet-base", "green-tile-panel", "walnut-top", "brass-rail", "glass-details"],
      "furniture-high",
    ),
    interactions: [
      interaction("serve", "一杯ふるまう", "Serve a cup", "instant", {
        ambience: "coffee-service",
      }),
      interaction("study", "カウンターで読む", "Read at the counter", "study", {
        focusBonus: 2,
      }),
    ],
    tags: ["counter", "coffee", "statement", "kissaten"],
    coziness: 8,
    focus: 2,
  },
] as const satisfies readonly ItemDefinition[];

export const ITEM_CATALOG: readonly ItemDefinition[] = Object.freeze([
  ...FURNITURE_ITEMS,
  ...STUDY_ITEMS,
  ...LIGHTING_ITEMS,
  ...DECOR_ITEMS,
  ...GARDEN_ITEMS,
  ...CAFE_ITEMS,
]);

/** Persist this alongside saves so later catalog migrations can be explicit. */
export const CATALOG_VERSION = "komorebi-catalog-v1" as const;

export const ITEM_BY_ID: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(ITEM_CATALOG.map((item) => [item.id, item])),
);

/** Zero-cost essentials granted on a new save; other starters remain shop choices. */
export const STARTER_ITEM_IDS: readonly string[] = Object.freeze(
  ITEM_CATALOG.filter(
    (item) => item.unlock.type === "starter" && item.price === 0,
  ).map((item) => item.id),
);

export function getItem(id: string): ItemDefinition | undefined {
  return ITEM_BY_ID[id];
}

export function getItemsForLocation(
  locationId: PlacementLocationId,
): readonly ItemDefinition[] {
  return ITEM_CATALOG.filter((item) => item.locations.includes(locationId));
}

export function getAffordableItems(
  balance: number,
  items: readonly ItemDefinition[] = ITEM_CATALOG,
): readonly ItemDefinition[] {
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0;
  return items.filter((item) => item.price <= safeBalance);
}

export function getUnlockedItems(
  context: UnlockContext,
): readonly ItemDefinition[] {
  return ITEM_CATALOG.filter((item) => isItemUnlocked(item, context));
}

export function totalCatalogCost(
  items: readonly ItemDefinition[] = ITEM_CATALOG,
): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
