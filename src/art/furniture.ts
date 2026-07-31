import { PALETTE } from "./palette";
import {
  createSeededRandom,
  makePixelArt,
  PixelPainter,
  rotatePixelArt,
  scalePixelArt,
  seedFrom,
} from "./pixel";
import type { PixelArt, PixelArtMetadata, PixelRect } from "./types";

export const FURNITURE_IDS = [
  "patchwork-zabuton",
  "round-chabudai",
  "folded-futon",
  "hinoki-writing-desk",
  "indigo-tansu",
  "low-manga-shelf",
  "engawa-bench",
  "persimmon-kotatsu",
  "woven-lounge-chair",
  "moon-shoji-divider",
  "seigaiha-notebook",
  "cedar-pencil-cup",
  "well-read-book-stack",
  "dictionary-reading-stand",
  "washi-desk-organizer",
  "daruma-study-timer",
  "slim-laptop-riser",
  "sumi-calligraphy-set",
  "kana-flashcard-ring",
  "walnut-focus-radio",
  "milk-glass-desk-lamp",
  "cedar-andon",
  "pleated-washi-pendant",
  "shoji-window-lamp",
  "firefly-glass-jar",
  "crescent-wall-sconce",
  "stone-garden-lantern",
  "kissaten-pendant",
  "rain-chain-light",
  "star-map-projector",
  "steam-tea-tray",
  "single-stem-ikebana",
  "rainy-town-print",
  "blue-glass-furin",
  "linen-noren",
  "ceramic-sleepy-cat",
  "quiet-cuckoo-clock",
  "season-wheel-scroll",
  "walnut-record-player",
  "plush-tanuki",
  "river-stone-path",
  "pillow-moss-rock",
  "herb-planter-box",
  "bamboo-water-basin",
  "blue-hydrangea-cluster",
  "split-bamboo-fence",
  "miniature-maple-tree",
  "moon-viewing-bench",
  "rain-fed-lily-pond",
  "arched-garden-bridge",
  "striped-coffee-cup",
  "brass-siphon-brewer",
  "daily-cake-dome",
  "handwritten-menu-board",
  "green-velvet-cafe-stool",
  "kissaten-magazine-rack",
  "cream-soda-lamp",
  "walnut-listening-speaker",
  "window-cafe-booth",
  "mini-kissaten-counter",
] as const;

export type FurnitureId = (typeof FURNITURE_IDS)[number];
export type FurnitureRotation = 0 | 90 | 180 | 270;

const NO_FURNITURE_ROTATION = Object.freeze([0] as const);
const QUARTER_TURN_FURNITURE_ROTATIONS = Object.freeze(
  [0, 90, 180, 270] as const,
);

/**
 * Only genuinely planar recipes can be quarter-turned without breaking the
 * fixed three-quarter camera. Upright, side-elevation, wall, and canopy props
 * intentionally remain 0-only until they receive authored directional cels.
 */
const PLANAR_ROTATION_IDS: ReadonlySet<FurnitureId> = new Set([
  "patchwork-zabuton",
  "seigaiha-notebook",
  "sumi-calligraphy-set",
  "kana-flashcard-ring",
  "river-stone-path",
  "pillow-moss-rock",
  "rain-fed-lily-pond",
]);

export function furnitureSupportedRotations(
  itemId: FurnitureId | string,
): readonly FurnitureRotation[] {
  return isFurnitureId(itemId) && PLANAR_ROTATION_IDS.has(itemId)
    ? QUARTER_TURN_FURNITURE_ROTATIONS
    : NO_FURNITURE_ROTATION;
}

export interface FurniturePalette {
  readonly outline: string;
  readonly shadow: string;
  readonly mid: string;
  readonly light: string;
  readonly accent: string;
}

export interface FurnitureSpriteOptions {
  readonly seed?: string | number;
  readonly variant?: number;
  readonly palette?: Partial<FurniturePalette>;
  readonly rotation?: FurnitureRotation;
}

interface FurnitureSpec {
  readonly width: number;
  readonly height: number;
  readonly category: "furniture" | "study" | "lighting" | "decor" | "garden" | "cafe";
  readonly renderBand: NonNullable<PixelArtMetadata["renderBand"]>;
}

const specs = {
  "patchwork-zabuton": [32, 17, "furniture", "furniture-low"],
  "round-chabudai": [58, 34, "furniture", "furniture-low"],
  "folded-futon": [62, 35, "furniture", "furniture-low"],
  "hinoki-writing-desk": [68, 48, "furniture", "furniture-low"],
  "indigo-tansu": [48, 58, "furniture", "furniture-high"],
  "low-manga-shelf": [58, 43, "furniture", "furniture-high"],
  "engawa-bench": [64, 37, "furniture", "furniture-low"],
  "persimmon-kotatsu": [68, 45, "furniture", "furniture-low"],
  "woven-lounge-chair": [42, 51, "furniture", "furniture-high"],
  "moon-shoji-divider": [66, 74, "furniture", "wall"],
  "seigaiha-notebook": [20, 13, "study", "tabletop"],
  "cedar-pencil-cup": [18, 27, "study", "tabletop"],
  "well-read-book-stack": [34, 25, "study", "tabletop"],
  "dictionary-reading-stand": [38, 31, "study", "tabletop"],
  "washi-desk-organizer": [36, 27, "study", "tabletop"],
  "daruma-study-timer": [24, 28, "study", "tabletop"],
  "slim-laptop-riser": [38, 29, "study", "tabletop"],
  "sumi-calligraphy-set": [44, 25, "study", "tabletop"],
  "kana-flashcard-ring": [16, 18, "study", "tabletop"],
  "walnut-focus-radio": [34, 29, "study", "tabletop"],
  "milk-glass-desk-lamp": [28, 39, "lighting", "tabletop"],
  "cedar-andon": [30, 46, "lighting", "furniture-high"],
  "pleated-washi-pendant": [30, 49, "lighting", "canopy"],
  "shoji-window-lamp": [34, 47, "lighting", "furniture-high"],
  "firefly-glass-jar": [22, 31, "lighting", "tabletop"],
  "crescent-wall-sconce": [31, 28, "lighting", "wall"],
  "stone-garden-lantern": [34, 54, "lighting", "furniture-high"],
  "kissaten-pendant": [32, 50, "lighting", "canopy"],
  "rain-chain-light": [26, 62, "lighting", "canopy"],
  "star-map-projector": [32, 34, "lighting", "tabletop"],
  "steam-tea-tray": [42, 27, "decor", "tabletop"],
  "single-stem-ikebana": [28, 42, "decor", "tabletop"],
  "rainy-town-print": [46, 54, "decor", "wall"],
  "blue-glass-furin": [24, 40, "decor", "canopy"],
  "linen-noren": [52, 65, "decor", "wall"],
  "ceramic-sleepy-cat": [32, 27, "decor", "furniture-low"],
  "quiet-cuckoo-clock": [30, 42, "decor", "wall"],
  "season-wheel-scroll": [36, 62, "decor", "wall"],
  "walnut-record-player": [46, 34, "decor", "tabletop"],
  "plush-tanuki": [32, 38, "decor", "furniture-low"],
  "river-stone-path": [52, 26, "garden", "ground"],
  "pillow-moss-rock": [38, 27, "garden", "ground"],
  "herb-planter-box": [52, 33, "garden", "furniture-low"],
  "bamboo-water-basin": [42, 37, "garden", "furniture-low"],
  "blue-hydrangea-cluster": [48, 45, "garden", "furniture-high"],
  "split-bamboo-fence": [68, 42, "garden", "furniture-high"],
  "miniature-maple-tree": [70, 86, "garden", "canopy"],
  "moon-viewing-bench": [70, 43, "garden", "furniture-low"],
  "rain-fed-lily-pond": [86, 54, "garden", "ground"],
  "arched-garden-bridge": [86, 54, "garden", "furniture-low"],
  "striped-coffee-cup": [14, 14, "cafe", "tabletop"],
  "brass-siphon-brewer": [32, 45, "cafe", "tabletop"],
  "daily-cake-dome": [38, 30, "cafe", "tabletop"],
  "handwritten-menu-board": [38, 50, "cafe", "furniture-high"],
  "green-velvet-cafe-stool": [34, 41, "cafe", "furniture-low"],
  "kissaten-magazine-rack": [46, 53, "cafe", "furniture-high"],
  "cream-soda-lamp": [26, 43, "cafe", "tabletop"],
  "walnut-listening-speaker": [30, 39, "cafe", "tabletop"],
  "window-cafe-booth": [82, 59, "cafe", "furniture-high"],
  "mini-kissaten-counter": [102, 64, "cafe", "furniture-high"],
} as const satisfies Record<FurnitureId, readonly [number, number, FurnitureSpec["category"], FurnitureSpec["renderBand"]]>;

const FURNITURE_RENDER_SCALE: Readonly<Partial<Record<FurnitureId, number>>> = Object.freeze({
  "cedar-pencil-cup": 0.68,
  "well-read-book-stack": 0.65,
  "dictionary-reading-stand": 0.7,
  "washi-desk-organizer": 0.66,
  "daruma-study-timer": 0.76,
  "slim-laptop-riser": 0.7,
  "sumi-calligraphy-set": 0.7,
  "walnut-focus-radio": 0.8,
  "milk-glass-desk-lamp": 0.7,
  "firefly-glass-jar": 0.7,
  "star-map-projector": 0.75,
  "steam-tea-tray": 0.72,
  "single-stem-ikebana": 0.76,
  "blue-glass-furin": 0.8,
  "ceramic-sleepy-cat": 0.82,
  "walnut-record-player": 0.82,
  "plush-tanuki": 0.86,
  "brass-siphon-brewer": 0.72,
  "daily-cake-dome": 0.7,
  "cream-soda-lamp": 0.72,
  "walnut-listening-speaker": 0.85,
});

export const FURNITURE_SPECS: Readonly<Record<FurnitureId, FurnitureSpec>> = Object.freeze(
  Object.fromEntries(
    FURNITURE_IDS.map((id) => {
      const [width, height, category, renderBand] = specs[id];
      const scale = FURNITURE_RENDER_SCALE[id] ?? 1;
      return [
        id,
        {
          width: Math.ceil(width * scale),
          height: Math.ceil(height * scale),
          category,
          renderBand,
        },
      ];
    }),
  ) as Record<FurnitureId, FurnitureSpec>,
);

const DEFAULT_FURNITURE_PALETTE: FurniturePalette = {
  outline: "#312824",
  shadow: "#604333",
  mid: "#936844",
  light: "#C09563",
  accent: "#344F63",
};

/**
 * The authored backplates use a warm, weathered 64-colour language. Furniture
 * recipes deliberately keep the shared master palette as their semantic input,
 * then pass through this furniture-only grade so movable props do not read as
 * clean stickers pasted over the room.
 */
const FURNITURE_TONE_MAP: Readonly<Record<string, string>> = Object.freeze({
  [PALETTE.inkDeep]: "#2B2524",
  [PALETTE.ink]: "#393230",
  [PALETTE.inkSoft]: "#4A413D",
  [PALETTE.inkLift]: "#65594F",
  [PALETTE.washi]: "#E8D7B4",
  [PALETTE.washiShadow]: "#CBB68E",
  [PALETTE.hinokiLight]: "#C69B64",
  [PALETTE.hinoki]: "#936844",
  [PALETTE.hinokiDark]: "#604333",
  [PALETTE.tatamiLight]: "#B8B47C",
  [PALETTE.tatami]: "#919766",
  [PALETTE.tatamiShadow]: "#68734F",
  [PALETTE.tatamiDark]: "#405143",
  [PALETTE.leafDeep]: "#263E34",
  [PALETTE.leafDark]: "#385443",
  [PALETTE.leaf]: "#55745A",
  [PALETTE.leafLight]: "#78916A",
  [PALETTE.leafSun]: "#A3AD78",
  [PALETTE.indigoDeep]: "#283A4D",
  [PALETTE.indigo]: "#344F63",
  [PALETTE.indigoLight]: "#507589",
  [PALETTE.sky]: "#739AA2",
  [PALETTE.skyLight]: "#A9C0B9",
  [PALETTE.vermilionDark]: "#843D35",
  [PALETTE.vermilion]: "#B45843",
  [PALETTE.vermilionLight]: "#D77A58",
  [PALETTE.sakuraLight]: "#DEC5B7",
  [PALETTE.sakura]: "#C9978D",
  [PALETTE.sakuraShadow]: "#9C6F6C",
  [PALETTE.soilDeep]: "#49362E",
  [PALETTE.soil]: "#684C3B",
  [PALETTE.soilLight]: "#916A50",
  [PALETTE.stoneDeep]: "#41494A",
  [PALETTE.stone]: "#616B68",
  [PALETTE.stoneLight]: "#8C958B",
  [PALETTE.stoneSun]: "#B8B59D",
  [PALETTE.waterDeep]: "#2B4852",
  [PALETTE.water]: "#426B72",
  [PALETTE.waterLight]: "#709595",
  [PALETTE.amberDeep]: "#784536",
  [PALETTE.amber]: "#B97843",
  [PALETTE.amberLight]: "#D7A95E",
  [PALETTE.glow]: "#EACB87",
  [PALETTE.plum]: "#5A3947",
  [PALETTE.ceramic]: "#C7CDBB",
  [PALETTE.ceramicShadow]: "#87968A",
});

const FINISH_EXCLUDED_COLORS = new Set([
  "#2B2524",
  "#312824",
  "#393230",
  "#EACB87",
]);
const CONTOUR_COLORS = new Set(["#2B2524", "#312824", "#393230"]);
/**
 * The opening room is a bright late-morning plate. These are its shipped
 * starter surfaces, so they receive a few transparent warm flecks within
 * existing material clusters. This is an art grade, not a positional light
 * system: placement, persistence, and world lighting remain renderer-owned.
 */
const SUNLIT_ROOM_STARTERS = new Set<FurnitureId>([
  "patchwork-zabuton",
  "round-chabudai",
  "folded-futon",
  "seigaiha-notebook",
  "milk-glass-desk-lamp",
  "steam-tea-tray",
]);

function parseHex(color: string): readonly [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
}

function mixHex(color: string, target: string, amount: number): string {
  const sourceRgb = parseHex(color);
  const targetRgb = parseHex(target);
  if (!sourceRgb || !targetRgb) return color;
  const channel = (index: 0 | 1 | 2): number =>
    Math.round(sourceRgb[index] + (targetRgb[index] - sourceRgb[index]) * amount);
  return `#${([0, 1, 2] as const)
    .map((index) => channel(index).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * Adds sparse, deterministic one-pixel grain only inside broad opaque colour
 * clusters. The outer silhouette and transparent bounds are never changed.
 */
function harmonizeFurnitureArt(art: PixelArt): PixelArt {
  const gradedCommands = art.commands.map((command) =>
    Object.freeze({
      ...command,
      color: FURNITURE_TONE_MAP[command.color] ?? command.color,
    }),
  );
  const raster = Array.from(
    { length: art.height },
    () => Array<string | null>(art.width).fill(null),
  );
  for (const command of gradedCommands) {
    if (command.alpha < 0.88) continue;
    const right = Math.min(art.width, command.x + command.width);
    const bottom = Math.min(art.height, command.y + command.height);
    for (let y = Math.max(0, command.y); y < bottom; y += 1) {
      for (let x = Math.max(0, command.x); x < right; x += 1) {
        raster[y]![x] = command.color;
      }
    }
  }

  const finish: PixelRect[] = [];
  const artId = (art.metadata.id ?? "").replace(/^furniture:/, "").split(":")[0] ?? "";
  const isSunlitStarter = isFurnitureId(artId) && SUNLIT_ROOM_STARTERS.has(artId);
  const finishSeed = seedFrom("furniture-finish", art.metadata.id ?? "unknown");
  for (let y = 1; y < art.height - 1; y += 1) {
    for (let x = 1; x < art.width - 1; x += 1) {
      const color = raster[y]![x];
      if (!color) continue;
      if (
        CONTOUR_COLORS.has(color) &&
        ((raster[y - 1]![x] === null && raster[y + 1]![x] !== null) ||
          (raster[y]![x - 1] === null && raster[y]![x + 1] !== null))
      ) {
        finish.push(
          Object.freeze({
            x,
            y,
            width: 1,
            height: 1,
            color: "#5A4638",
            alpha: 1,
          }),
        );
        continue;
      }
      if (FINISH_EXCLUDED_COLORS.has(color)) continue;
      if (
        raster[y - 1]![x] !== color ||
        raster[y + 1]![x] !== color ||
        raster[y]![x - 1] !== color ||
        raster[y]![x + 1] !== color
      ) {
        continue;
      }
      const hash = seedFrom(finishSeed, x, y);
      const roll = hash % 211;
      // Sparse transmitted window warmth is kept inside already-solid clusters
      // and deliberately translucent. It gives the starter pieces the room's
      // dappled morning response without introducing a second shadow language.
      if (isSunlitStarter && y < art.height * 0.72 && hash % 173 <= 1) {
        finish.push(
          Object.freeze({
            x,
            y,
            width: 1,
            height: 1,
            color: "#E7BF76",
            alpha: 0.34,
          }),
        );
      }
      if (roll > 16) continue;
      const isHighlight = roll <= 2 && y < art.height * 0.62;
      finish.push(
        Object.freeze({
          x,
          y,
          width:
            (roll === 4 || roll === 5) && raster[y]![x + 1] === color ? 2 : 1,
          height: 1,
          color: isHighlight
            ? mixHex(color, "#E8D7B4", 0.16)
            : mixHex(color, "#2B2524", 0.13),
          alpha: 1,
        }),
      );
    }
  }

  return Object.freeze({
    ...art,
    commands: Object.freeze([...gradedCommands, ...finish]),
    metadata: Object.freeze({
      ...art.metadata,
      tags: Object.freeze([...(art.metadata.tags ?? []), "warm-material-finish"]),
    }),
  });
}

/**
 * A close, warm occlusion cue for the sprite itself. The scene also owns a
 * broad projected shadow beneath every placement, so this deliberately stays
 * tucked under the contact points instead of drawing a second dark oval that
 * makes a movable prop feel stamped on top of its floor.
 */
function shadow(p: PixelPainter, width: number, height: number, radius = width * 0.34): void {
  const contactRadius = Math.max(3, Math.floor(radius * 0.68));
  const contactY = height - Math.max(3, Math.floor(radius * 0.12));
  p.ellipse(width / 2 + 1, contactY, contactRadius, 1, "#4D3D33", 0.11);
  p.rect(
    Math.floor(width / 2 - contactRadius * 0.52) + 1,
    contactY,
    Math.max(3, Math.floor(contactRadius * 1.04)),
    1,
    "#7B5B40",
    0.1,
  );
}

function littleSteam(p: PixelPainter, x: number, y: number, phase = 0): void {
  p.pixel(x + phase, y, PALETTE.washi, 0.75);
  p.pixel(x - 1 + phase, y - 2, PALETTE.washiShadow, 0.68);
  p.pixel(x + phase, y - 4, PALETTE.washi, 0.56);
}

function paintComfort(
  p: PixelPainter,
  id: FurnitureId,
  width: number,
  height: number,
  palette: FurniturePalette,
  random: ReturnType<typeof createSeededRandom>,
): void {
  shadow(p, width, height);
  switch (id) {
    case "patchwork-zabuton":
      // A low, diamond-shaped floor cushion: the cool lower rim and broken
      // stitched seams give it the same 3/4, weathered cadence as tatami.
      p.polygon([[2, 8], [8, 3], [23, 3], [30, 8], [27, 13], [21, 16], [8, 15], [2, 11]], palette.outline);
      p.polygon([[4, 8], [9, 4], [22, 4], [28, 8], [25, 12], [20, 14], [9, 13], [4, 10]], PALETTE.indigoDeep);
      p.polygon([[5, 11], [10, 13], [20, 14], [26, 12], [25, 14], [20, 16], [9, 15], [4, 12]], PALETTE.plum);
      p.polygon([[7, 8], [10, 5], [14, 5], [14, 9], [8, 10]], PALETTE.plum);
      p.polygon([[15, 5], [21, 5], [26, 8], [22, 10], [15, 9]], PALETTE.tatami);
      p.polygon([[8, 10], [14, 9], [14, 12], [10, 12]], PALETTE.sakuraShadow);
      p.polygon([[15, 10], [22, 10], [24, 12], [20, 13], [15, 12]], PALETTE.soil);
      p.hLine(7, 11, 4, PALETTE.indigoLight);
      p.hLine(17, 12, 4, PALETTE.washiShadow);
      p.hLine(10, 14, 10, PALETTE.indigoDeep);
      p.vLine(14, 5, 8, PALETTE.hinokiDark);
      p.pixel(15, 8, PALETTE.washi);
      p.pixel(6, 9, PALETTE.indigoLight);
      p.pixel(25, 8, PALETTE.washiShadow);
      p.pixel(8, 6, PALETTE.hinokiLight);
      break;
    case "round-chabudai":
      // A squat 3/4 round table: the oval top is deliberately asymmetric,
      // with a visible front apron, short splayed legs, and tight foot cues.
      p.ellipse(29, 14, 27, 9, palette.outline);
      p.ellipse(29, 12, 26, 8, palette.shadow);
      p.ellipse(28, 9, 24, 7, palette.mid);
      p.ellipse(27, 7, 20, 5, palette.light);
      p.hLine(14, 7, 11, "#D9B77F");
      p.hLine(29, 6, 10, "#B98050");
      p.hLine(8, 12, 11, "#B17E50");
      p.hLine(23, 10, 18, "#9B6844");
      p.hLine(18, 16, 27, palette.shadow, 2);
      p.polygon([[11, 18], [16, 18], [15, 28], [10, 29]], palette.outline);
      p.polygon([[12, 18], [15, 18], [14, 27], [11, 27]], palette.shadow);
      p.polygon([[43, 18], [48, 17], [49, 28], [44, 28]], palette.outline);
      p.polygon([[44, 18], [47, 18], [48, 26], [45, 26]], palette.shadow);
      p.hLine(8, 29, 8, palette.outline, 2);
      p.hLine(43, 28, 8, palette.outline, 2);
      p.hLine(10, 30, 5, "#6F513B");
      p.hLine(44, 29, 5, "#6F513B");
      p.pixel(14, 11, "#D9B77F");
      p.pixel(20, 8, "#E8D7B4");
      p.pixel(36, 14, "#80553B");
      // A tea cup catches the same warm window light without becoming a
      // floating icon: saucer, shaded bowl, rim, and a short steam cadence.
      p.ellipse(41, 9, 5, 2, PALETTE.ceramicShadow);
      p.rect(38, 4, 7, 6, PALETTE.ceramicShadow);
      p.rect(39, 4, 5, 5, PALETTE.ceramic);
      p.hLine(39, 4, 5, PALETTE.washi);
      p.pixel(39, 6, PALETTE.washi);
      littleSteam(p, 41, 4);
      break;
    case "folded-futon":
      // Soft, uneven quilt folds read as a weighted textile stack rather than
      // a box. The cool underside carries the room's shaded tatami rhythm.
      p.polygon([[6, 18], [12, 13], [49, 14], [56, 18], [53, 27], [10, 28]], palette.outline);
      p.polygon([[8, 18], [13, 15], [48, 16], [53, 19], [50, 25], [12, 26]], PALETTE.plum);
      p.polygon([[10, 21], [51, 20], [50, 25], [46, 27], [14, 26], [10, 24]], PALETTE.sakuraShadow);
      p.hLine(14, 22, 10, PALETTE.sakura);
      p.hLine(28, 24, 8, PALETTE.plum);
      p.hLine(40, 22, 7, PALETTE.sakura);
      p.hLine(17, 26, 11, PALETTE.indigoDeep);
      p.pixel(17, 24, PALETTE.washiShadow);
      p.pixel(38, 24, PALETTE.washiShadow);
      p.polygon([[8, 11], [14, 6], [47, 7], [55, 11], [52, 18], [11, 17]], PALETTE.hinokiDark);
      p.polygon([[10, 11], [15, 7], [46, 8], [52, 11], [49, 15], [13, 15]], PALETTE.washiShadow);
      p.polygon([[13, 8], [45, 8], [50, 11], [46, 13], [15, 12]], PALETTE.washi);
      p.hLine(14, 14, 13, PALETTE.sakuraShadow);
      p.hLine(32, 14, 14, PALETTE.tatamiShadow);
      p.hLine(18, 10, 8, "#F0DFBA");
      p.rect(40, 8, 9, 5, PALETTE.sakuraLight);
      p.hLine(42, 9, 5, PALETTE.washi);
      p.pixel(47, 12, PALETTE.sakuraShadow);
      p.pixel(12, 17, PALETTE.washiShadow);
      break;
    case "hinoki-writing-desk":
      p.rect(4, 15, 60, 18, palette.outline);
      p.rect(6, 11, 56, 17, palette.mid);
      p.hLine(8, 11, 52, palette.light, 3);
      p.hLine(10, 19, 46, palette.shadow);
      p.rect(9, 27, 6, 17, palette.shadow);
      p.rect(53, 27, 6, 17, palette.shadow);
      p.hLine(8, 43, 12, palette.outline, 3);
      p.hLine(48, 43, 12, palette.outline, 3);
      p.rect(20, 5, 23, 8, PALETTE.washi);
      p.vLine(31, 6, 6, PALETTE.indigo);
      p.rect(48, 6, 8, 6, PALETTE.ceramic);
      break;
    case "indigo-tansu":
      p.rect(4, 4, 40, 50, palette.outline);
      p.rect(7, 6, 34, 45, PALETTE.indigoDeep);
      p.hLine(8, 7, 32, PALETTE.indigoLight, 2);
      [17, 29, 41].forEach((y) => {
        p.hLine(7, y, 34, palette.outline, 2);
        p.rect(9, y - 8, 30, 8, PALETTE.indigo);
        p.rect(23, y - 5, 4, 2, PALETTE.amberLight);
      });
      p.rect(9, 51, 6, 4, palette.shadow);
      p.rect(34, 51, 6, 4, palette.shadow);
      break;
    case "low-manga-shelf":
      p.rect(2, 8, 54, 31, palette.outline);
      p.rect(5, 10, 48, 26, palette.shadow);
      p.hLine(5, 23, 48, palette.outline, 3);
      for (let shelf = 0; shelf < 2; shelf += 1) {
        let x = 7;
        const top = 12 + shelf * 13;
        while (x < 50) {
          const bookWidth = random.int(2, 4);
          const bookHeight = random.int(7, 10);
          p.rect(x, top + 9 - bookHeight, bookWidth, bookHeight, random.pick([
            PALETTE.indigo,
            PALETTE.vermilion,
            PALETTE.tatamiShadow,
            PALETTE.washiShadow,
          ]));
          p.hLine(x, top + 7 - bookHeight, bookWidth, PALETTE.washi, 1);
          x += bookWidth + 1;
        }
      }
      p.rect(7, 38, 6, 3, palette.outline);
      p.rect(45, 38, 6, 3, palette.outline);
      break;
    case "engawa-bench":
    case "moon-viewing-bench":
      p.rect(3, 10, width - 6, 14, palette.outline);
      p.rect(5, 7, width - 10, 13, palette.mid);
      p.hLine(7, 7, width - 14, palette.light, 3);
      for (let x = 8; x < width - 8; x += 11) p.vLine(x, 9, 10, palette.shadow);
      p.rect(10, 21, 6, height - 26, palette.shadow);
      p.rect(width - 16, 21, 6, height - 26, palette.shadow);
      p.hLine(8, height - 7, 13, palette.outline, 3);
      p.hLine(width - 21, height - 7, 13, palette.outline, 3);
      if (id === "moon-viewing-bench") {
        p.rect(width / 2 - 12, 3, 24, 6, PALETTE.indigo);
        p.hLine(width / 2 - 9, 3, 18, PALETTE.indigoLight);
      }
      break;
    case "persimmon-kotatsu":
      p.rect(4, 15, 60, 25, palette.outline);
      p.rect(7, 17, 54, 21, PALETTE.vermilionDark);
      p.rect(10, 20, 48, 17, PALETTE.vermilion);
      for (let x = 13; x < 58; x += 12) p.vLine(x, 21, 15, PALETTE.vermilionLight);
      p.ellipse(34, 38, 27, 5, PALETTE.vermilionDark);
      p.rect(3, 9, 62, 13, palette.shadow);
      p.rect(5, 6, 58, 12, palette.mid);
      p.hLine(7, 6, 54, palette.light, 3);
      p.rect(47, 1, 8, 7, PALETTE.ceramic);
      p.pixel(50, 3, PALETTE.amber);
      break;
    case "woven-lounge-chair":
      p.ellipse(21, 27, 18, 9, palette.outline);
      p.polygon([[6, 9], [15, 3], [33, 8], [36, 27], [8, 27]], palette.shadow);
      p.polygon([[9, 9], [16, 5], [30, 9], [32, 23], [11, 23]], PALETTE.tatami);
      for (let y = 10; y < 23; y += 4) p.hLine(10, y, 22, PALETTE.tatamiLight);
      for (let x = 12; x < 33; x += 5) p.vLine(x, 9, 15, PALETTE.tatamiShadow);
      p.rect(8, 24, 5, 22, palette.shadow);
      p.rect(30, 24, 5, 22, palette.shadow);
      p.hLine(6, 46, 11, palette.outline, 2);
      p.hLine(28, 46, 10, palette.outline, 2);
      break;
    case "moon-shoji-divider":
      p.rect(2, 2, 62, 70, palette.outline);
      p.rect(5, 5, 56, 64, palette.shadow);
      for (let panel = 0; panel < 3; panel += 1) {
        const x = 7 + panel * 18;
        p.rect(x, 7, 16, 60, PALETTE.washiShadow);
        for (let y = 17; y < 66; y += 11) p.hLine(x, y, 16, palette.shadow);
        p.vLine(x + 8, 7, 60, palette.shadow);
      }
      p.ellipse(33, 29, 13, 13, PALETTE.glow);
      p.ellipse(38, 25, 11, 11, PALETTE.washiShadow);
      p.rect(8, 69, 8, 4, palette.outline);
      p.rect(50, 69, 8, 4, palette.outline);
      break;
  }
}

function paintStudy(
  p: PixelPainter,
  id: FurnitureId,
  width: number,
  height: number,
  palette: FurniturePalette,
  random: ReturnType<typeof createSeededRandom>,
): void {
  shadow(p, width, height, width * 0.28);
  switch (id) {
    case "seigaiha-notebook":
      // A paper-thin, skewed notebook that follows the low table's top plane.
      // Its quiet lower rim stops it reading as a flat blue UI tile.
      p.polygon([[1, 5], [15, 2], [19, 8], [5, 12]], palette.outline);
      p.polygon([[3, 5], [14, 3], [17, 8], [5, 10]], PALETTE.indigoDeep);
      p.polygon([[5, 10], [17, 8], [18, 9], [6, 12]], PALETTE.plum);
      p.hLine(5, 5, 3, PALETTE.sky);
      p.hLine(10, 4, 3, PALETTE.indigoLight);
      p.pixel(4, 7, PALETTE.sky);
      p.pixel(8, 7, PALETTE.indigoDeep);
      p.pixel(12, 6, PALETTE.indigoDeep);
      p.hLine(6, 9, 4, PALETTE.indigoLight);
      p.hLine(12, 8, 3, PALETTE.indigoLight);
      p.hLine(6, 10, 10, PALETTE.washi);
      p.vLine(3, 5, 6, PALETTE.washiShadow);
      p.pixel(15, 5, PALETTE.skyLight);
      break;
    case "cedar-pencil-cup":
      p.rect(3, 9, 12, 15, palette.outline);
      p.rect(5, 10, 8, 13, palette.mid);
      p.hLine(5, 10, 8, palette.light, 2);
      [6, 9, 12].forEach((x, index) => {
        p.line(x, 11, x + index - 1, 2 + index, index === 1 ? PALETTE.vermilion : PALETTE.indigo, 2);
        p.pixel(x + index - 1, 1 + index, PALETTE.inkDeep);
      });
      break;
    case "well-read-book-stack":
      [[4, 17, 26, PALETTE.indigo], [7, 11, 22, PALETTE.vermilionDark], [3, 6, 25, PALETTE.tatamiShadow]].forEach(
        ([x, y, w, color]) => {
          p.rect(x as number, y as number, w as number, 6, palette.outline);
          p.rect((x as number) + 2, y as number, (w as number) - 3, 4, color as string);
          p.hLine((x as number) + 4, (y as number) + 1, (w as number) - 8, PALETTE.washi);
        },
      );
      p.rect(18, 3, 10, 4, PALETTE.washiShadow);
      break;
    case "dictionary-reading-stand":
      p.polygon([[3, 8], [17, 4], [18, 19], [4, 15]], PALETTE.washi);
      p.polygon([[19, 4], [34, 8], [33, 15], [19, 19]], PALETTE.washiShadow);
      p.vLine(18, 5, 15, PALETTE.indigo);
      for (let y = 9; y < 15; y += 3) {
        p.hLine(7, y, 8, PALETTE.stone);
        p.hLine(22, y, 8, PALETTE.stone);
      }
      p.polygon([[8, 17], [30, 17], [34, 27], [4, 27]], palette.shadow);
      p.hLine(7, 27, 25, palette.outline, 2);
      break;
    case "washi-desk-organizer":
      p.rect(3, 10, 30, 14, palette.outline);
      p.rect(5, 9, 8, 13, PALETTE.washiShadow);
      p.rect(14, 6, 8, 16, PALETTE.washi);
      p.rect(23, 11, 8, 11, PALETTE.washiShadow);
      p.hLine(6, 11, 6, PALETTE.vermilion);
      p.hLine(15, 8, 6, PALETTE.indigo);
      p.hLine(24, 13, 6, PALETTE.tatamiShadow);
      break;
    case "daruma-study-timer":
      p.ellipse(12, 16, 9, 11, PALETTE.vermilionDark);
      p.ellipse(12, 13, 8, 8, PALETTE.vermilion);
      p.rect(7, 9, 10, 7, PALETTE.washi);
      p.pixel(9, 12, PALETTE.inkDeep);
      p.frame(13, 10, 3, 4, PALETTE.inkDeep);
      p.hLine(9, 16, 7, PALETTE.inkDeep);
      p.rect(5, 22, 14, 4, PALETTE.vermilionDark);
      break;
    case "slim-laptop-riser":
      p.polygon([[5, 5], [31, 5], [34, 18], [7, 18]], palette.outline);
      p.polygon([[7, 7], [29, 7], [31, 16], [9, 16]], PALETTE.indigo);
      p.hLine(10, 9, 12, PALETTE.indigoLight, 2);
      p.hLine(13, 12, 15, PALETTE.sky, 1);
      p.rect(16, 18, 5, 6, palette.shadow);
      p.polygon([[8, 24], [29, 24], [33, 27], [5, 27]], palette.mid);
      break;
    case "sumi-calligraphy-set":
      p.rect(2, 11, 40, 11, palette.outline);
      p.rect(4, 12, 36, 8, palette.shadow);
      p.rect(6, 13, 13, 6, PALETTE.inkDeep);
      p.pixel(8, 14, PALETTE.inkLift);
      p.line(21, 17, 36, 3, palette.mid, 2);
      p.pixel(37, 2, PALETTE.inkDeep);
      p.rect(25, 17, 11, 3, PALETTE.washi);
      p.hLine(27, 18, 7, PALETTE.inkSoft);
      break;
    case "kana-flashcard-ring":
      // Three high-contrast, visibly separated cards plus an offset binder ring.
      p.polygon([[0, 7], [7, 2], [12, 12], [5, 17]], palette.outline);
      p.polygon([[2, 7], [7, 4], [10, 12], [5, 15]], PALETTE.sakuraShadow);
      p.polygon([[3, 3], [12, 4], [12, 15], [3, 14]], palette.outline);
      p.polygon([[5, 5], [10, 5], [10, 13], [5, 12]], PALETTE.tatamiShadow);
      p.polygon([[6, 5], [15, 3], [15, 15], [6, 17]], palette.outline);
      p.polygon([[8, 6], [13, 5], [13, 14], [8, 15]], PALETTE.washi);
      p.circle(3, 4, 3, PALETTE.amberLight);
      p.circle(3, 4, 1, PALETTE.inkDeep);
      // A tiny original kana-like study mark, not a font glyph.
      p.hLine(9, 8, 4, PALETTE.indigo);
      p.vLine(11, 8, 4, PALETTE.indigo);
      p.hLine(8, 13, 3, PALETTE.indigoLight);
      break;
    case "walnut-focus-radio":
      p.rect(2, 5, 30, 21, palette.outline);
      p.rect(4, 7, 26, 17, PALETTE.soil);
      p.hLine(5, 7, 24, palette.light, 2);
      p.rect(6, 11, 12, 9, PALETTE.inkSoft);
      for (let x = 7; x < 18; x += 3) p.vLine(x, 12, 7, PALETTE.inkLift);
      p.circle(24, 14, 4, PALETTE.amber);
      p.circle(24, 14, 2, PALETTE.inkDeep);
      p.hLine(21, 21, 6, PALETTE.washiShadow);
      p.line(27, 5, 31, 0, PALETTE.inkSoft);
      break;
  }
}

function paintLighting(
  p: PixelPainter,
  id: FurnitureId,
  width: number,
  height: number,
  palette: FurniturePalette,
  random: ReturnType<typeof createSeededRandom>,
): void {
  if (!["pleated-washi-pendant", "kissaten-pendant", "rain-chain-light"].includes(id)) {
    shadow(p, width, height, width * 0.26);
  }
  switch (id) {
    case "milk-glass-desk-lamp":
      // Slightly skewed milk glass. Its inner glow is restrained so it shares
      // the existing shoji/window warmth instead of looking like a UI lamp.
      p.ellipse(14, 34, 9, 3, palette.outline);
      p.ellipse(14, 32, 7, 3, PALETTE.amberDeep);
      p.ellipse(13, 31, 5, 2, PALETTE.amber);
      p.polygon([[12, 17], [16, 17], [17, 31], [12, 31]], PALETTE.amberDeep);
      p.polygon([[13, 18], [15, 18], [16, 29], [13, 29]], PALETTE.amberLight);
      p.polygon([[7, 8], [20, 7], [23, 18], [4, 18]], PALETTE.hinokiDark);
      p.polygon([[9, 7], [19, 7], [21, 15], [6, 15]], PALETTE.amberDeep);
      p.polygon([[10, 8], [18, 8], [19, 13], [8, 14]], PALETTE.amber);
      p.polygon([[8, 14], [20, 13], [21, 16], [7, 17]], PALETTE.amberDeep);
      p.hLine(9, 14, 10, PALETTE.amberLight);
      p.hLine(11, 8, 6, PALETTE.glow);
      p.pixel(9, 11, PALETTE.washi);
      p.pixel(18, 14, PALETTE.washiShadow);
      break;
    case "cedar-andon":
      p.rect(4, 5, 22, 39, palette.outline);
      p.rect(7, 8, 16, 32, PALETTE.amber);
      p.rect(9, 10, 12, 27, PALETTE.glow);
      p.vLine(14, 8, 32, palette.shadow, 2);
      for (let y = 17; y < 39; y += 10) p.hLine(6, y, 18, palette.shadow, 2);
      p.rect(2, 42, 26, 3, palette.shadow);
      p.pixel(12, 25, PALETTE.washi);
      break;
    case "pleated-washi-pendant":
      p.vLine(15, 0, 14, palette.outline);
      p.rect(11, 12, 8, 5, palette.shadow);
      p.polygon([[6, 16], [24, 16], [28, 37], [2, 37]], PALETTE.washiShadow);
      for (let x = 6; x < 26; x += 4) p.line(x, 17, x - 2, 36, PALETTE.washi);
      p.rect(5, 36, 20, 4, PALETTE.amber);
      p.hLine(8, 37, 14, PALETTE.glow, 2);
      break;
    case "shoji-window-lamp":
      p.rect(4, 4, 26, 40, palette.outline);
      p.rect(7, 7, 20, 34, PALETTE.glow);
      p.vLine(17, 6, 36, palette.shadow, 2);
      for (let y = 15; y < 41; y += 9) p.hLine(6, y, 22, palette.shadow, 2);
      p.rect(2, 43, 30, 3, palette.shadow);
      p.pixel(11, 12, PALETTE.washi);
      break;
    case "firefly-glass-jar":
      p.rect(7, 4, 8, 3, palette.shadow);
      p.hLine(6, 7, 10, PALETTE.ceramicShadow, 2);
      p.ellipse(11, 19, 8, 11, PALETTE.ceramicShadow, 0.85);
      p.ellipse(11, 18, 6, 9, PALETTE.indigoLight, 0.46);
      // Broken outline and transmitted highlight keep the glass from reading
      // as a phone-shaped opaque rectangle.
      p.vLine(3, 13, 10, PALETTE.ceramicShadow);
      p.vLine(19, 12, 11, PALETTE.ceramicShadow);
      p.hLine(6, 28, 10, PALETTE.ceramicShadow);
      p.hLine(6, 11, 5, PALETTE.washi, 2);
      p.pixel(5, 17, PALETTE.skyLight, 0.7);
      for (let i = 0; i < 5; i += 1) {
        p.pixel(random.int(7, 15), random.int(14, 24), PALETTE.glow);
      }
      break;
    case "crescent-wall-sconce":
      p.rect(3, 4, 24, 20, palette.outline);
      p.ellipse(15, 14, 9, 9, PALETTE.glow);
      p.ellipse(19, 10, 8, 8, PALETTE.inkSoft);
      p.rect(5, 23, 20, 3, palette.shadow);
      p.pixel(8, 7, PALETTE.washi);
      break;
    case "stone-garden-lantern":
      p.rect(13, 27, 8, 22, PALETTE.stone);
      p.vLine(13, 28, 20, PALETTE.stoneLight);
      p.rect(7, 19, 20, 10, PALETTE.stoneDeep);
      p.rect(10, 21, 14, 6, PALETTE.glow);
      p.polygon([[3, 18], [17, 8], [31, 18], [27, 21], [7, 21]], PALETTE.stoneDeep);
      p.hLine(8, 17, 18, PALETTE.stoneLight, 2);
      p.rect(9, 49, 17, 3, PALETTE.stoneDeep);
      break;
    case "kissaten-pendant":
      p.vLine(16, 0, 18, palette.outline, 2);
      p.rect(11, 15, 10, 5, palette.shadow);
      p.polygon([[7, 19], [25, 19], [30, 34], [2, 34]], PALETTE.soil);
      p.polygon([[9, 20], [23, 20], [26, 31], [6, 31]], PALETTE.amber);
      p.rect(6, 32, 20, 4, PALETTE.glow);
      p.hLine(9, 33, 14, PALETTE.washi, 2);
      break;
    case "rain-chain-light":
      p.vLine(13, 0, 58, palette.outline);
      for (let y = 4; y < 56; y += 8) {
        p.ellipse(13, y, 5, 3, PALETTE.ceramicShadow);
        p.ellipse(13, y - 1, 4, 2, PALETTE.waterLight);
        p.pixel(12, y - 2, PALETTE.glow);
      }
      p.ellipse(13, 58, 9, 3, PALETTE.waterDeep);
      break;
    case "star-map-projector":
      p.ellipse(16, 27, 13, 5, palette.outline);
      p.polygon([[7, 9], [25, 9], [28, 27], [4, 27]], PALETTE.indigoDeep);
      p.ellipse(16, 9, 9, 4, PALETTE.indigo);
      p.ellipse(16, 8, 6, 3, PALETTE.sky);
      for (let i = 0; i < 8; i += 1) {
        p.pixel(random.int(8, 24), random.int(12, 24), PALETTE.glow);
      }
      p.rect(11, 29, 10, 2, palette.shadow);
      break;
  }
}

function paintDecor(
  p: PixelPainter,
  id: FurnitureId,
  width: number,
  height: number,
  palette: FurniturePalette,
): void {
  if (!["rainy-town-print", "blue-glass-furin", "linen-noren", "quiet-cuckoo-clock", "season-wheel-scroll"].includes(id)) {
    shadow(p, width, height, width * 0.25);
  }
  switch (id) {
    case "steam-tea-tray":
      // A shallow tray in the same diagonal plane as the chabudai. The front
      // lip, saucers, and broken steam preserve scale without flat icon edges.
      p.ellipse(21, 20, 19, 5, palette.outline);
      p.polygon([[3, 14], [36, 11], [41, 16], [38, 21], [7, 23], [3, 19]], palette.shadow);
      p.polygon([[5, 14], [35, 12], [39, 16], [36, 19], [8, 21], [5, 18]], palette.mid);
      p.hLine(9, 14, 18, palette.light);
      p.hLine(11, 20, 21, "#7A5139");
      p.ellipse(14, 15, 7, 2, PALETTE.ceramicShadow);
      p.polygon([[8, 9], [18, 8], [19, 15], [9, 16]], PALETTE.ceramic);
      p.hLine(10, 9, 7, PALETTE.washi);
      p.ellipse(29, 16, 6, 2, PALETTE.indigoDeep);
      p.polygon([[25, 10], [33, 10], [34, 16], [26, 17]], PALETTE.indigo);
      p.pixel(29, 12, PALETTE.glow);
      p.pixel(11, 12, PALETTE.washi);
      littleSteam(p, 14, 6);
      littleSteam(p, 29, 8, 1);
      break;
    case "single-stem-ikebana":
      p.ellipse(14, 35, 10, 4, palette.outline);
      p.rect(8, 23, 12, 12, PALETTE.ceramicShadow);
      p.rect(10, 21, 8, 12, PALETTE.ceramic);
      p.line(14, 23, 12, 6, PALETTE.leafDark, 2);
      p.line(14, 18, 22, 10, PALETTE.leafDark);
      p.rect(18, 8, 7, 5, PALETTE.sakuraShadow);
      p.rect(20, 6, 5, 5, PALETTE.sakura);
      p.rect(7, 13, 7, 3, PALETTE.leaf);
      break;
    case "rainy-town-print":
      p.rect(2, 2, 42, 50, palette.outline);
      p.rect(5, 5, 36, 44, PALETTE.indigoDeep);
      p.rect(7, 7, 32, 15, PALETTE.indigo);
      p.polygon([[7, 33], [17, 23], [27, 29], [39, 20], [39, 48], [7, 48]], PALETTE.inkSoft);
      p.rect(12, 28, 8, 19, PALETTE.soil);
      p.rect(24, 31, 11, 16, PALETTE.hinokiDark);
      p.pixel(15, 34, PALETTE.glow);
      p.pixel(29, 37, PALETTE.glow);
      for (let x = 9; x < 39; x += 5) p.line(x, 9, x - 4, 20, PALETTE.sky);
      break;
    case "blue-glass-furin":
      p.vLine(12, 0, 8, palette.outline);
      p.ellipse(12, 13, 9, 8, PALETTE.water);
      p.ellipse(10, 10, 5, 4, PALETTE.waterLight);
      p.rect(5, 14, 15, 4, PALETTE.waterDeep);
      p.vLine(12, 17, 15, PALETTE.washiShadow);
      p.polygon([[8, 29], [16, 27], [15, 38], [9, 36]], PALETTE.washi);
      p.hLine(10, 31, 4, PALETTE.indigo);
      break;
    case "linen-noren":
      p.hLine(2, 2, 48, palette.shadow, 4);
      p.rect(5, 6, 42, 55, PALETTE.washiShadow);
      for (let x = 5; x < 48; x += 14) p.vLine(x, 6, 55, palette.shadow);
      p.vLine(26, 31, 30, PALETTE.washi);
      p.hLine(13, 20, 8, PALETTE.indigo);
      p.vLine(17, 14, 17, PALETTE.indigo);
      p.hLine(31, 27, 9, PALETTE.tatamiShadow);
      p.hLine(7, 60, 40, palette.outline, 2);
      break;
    case "ceramic-sleepy-cat":
      p.ellipse(17, 19, 13, 6, palette.outline);
      p.ellipse(18, 16, 11, 7, PALETTE.ceramic);
      p.circle(9, 12, 7, PALETTE.ceramic);
      p.polygon([[4, 8], [6, 2], [10, 8]], PALETTE.ceramicShadow);
      p.polygon([[10, 7], [15, 3], [15, 10]], PALETTE.ceramic);
      p.hLine(5, 13, 3, PALETTE.inkSoft);
      p.hLine(10, 13, 3, PALETTE.inkSoft);
      p.pixel(9, 15, PALETTE.sakuraShadow);
      p.line(27, 15, 30, 10, PALETTE.ceramicShadow, 2);
      break;
    case "quiet-cuckoo-clock":
      p.polygon([[3, 13], [15, 2], [27, 13], [27, 37], [3, 37]], palette.outline);
      p.polygon([[6, 14], [15, 6], [24, 14], [24, 34], [6, 34]], palette.mid);
      p.circle(15, 22, 7, PALETTE.washi);
      p.line(15, 22, 15, 17, PALETTE.inkDeep);
      p.line(15, 22, 19, 24, PALETTE.inkDeep);
      p.rect(11, 10, 8, 6, PALETTE.inkSoft);
      p.pixel(15, 12, PALETTE.sakura);
      p.vLine(15, 35, 6, palette.outline);
      p.circle(15, 39, 2, PALETTE.amber);
      break;
    case "season-wheel-scroll":
      p.hLine(3, 2, 30, palette.shadow, 4);
      p.rect(7, 5, 22, 51, PALETTE.washi);
      p.vLine(7, 5, 51, PALETTE.washiShadow);
      p.circle(18, 27, 9, PALETTE.indigo);
      p.ellipse(15, 24, 5, 5, PALETTE.sakura);
      p.rect(18, 18, 7, 8, PALETTE.leaf);
      p.rect(18, 27, 8, 8, PALETTE.amberLight);
      p.rect(11, 28, 7, 8, PALETTE.skyLight);
      p.hLine(3, 56, 30, palette.shadow, 4);
      p.vLine(18, 59, 3, palette.outline);
      break;
    case "walnut-record-player":
      p.rect(2, 11, 42, 19, palette.outline);
      p.rect(4, 12, 38, 16, PALETTE.soil);
      p.hLine(5, 12, 36, palette.light, 2);
      p.ellipse(16, 20, 8, 6, PALETTE.inkDeep);
      p.circle(16, 20, 2, PALETTE.vermilion);
      p.line(30, 15, 23, 21, PALETTE.amberLight, 2);
      p.circle(31, 14, 2, PALETTE.stoneLight);
      p.rect(6, 30, 5, 2, palette.shadow);
      p.rect(36, 30, 5, 2, palette.shadow);
      break;
    case "plush-tanuki":
      p.ellipse(15, 29, 12, 6, palette.outline);
      p.ellipse(15, 25, 10, 10, PALETTE.soil);
      p.circle(15, 13, 9, PALETTE.soilLight);
      p.polygon([[7, 9], [8, 3], [13, 9]], palette.shadow);
      p.polygon([[18, 9], [23, 3], [24, 10]], palette.shadow);
      p.polygon([[6, 11], [13, 8], [14, 15], [8, 17]], PALETTE.inkSoft);
      p.polygon([[16, 8], [24, 11], [22, 17], [16, 15]], PALETTE.inkSoft);
      p.pixel(11, 12, PALETTE.washi);
      p.pixel(20, 12, PALETTE.washi);
      p.ellipse(15, 17, 4, 3, PALETTE.washiShadow);
      p.pixel(15, 16, PALETTE.inkDeep);
      p.ellipse(15, 26, 6, 6, PALETTE.washiShadow);
      p.ellipse(26, 25, 4, 9, palette.shadow);
      p.hLine(23, 21, 7, PALETTE.washiShadow, 2);
      p.hLine(23, 27, 7, PALETTE.inkSoft, 2);
      break;
  }
}

function paintGardenItem(
  p: PixelPainter,
  id: FurnitureId,
  width: number,
  height: number,
  palette: FurniturePalette,
  random: ReturnType<typeof createSeededRandom>,
): void {
  shadow(p, width, height, width * 0.35);
  switch (id) {
    case "river-stone-path":
      [[10, 15, 9, 5], [27, 10, 10, 6], [42, 17, 7, 5]].forEach(([x, y, rx, ry], index) => {
        p.ellipse(x!, y! + 2, rx! + 1, ry!, PALETTE.leafDeep, 0.25);
        p.ellipse(x!, y!, rx!, ry!, index & 1 ? PALETTE.stone : PALETTE.stoneLight);
        p.hLine(x! - rx! + 3, y! - 2, rx!, PALETTE.stoneSun);
      });
      break;
    case "pillow-moss-rock":
      p.ellipse(19, 18, 17, 7, PALETTE.stoneDeep);
      p.ellipse(18, 15, 15, 9, PALETTE.stone);
      p.polygon([[5, 15], [10, 8], [26, 5], [33, 13], [29, 18], [8, 19]], PALETTE.leafDark);
      p.rect(11, 8, 15, 5, PALETTE.leaf);
      p.pixel(15, 8, PALETTE.leafLight);
      p.pixel(25, 11, PALETTE.leafSun);
      break;
    case "herb-planter-box":
      p.rect(3, 14, 46, 15, palette.outline);
      p.rect(5, 12, 42, 14, palette.mid);
      p.hLine(6, 12, 40, palette.light, 2);
      p.rect(7, 9, 38, 6, PALETTE.soilDeep);
      for (let x = 10; x < 44; x += 6) {
        const top = random.int(1, 7);
        p.vLine(x, top + 4, 9 - top, PALETTE.leafDark);
        p.rect(x - 3, top + 3, 4, 2, PALETTE.leaf);
        p.rect(x + 1, top + 5, 4, 2, PALETTE.leafLight);
      }
      p.rect(7, 27, 5, 4, palette.shadow);
      p.rect(40, 27, 5, 4, palette.shadow);
      break;
    case "bamboo-water-basin":
      p.ellipse(21, 27, 17, 7, PALETTE.stoneDeep);
      p.ellipse(21, 23, 15, 8, PALETTE.stone);
      p.ellipse(21, 21, 11, 5, PALETTE.water);
      p.hLine(15, 19, 10, PALETTE.waterLight);
      p.rect(4, 2, 5, 21, PALETTE.leafDark);
      p.vLine(5, 3, 18, PALETTE.leafLight, 2);
      p.hLine(3, 8, 7, PALETTE.leafDeep, 2);
      p.rect(7, 6, 27, 6, PALETTE.leafDark);
      p.hLine(9, 7, 23, PALETTE.leafLight, 2);
      p.rect(31, 8, 8, 5, PALETTE.leafDeep);
      p.hLine(33, 11, 5, PALETTE.waterLight, 2);
      p.pixel(36, 15, PALETTE.waterLight);
      p.pixel(35, 18, PALETTE.water);
      break;
    case "blue-hydrangea-cluster":
      for (let i = 0; i < 14; i += 1) {
        const x = random.int(8, 40);
        const y = random.int(5, 25);
        p.circle(x, y, random.int(3, 5), random.chance(0.5) ? PALETTE.indigoLight : PALETTE.sky);
        p.pixel(x, y, PALETTE.washi);
      }
      for (let x = 8; x < 43; x += 8) {
        p.line(x, 21, 24, 41, PALETTE.leafDeep, 2);
        p.ellipse(x, 31, 7, 3, x & 1 ? PALETTE.leaf : PALETTE.leafLight);
      }
      break;
    case "split-bamboo-fence":
      for (let x = 5; x < 65; x += 9) {
        p.rect(x, 4 + (x % 3), 6, 34, PALETTE.leafDark);
        p.vLine(x + 1, 5 + (x % 3), 31, PALETTE.leafLight, 2);
        for (let y = 13; y < 36; y += 11) p.hLine(x, y, 6, PALETTE.leafDeep, 2);
      }
      p.hLine(2, 15, 64, palette.shadow, 4);
      p.hLine(2, 29, 64, palette.shadow, 4);
      p.line(3, 13, 65, 31, PALETTE.tatamiShadow, 2);
      break;
    case "miniature-maple-tree":
      p.rect(32, 34, 7, 46, palette.shadow);
      p.vLine(33, 35, 43, palette.mid, 2);
      p.line(35, 49, 18, 28, palette.shadow, 3);
      p.line(37, 44, 54, 23, palette.shadow, 3);
      for (let i = 0; i < 18; i += 1) {
        const x = random.int(8, 62);
        const y = random.int(8, 35);
        p.polygon([[x, y - 5], [x + 3, y - 2], [x + 7, y - 2], [x + 4, y + 1], [x + 6, y + 4], [x + 1, y + 3], [x, y + 7], [x - 2, y + 3], [x - 6, y + 4], [x - 4, y], [x - 7, y - 2], [x - 3, y - 2]], random.pick([
          PALETTE.vermilionDark,
          PALETTE.vermilion,
          PALETTE.vermilionLight,
          PALETTE.amberLight,
        ]));
      }
      p.ellipse(35, 81, 18, 4, PALETTE.leafDeep, 0.25);
      break;
    case "rain-fed-lily-pond":
      p.ellipse(43, 39, 41, 13, PALETTE.stoneDeep);
      p.ellipse(43, 34, 38, 16, PALETTE.waterDeep);
      p.ellipse(42, 31, 34, 13, PALETTE.water);
      p.hLine(17, 27, 23, PALETTE.waterLight);
      p.hLine(49, 39, 20, PALETTE.waterLight);
      [[26, 28], [55, 24], [65, 35]].forEach(([x, y], index) => {
        p.ellipse(x!, y!, 8, 3, PALETTE.leafDark);
        p.rect(x! - 1, y! - 6, 4, 5, index === 1 ? PALETTE.sakura : PALETTE.washi);
      });
      for (let i = 0; i < 6; i += 1) p.pixel(random.int(12, 74), random.int(20, 39), PALETTE.skyLight);
      break;
    case "arched-garden-bridge":
      p.polygon([[3, 35], [18, 16], [43, 8], [68, 16], [83, 35], [78, 43], [64, 27], [43, 20], [21, 27], [8, 43]], PALETTE.vermilionDark);
      p.polygon([[8, 31], [22, 18], [43, 12], [64, 18], [78, 31], [74, 36], [61, 25], [43, 19], [25, 25], [12, 36]], PALETTE.vermilion);
      for (let x = 12; x < 78; x += 9) p.line(x, 24 - Math.floor(Math.abs(43 - x) / 7), x + 1, 37, palette.shadow, 2);
      p.line(4, 25, 20, 8, PALETTE.vermilionLight, 2);
      p.line(20, 8, 43, 2, PALETTE.vermilionLight, 2);
      p.line(43, 2, 67, 8, PALETTE.vermilionLight, 2);
      p.line(67, 8, 83, 25, PALETTE.vermilionLight, 2);
      break;
    case "moon-viewing-bench":
      p.rect(3, 11, width - 6, 14, palette.outline);
      p.rect(5, 8, width - 10, 13, palette.mid);
      p.hLine(7, 8, width - 14, palette.light, 3);
      for (let x = 9; x < width - 8; x += 12) p.vLine(x, 10, 10, palette.shadow);
      p.rect(10, 22, 6, height - 27, palette.shadow);
      p.rect(width - 16, 22, 6, height - 27, palette.shadow);
      p.hLine(8, height - 7, 13, palette.outline, 3);
      p.hLine(width - 21, height - 7, 13, palette.outline, 3);
      p.rect(width / 2 - 12, 3, 24, 6, PALETTE.indigo);
      p.hLine(width / 2 - 9, 3, 18, PALETTE.indigoLight);
      p.circle(width / 2 + 5, 5, 2, PALETTE.washi);
      break;
  }
}

function paintCafeItem(
  p: PixelPainter,
  id: FurnitureId,
  width: number,
  height: number,
  palette: FurniturePalette,
): void {
  shadow(p, width, height, width * 0.3);
  switch (id) {
    case "striped-coffee-cup":
      // Final-size cup: readable rim, striped bowl, handle, saucer, and steam.
      p.rect(2, 5, 8, 6, palette.outline);
      p.rect(3, 5, 6, 5, PALETTE.ceramic);
      p.hLine(3, 5, 6, PALETTE.soilDeep);
      p.hLine(3, 7, 6, PALETTE.indigo);
      p.hLine(3, 9, 6, PALETTE.vermilion);
      p.frame(9, 6, 4, 4, palette.outline);
      p.hLine(1, 11, 12, PALETTE.ceramicShadow, 2);
      p.pixel(5, 3, PALETTE.washi);
      p.pixel(6, 1, PALETTE.washiShadow);
      p.pixel(8, 3, PALETTE.washi);
      break;
    case "brass-siphon-brewer":
      p.ellipse(13, 10, 8, 9, PALETTE.ceramicShadow);
      p.ellipse(13, 9, 6, 7, PALETTE.skyLight, 0.58);
      p.hLine(9, 4, 7, PALETTE.washi, 2);
      p.ellipse(13, 14, 5, 3, PALETTE.soilDeep);
      p.rect(10, 15, 6, 8, PALETTE.amber);
      p.ellipse(13, 31, 9, 11, PALETTE.ceramicShadow);
      p.ellipse(13, 30, 7, 9, PALETTE.skyLight, 0.62);
      p.ellipse(13, 33, 6, 6, PALETTE.soil);
      p.pixel(9, 26, PALETTE.washi);
      p.rect(24, 6, 4, 33, PALETTE.amber);
      p.hLine(20, 11, 8, PALETTE.amberLight, 2);
      p.hLine(20, 33, 8, PALETTE.amberLight, 2);
      p.hLine(3, 39, 27, PALETTE.amberLight, 3);
      break;
    case "daily-cake-dome":
      p.ellipse(19, 24, 17, 4, palette.outline);
      p.hLine(4, 22, 30, PALETTE.ceramic, 3);
      p.rect(8, 12, 23, 10, PALETTE.skyLight, 0.42);
      p.ellipse(19, 11, 12, 8, PALETTE.skyLight, 0.48);
      p.line(7, 13, 11, 6, PALETTE.ceramicShadow);
      p.line(31, 13, 27, 6, PALETTE.ceramicShadow);
      p.hLine(8, 21, 23, PALETTE.ceramicShadow);
      p.polygon([[12, 16], [24, 14], [27, 21], [12, 21]], PALETTE.washiShadow);
      p.hLine(13, 16, 11, PALETTE.sakura, 2);
      p.pixel(25, 18, PALETTE.vermilion);
      p.circle(19, 3, 2, PALETTE.amber);
      break;
    case "handwritten-menu-board":
      p.rect(3, 4, 32, 40, palette.outline);
      p.rect(6, 7, 26, 34, PALETTE.inkSoft);
      p.hLine(9, 11, 18, PALETTE.washi, 2);
      p.hLine(11, 17, 14, PALETTE.amberLight);
      p.hLine(8, 22, 20, PALETTE.washiShadow);
      p.hLine(12, 27, 12, PALETTE.sakura);
      p.hLine(9, 33, 18, PALETTE.washiShadow);
      p.rect(7, 44, 5, 4, palette.shadow);
      p.rect(26, 44, 5, 4, palette.shadow);
      break;
    case "green-velvet-cafe-stool":
      p.ellipse(17, 12, 14, 8, palette.outline);
      p.ellipse(17, 9, 13, 7, PALETTE.leafDark);
      p.ellipse(15, 7, 9, 4, PALETTE.leafLight);
      p.rect(7, 14, 5, 21, palette.shadow);
      p.rect(23, 14, 5, 21, palette.shadow);
      p.hLine(7, 27, 21, palette.mid, 3);
      p.hLine(5, 35, 9, palette.outline, 2);
      p.hLine(21, 35, 9, palette.outline, 2);
      break;
    case "kissaten-magazine-rack":
      p.rect(3, 6, 40, 43, palette.outline);
      p.rect(6, 9, 34, 37, PALETTE.soil);
      for (let shelf = 0; shelf < 3; shelf += 1) {
        const y = 12 + shelf * 11;
        p.polygon([[7, y + 6], [39, y + 2], [39, y + 9], [7, y + 12]], palette.shadow);
        for (let x = 9; x < 37; x += 7) {
          p.polygon(
            [[x, y + 1], [x + 6, y], [x + 6, y + 7], [x, y + 8]],
            [PALETTE.indigo, PALETTE.vermilion, PALETTE.tatamiShadow][
              Math.floor(x / 7 + shelf) % 3
            ]!,
          );
          p.line(x + 1, y + 2, x + 5, y + 1, PALETTE.washi);
        }
      }
      p.rect(7, 49, 5, 3, palette.outline);
      p.rect(35, 49, 5, 3, palette.outline);
      break;
    case "cream-soda-lamp":
      p.rect(11, 18, 4, 17, palette.shadow);
      p.ellipse(13, 36, 9, 3, palette.outline);
      p.polygon([[5, 5], [21, 5], [18, 23], [8, 23]], PALETTE.skyLight);
      p.polygon([[7, 9], [19, 9], [17, 21], [9, 21]], PALETTE.leafLight);
      p.rect(8, 8, 10, 4, PALETTE.washi);
      p.circle(14, 6, 3, PALETTE.vermilion);
      p.vLine(18, 2, 17, PALETTE.washiShadow);
      p.pixel(12, 15, PALETTE.glow);
      break;
    case "walnut-listening-speaker":
      p.rect(3, 3, 24, 33, palette.outline);
      p.rect(6, 5, 18, 28, PALETTE.soil);
      p.hLine(7, 5, 16, palette.light, 2);
      p.circle(15, 13, 6, PALETTE.inkSoft);
      p.circle(15, 13, 3, PALETTE.inkDeep);
      p.circle(15, 26, 7, PALETTE.inkSoft);
      p.circle(15, 26, 3, PALETTE.inkDeep);
      p.pixel(20, 6, PALETTE.amberLight);
      p.rect(7, 36, 5, 2, palette.shadow);
      p.rect(20, 36, 5, 2, palette.shadow);
      break;
    case "window-cafe-booth":
      p.rect(3, 9, 76, 44, palette.outline);
      p.rect(6, 12, 70, 24, PALETTE.leafDeep);
      p.rect(8, 14, 66, 19, PALETTE.leaf);
      p.hLine(10, 14, 62, PALETTE.leafLight, 3);
      for (let x = 15; x < 73; x += 15) p.vLine(x, 16, 16, PALETTE.leafDark);
      p.rect(7, 35, 68, 14, PALETTE.soil);
      p.hLine(9, 35, 64, PALETTE.hinokiLight, 2);
      p.rect(10, 49, 7, 7, palette.shadow);
      p.rect(64, 49, 7, 7, palette.shadow);
      break;
    case "mini-kissaten-counter":
      p.rect(3, 16, 96, 43, palette.outline);
      p.rect(6, 18, 90, 38, PALETTE.soil);
      p.hLine(7, 18, 88, palette.light, 3);
      for (let x = 12; x < 94; x += 14) p.vLine(x, 22, 32, palette.shadow);
      p.rect(1, 10, 100, 13, palette.shadow);
      p.rect(3, 7, 96, 12, palette.mid);
      p.hLine(5, 7, 92, palette.light, 3);
      p.rect(14, 0, 27, 8, PALETTE.inkSoft);
      p.rect(18, 2, 8, 5, PALETTE.ceramicShadow);
      p.rect(30, 2, 7, 5, PALETTE.amber);
      p.rect(69, 1, 11, 7, PALETTE.ceramic);
      p.rect(17, 56, 7, 5, palette.outline);
      p.rect(78, 56, 7, 5, palette.outline);
      break;
  }
}

function isFurnitureId(value: string): value is FurnitureId {
  return (FURNITURE_IDS as readonly string[]).includes(value);
}

/**
 * Every catalog item has an explicit deterministic recipe. Unknown IDs still
 * resolve to an attractive labeled parcel, which keeps save migrations playable
 * while surfacing the missing visual through metadata.
 */
export function createFurnitureSprite(
  itemId: FurnitureId | string,
  options: FurnitureSpriteOptions = {},
): PixelArt {
  const known = isFurnitureId(itemId);
  const rotation = options.rotation ?? 0;
  if (!furnitureSupportedRotations(itemId).includes(rotation)) {
    throw new RangeError(
      `${itemId} does not have an authored ${rotation}-degree furniture cel`,
    );
  }
  const spec: FurnitureSpec = known
    ? FURNITURE_SPECS[itemId]
    : { width: 34, height: 31, category: "decor", renderBand: "furniture-low" };
  const palette: FurniturePalette = {
    ...DEFAULT_FURNITURE_PALETTE,
    ...options.palette,
  };
  const seed = seedFrom("furniture", itemId, options.seed ?? 0, options.variant ?? 0, rotation);
  const random = createSeededRandom(seed);
  const sourceSpec = known ? specs[itemId] : [spec.width, spec.height, spec.category, spec.renderBand] as const;
  const sourceWidth = sourceSpec[0];
  const sourceHeight = sourceSpec[1];
  const rawArt = makePixelArt(
    sourceWidth,
    sourceHeight,
    (painter) => {
      if (!known) {
        shadow(painter, sourceWidth, sourceHeight);
        painter.rect(3, 7, 28, 20, palette.outline);
        painter.rect(5, 5, 24, 19, palette.mid);
        painter.hLine(7, 5, 20, palette.light, 2);
        painter.line(5, 7, 16, 14, palette.shadow);
        painter.line(28, 7, 16, 14, palette.shadow);
        painter.rect(13, 12, 7, 6, PALETTE.washiShadow);
        painter.pixel(16, 14, palette.accent);
        return;
      }
      if (spec.category === "furniture") paintComfort(painter, itemId, sourceWidth, sourceHeight, palette, random);
      else if (spec.category === "study") paintStudy(painter, itemId, sourceWidth, sourceHeight, palette, random);
      else if (spec.category === "lighting") paintLighting(painter, itemId, sourceWidth, sourceHeight, palette, random);
      else if (spec.category === "decor") paintDecor(painter, itemId, sourceWidth, sourceHeight, palette);
      else if (spec.category === "garden") paintGardenItem(painter, itemId, sourceWidth, sourceHeight, palette, random);
      else paintCafeItem(painter, itemId, sourceWidth, sourceHeight, palette);
    },
    {
      id: `furniture:${itemId}:${options.variant ?? 0}:${rotation}`,
      anchor: { x: Math.floor(sourceWidth / 2), y: sourceHeight - 2 },
      renderBand: spec.renderBand,
      tags: [
        "furniture",
        spec.category,
        known ? "catalog" : "migration-fallback",
        `rotation-${rotation}`,
      ],
    },
  );
  const harmonizedArt = harmonizeFurnitureArt(rawArt);
  const rotatedArt = rotatePixelArt(harmonizedArt, rotation);
  const scaledArt = known
    ? scalePixelArt(rotatedArt, FURNITURE_RENDER_SCALE[itemId] ?? 1)
    : rotatedArt;
  return Object.freeze({
    ...scaledArt,
    metadata: Object.freeze({
      ...scaledArt.metadata,
      anchor: Object.freeze({
        x: Math.floor(scaledArt.width / 2),
        y: Math.max(0, scaledArt.height - 2),
      }),
    }),
  });
}
