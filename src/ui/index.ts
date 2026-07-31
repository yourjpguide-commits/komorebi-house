import "./styles.css";

import { GameUI } from "./GameUI";
import type { GameUIHandle, GameUIOptions } from "./types";

export function createGameUI(
  root: HTMLElement,
  options: GameUIOptions = {},
): GameUIHandle {
  return new GameUI(root, options);
}

export { GameUI };
export {
  DEFAULT_LOCATIONS,
  DEFAULT_UI_STATE,
  SAMPLE_CATALOG,
  SAMPLE_INVENTORY,
} from "./defaults";
export type {
  CatalogItem,
  DeepPartial,
  DialogueChoice,
  DialogueInput,
  DialogueState,
  FocusActivity,
  FocusState,
  GameUIHandle,
  GameUIIntent,
  GameUIOptions,
  GameUIState,
  InventoryItem,
  ItemCategory,
  ItemRarity,
  ItemVisual,
  LocationId,
  LocationOption,
  OnboardingState,
  PanelId,
  SceneCommand,
  SceneSnapshot,
  ToastMessage,
  UiSettings,
  WeatherKind,
} from "./types";
