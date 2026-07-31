export type IconName =
  | "leaf"
  | "clock"
  | "sun"
  | "cloud"
  | "rain"
  | "snow"
  | "wind"
  | "spark"
  | "home"
  | "garden"
  | "coffee"
  | "park"
  | "map"
  | "shop"
  | "bag"
  | "timer"
  | "menu"
  | "hikari"
  | "lock"
  | "search"
  | "close"
  | "chevron"
  | "rotate"
  | "undo"
  | "redo"
  | "store"
  | "place"
  | "book"
  | "pencil"
  | "journal"
  | "palette"
  | "pause"
  | "play"
  | "stop"
  | "music"
  | "sound"
  | "contrast"
  | "text"
  | "motion"
  | "fullscreen"
  | "check"
  | "arrow"
  | "heart"
  | "footsteps";

const PATHS: Record<IconName, string> = {
  leaf:
    '<path d="M19 4C11 4 6 8 6 14c0 2 1 4 3 5"/><path d="M5 21c2-6 6-9 12-13"/><path d="M10 15c3 0 6-1 8-4"/>',
  clock:
    '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><path d="M12 7v5l3 2"/>',
  sun:
    '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  cloud:
    '<path d="M6 18h11a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 9 4.5 4.5 0 0 0 6 18Z"/>',
  rain:
    '<path d="M6 15h11a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 6 4.5 4.5 0 0 0 6 15Z"/><path d="m8 18-1 3m6-3-1 3m6-3-1 3"/>',
  snow:
    '<path d="M6 14h11a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 5 4.5 4.5 0 0 0 6 14Z"/><path d="M7 19h.01M12 17h.01M17 20h.01"/>',
  wind:
    '<path d="M3 8h11c2 0 2-3 0-3-1 0-2 .5-2 1M3 12h16c2 0 2 3 0 3-1 0-2-.5-2-1M3 16h8"/>',
  spark:
    '<path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/>',
  home:
    '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/><path d="M8 7V4h3"/>',
  garden:
    '<path d="M12 21v-8"/><path d="M12 13C7 13 4 10 4 5c5 0 8 3 8 8ZM12 16c4 0 7-2 8-6-4 0-7 2-8 6Z"/><path d="M5 21h14"/>',
  coffee:
    '<path d="M5 7h12v7a6 6 0 0 1-12 0V7Z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2M4 21h15M8 3v2m4-2v2"/>',
  park:
    '<path d="M7 12h10v4H7zM5 20h14M8 16v4m8-4v4"/><path d="M12 12V3M12 4C8 4 6 6 6 9c3 1 5 0 6-2M12 6c3-2 6-1 7 2-2 2-5 2-7 0"/>',
  map:
    '<path d="m3 6 5-2 8 3 5-2v14l-5 2-8-3-5 2V6Z"/><path d="M8 4v14m8-11v14"/>',
  shop:
    '<path d="M4 9v11h16V9M3 9l2-5h14l2 5"/><path d="M3 9c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6"/>',
  bag:
    '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  timer:
    '<path d="M9 2h6M12 5a8 8 0 1 0 8 8"/><path d="m18 5 2 2M12 9v5l3 2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  hikari:
    '<path d="M12 2v4M5 5l3 3m11-3-3 3M3 12h4m10 0h4"/><path d="M8 13a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5ZM10 22h4"/>',
  lock:
    '<path d="M6 10h12v11H6zM9 10V7a3 3 0 0 1 6 0v3"/><path d="M12 14v3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  rotate:
    '<path d="M20 7V3l-2 2a9 9 0 1 0 2 11"/><path d="M20 3h-4"/>',
  undo:
    '<path d="m9 7-5 5 5 5"/><path d="M5 12h8a6 6 0 0 1 6 6v1"/>',
  redo:
    '<path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6v1"/>',
  store:
    '<path d="M4 7h16v14H4zM3 7l2-4h14l2 4M9 11h6M12 11v6"/>',
  place:
    '<path d="M12 3 4 7l8 4 8-4-8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/>',
  book:
    '<path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4Z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4V4Z"/>',
  pencil:
    '<path d="m4 20 4-1 11-11-3-3L5 16l-1 4ZM14 7l3 3M4 20h5"/>',
  journal:
    '<path d="M5 3h14v18H5zM8 3v18M11 8h5M11 12h5M11 16h3"/>',
  palette:
    '<path d="M12 3a9 9 0 0 0 0 18h2c2 0 2-3 0-3h-1c-1 0-1-2 1-2h2a5 5 0 0 0 5-5c0-5-4-8-9-8Z"/><path d="M8 9h.01M12 7h.01M16 9h.01M8 14h.01"/>',
  pause: '<path d="M7 5h4v14H7zM14 5h4v14h-4z"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  stop: '<path d="M6 6h12v12H6z"/>',
  music:
    '<path d="M9 18V5l10-2v13"/><path d="M9 16c-4-1-6 1-5 3 1 2 5 1 5-1M19 14c-4-1-6 1-5 3 1 2 5 1 5-1M9 9l10-2"/>',
  sound:
    '<path d="M4 10h4l5-4v12l-5-4H4v-4Z"/><path d="M16 9c2 2 2 4 0 6M19 6c4 4 4 8 0 12"/>',
  contrast:
    '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 7a5 5 0 0 1 0 10"/>',
  text: '<path d="M4 5h16M12 5v15M8 20h8M6 9V5m12 4V5"/>',
  motion:
    '<path d="M4 7h9M2 12h10M5 17h8"/><path d="m15 6 6 6-6 6"/>',
  fullscreen:
    '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  check: '<path d="m4 13 5 5L20 6"/>',
  arrow: '<path d="m5 12 14 0M14 7l5 5-5 5"/>',
  heart:
    '<path d="M20 5c-2-2-6-1-8 2-2-3-6-4-8-2-3 3-1 8 8 15 9-7 11-12 8-15Z"/>',
  footsteps:
    '<path d="M8 3c2 0 3 2 2 4S7 11 5 10 4 7 5 5s1-2 3-2ZM16 12c2 0 3 2 3 4s-2 5-4 5-3-2-2-4 0-3 3-5Z"/>',
};

export function icon(name: IconName, className = ""): string {
  return `<svg class="kh-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

export function weatherIcon(
  weather: "clear" | "cloudy" | "rain" | "snow" | "breeze",
): string {
  const names: Record<typeof weather, IconName> = {
    clear: "sun",
    cloudy: "cloud",
    rain: "rain",
    snow: "snow",
    breeze: "wind",
  };
  return icon(names[weather]);
}
