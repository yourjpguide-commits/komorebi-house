import type { PixelPalette } from "./types";

export const PALETTES = {
  hinoki: {
    outline: "#3b2b2a",
    shadow: "#765044",
    mid: "#bd835d",
    light: "#edc58e",
    accent: "#76956d",
  },
  tatami: {
    outline: "#34362b",
    shadow: "#667052",
    mid: "#a0a66d",
    light: "#d5cf8b",
    accent: "#59483f",
  },
  indigo: {
    outline: "#23283b",
    shadow: "#394c6a",
    mid: "#547497",
    light: "#a8c4cb",
    accent: "#e2b66f",
  },
  washi: {
    outline: "#4a3732",
    shadow: "#aa8170",
    mid: "#dfbca1",
    light: "#fff1d5",
    accent: "#cf6370",
  },
  amber: {
    outline: "#3d2823",
    shadow: "#7e4635",
    mid: "#c56f42",
    light: "#ffc66f",
    accent: "#fff0ba",
  },
  ceramic: {
    outline: "#293c43",
    shadow: "#587078",
    mid: "#92a7a4",
    light: "#e5e0cd",
    accent: "#b95449",
  },
  sakura: {
    outline: "#44303c",
    shadow: "#945f70",
    mid: "#cf8898",
    light: "#f6bdc2",
    accent: "#fff0dc",
  },
  moss: {
    outline: "#27352f",
    shadow: "#42604b",
    mid: "#66845a",
    light: "#a9b66e",
    accent: "#d7cc8c",
  },
  hydrangea: {
    outline: "#2c3445",
    shadow: "#505d86",
    mid: "#7888b6",
    light: "#b8bde0",
    accent: "#d88fa8",
  },
  kissaten: {
    outline: "#2b2022",
    shadow: "#56393a",
    mid: "#8b5a45",
    light: "#d59b65",
    accent: "#3f786e",
  },
  night: {
    outline: "#1d2333",
    shadow: "#303d5d",
    mid: "#50658b",
    light: "#9db3c7",
    accent: "#f2c56b",
  },
  copper: {
    outline: "#342725",
    shadow: "#704239",
    mid: "#ae6650",
    light: "#dfa270",
    accent: "#78a89b",
  },
} as const satisfies Readonly<Record<string, PixelPalette>>;

export type PaletteName = keyof typeof PALETTES;
