/**
 * Komorebi House's original 32-ish-color master palette.
 *
 * Values are deliberately shared between recipes.  That keeps a large set of
 * code-drawn assets feeling authored rather than assembled from unrelated art.
 * There is no pure black or pure white: shadows stay chromatic and highlights
 * retain the warmth of paper and sunlit timber.
 */
export const PALETTE = Object.freeze({
  inkDeep: "#171B2D",
  ink: "#242A3A",
  inkSoft: "#343B4B",
  inkLift: "#4A5260",

  washi: "#FFF4D6",
  washiShadow: "#F0D9AE",
  hinokiLight: "#D3B280",
  hinoki: "#A77A50",
  hinokiDark: "#6E4939",

  tatamiLight: "#D8D59B",
  tatami: "#AAB477",
  tatamiShadow: "#77885B",
  tatamiDark: "#465D48",

  leafDeep: "#183F35",
  leafDark: "#315844",
  leaf: "#4C755A",
  leafLight: "#71956B",
  leafSun: "#A5B97F",

  indigoDeep: "#263F65",
  indigo: "#376083",
  indigoLight: "#5285A1",
  sky: "#80B1BD",
  skyLight: "#B9D5D0",

  vermilionDark: "#A83F35",
  vermilion: "#D65D48",
  vermilionLight: "#F28D64",

  sakuraLight: "#F6D8D2",
  sakura: "#E9AAA7",
  sakuraShadow: "#BE7F83",

  soilDeep: "#49372F",
  soil: "#725443",
  soilLight: "#A77A5D",

  stoneDeep: "#485259",
  stone: "#697477",
  stoneLight: "#96A09B",
  stoneSun: "#C7C7AF",

  waterDeep: "#264C5D",
  water: "#3E7180",
  waterLight: "#6FA4A4",

  amberDeep: "#8B4D35",
  amber: "#D88A45",
  amberLight: "#F2C36B",
  glow: "#FFE4A3",

  plum: "#63394F",
  ceramic: "#D7E2D4",
  ceramicShadow: "#8EA59D",
} as const);

export type PaletteColorName = keyof typeof PALETTE;

export const LOCATION_HERO_COLOR = Object.freeze({
  room: PALETTE.amberLight,
  garden: PALETTE.leafLight,
  cafe: PALETTE.soilLight,
  park: PALETTE.sky,
  shop: PALETTE.vermilion,
  street: PALETTE.indigoLight,
} as const);

export const OUTFIT_PALETTES = Object.freeze({
  indigo: {
    dark: PALETTE.indigoDeep,
    mid: PALETTE.indigo,
    light: PALETTE.indigoLight,
    accent: PALETTE.vermilionLight,
  },
  moss: {
    dark: PALETTE.leafDeep,
    mid: PALETTE.leaf,
    light: PALETTE.leafLight,
    accent: PALETTE.amberLight,
  },
  sakura: {
    dark: PALETTE.plum,
    mid: PALETTE.sakuraShadow,
    light: PALETTE.sakura,
    accent: PALETTE.washi,
  },
  ember: {
    dark: PALETTE.vermilionDark,
    mid: PALETTE.vermilion,
    light: PALETTE.vermilionLight,
    accent: PALETTE.washi,
  },
} as const);

export type OutfitPaletteName = keyof typeof OUTFIT_PALETTES;
