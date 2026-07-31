/**
 * Renderer-agnostic contracts for the Komorebi House DOM interface.
 *
 * The UI never imports a scene or a game system. Game code sends snapshots with
 * `ui.update(...)` (or the window bridge) and receives small, typed intents.
 */

export type LocationId = "room" | "garden" | "cafe" | "park";

export type ItemCategory =
  | "featured"
  | "furniture"
  | "lighting"
  | "study"
  | "plants"
  | "garden"
  | "cafe"
  | "decor";

export type ItemRarity = "everyday" | "special" | "artisan";

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow" | "breeze";

export type FocusActivity = "study" | "read" | "journal" | "create";

export type PanelId =
  | "shop"
  | "map"
  | "inventory"
  | "focus"
  | "pause"
  | "settings"
  | "onboarding"
  | null;

export interface LocationOption {
  id: LocationId;
  nameEn: string;
  nameJa: string;
  detail: string;
  unlocked: boolean;
  accent: "persimmon" | "matcha" | "indigo" | "sakura";
  icon: "home" | "garden" | "coffee" | "park";
}

export interface CatalogItem {
  id: string;
  nameEn: string;
  nameJa: string;
  description: string;
  category: Exclude<ItemCategory, "featured">;
  price: number;
  rarity?: ItemRarity;
  owned?: number;
  new?: boolean;
  /**
   * Optional trusted image URL. If omitted, the UI draws an original CSS
   * stationery-style miniature keyed by `visual`.
   */
  image?: string;
  visual?: ItemVisual;
  palette?: string;
  rotatable?: boolean;
  placementLocations?: readonly LocationId[];
}

export type ItemVisual =
  | "desk"
  | "chair"
  | "lamp"
  | "books"
  | "plant"
  | "tea"
  | "cushion"
  | "shelf"
  | "rug"
  | "radio"
  | "bonsai"
  | "lantern"
  | "futon"
  | "vase";

export interface InventoryItem extends CatalogItem {
  quantity: number;
  placed?: number;
}

export interface FocusState {
  phase: "idle" | "running" | "paused" | "complete";
  activity: FocusActivity;
  durationSeconds: number;
  remainingSeconds: number;
  streak: number;
  sessionLabel?: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
}

export interface DialogueState {
  speaker: string;
  speakerJa?: string;
  text: string;
  portrait?: "mugi" | "aoi" | "shopkeeper" | "none";
  choices?: DialogueChoice[];
  canAdvance?: boolean;
}

export interface UiSettings {
  music: number;
  ambience: number;
  effects: number;
  muted: boolean;
  fullscreen: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  showTouchControls: boolean;
  pixelScale: 1 | 2 | 3;
}

export interface ToastMessage {
  id: string;
  message: string;
  detail?: string;
  tone?: "paper" | "success" | "warning";
  durationMs?: number;
}

export interface OnboardingState {
  active: boolean;
  step: number;
  playerName: string;
}

export interface GameUIState {
  playerName: string;
  dayLabel: string;
  seasonLabel: string;
  timeLabel: string;
  weather: WeatherKind;
  coins: number;
  currentLocation: LocationId;
  locations: LocationOption[];
  prompt: string;
  goalTitle: string;
  goalDetail: string;
  goalProgress?: number;
  catalog: CatalogItem[];
  catalogCategory: ItemCategory;
  catalogQuery: string;
  customizerMode: boolean;
  inventory: InventoryItem[];
  inventoryCategory: "all" | Exclude<ItemCategory, "featured">;
  selectedItemId?: string;
  decorMode: boolean;
  placementValid: boolean;
  editingExisting: boolean;
  existingMoveActive: boolean;
  rotation: 0 | 90 | 180 | 270;
  canUndo: boolean;
  canRedo: boolean;
  focus: FocusState;
  dialogue: DialogueState | null;
  activePanel: PanelId;
  settings: UiSettings;
  onboarding: OnboardingState;
  isNight: boolean;
  isTouch: boolean;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type GameUIIntent =
  | { type: "travel"; locationId: LocationId }
  | { type: "map-toggle"; open: boolean }
  | { type: "shop-toggle"; open: boolean }
  | { type: "shop-category"; category: ItemCategory }
  | { type: "shop-search"; query: string }
  | { type: "purchase"; itemId: string; price: number }
  | { type: "inventory-toggle"; open: boolean }
  | {
      type: "inventory-category";
      category: GameUIState["inventoryCategory"];
    }
  | { type: "inventory-select"; itemId: string }
  | { type: "decor-toggle"; active: boolean }
  | {
      type: "decor-action";
      action: "place" | "rotate" | "store" | "undo" | "redo" | "cancel";
    }
  | {
      type: "focus-start";
      activity: FocusActivity;
      durationMinutes: number;
      locationId: LocationId;
    }
  | { type: "focus-pause" }
  | { type: "focus-resume" }
  | { type: "focus-cancel" }
  | { type: "focus-complete" }
  | { type: "focus-dismiss" }
  | { type: "pause-toggle"; paused: boolean }
  | { type: "settings-change"; settings: UiSettings }
  | { type: "dialogue-advance" }
  | { type: "dialogue-choice"; choiceId: string }
  | { type: "onboarding-next"; step: number; playerName: string }
  | { type: "onboarding-back"; step: number }
  | { type: "onboarding-skip" }
  | { type: "onboarding-complete"; playerName: string }
  | {
      type: "move";
      direction: "up" | "down" | "left" | "right";
      active: boolean;
    }
  | { type: "interact" }
  | { type: "cancel" };

export interface GameUIOptions {
  initialState?: DeepPartial<GameUIState>;
  onIntent?: (intent: GameUIIntent) => void;
  /**
   * Listen for `komorebi:state`, `komorebi:toast`, and
   * `komorebi:open-shop`, and emit `komorebi:command`.
   */
  connectWindowEvents?: boolean;
}

export interface DialogueInput extends DialogueState {}

export interface GameUIHandle {
  readonly element: HTMLElement;
  getState(): Readonly<GameUIState>;
  update(patch: DeepPartial<GameUIState>): void;
  showToast(toast: Omit<ToastMessage, "id"> & { id?: string }): string;
  dismissToast(id: string): void;
  showDialogue(dialogue: DialogueInput): void;
  closeDialogue(): void;
  openPanel(panel: Exclude<PanelId, null>): void;
  closePanel(): void;
  destroy(): void;
}

export interface SceneSnapshot {
  location?: LocationId;
  coins?: number;
  mode?: "explore" | "placement" | "focus" | string;
  selectedItem?: string | null;
  placementValid?: boolean;
  editingExisting?: boolean;
  rotation?: number;
  prompt?: string;
  timeLabel?: string;
  isNight?: boolean;
}

export interface SceneCommand {
  type:
    | "travel"
    | "toggle-placement"
    | "select-item"
    | "purchase"
    | "rotate"
    | "place"
    | "cancel"
    | "interact"
    | "move";
  payload?: unknown;
}
