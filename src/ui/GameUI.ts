import { renderGameUI } from "./components";
import { createInitialState, mergeUIState } from "./defaults";
import { audio } from "../audio";
import { furnitureSupportedRotations } from "../art/furniture";
import type {
  DeepPartial,
  FocusActivity,
  GameUIHandle,
  GameUIIntent,
  GameUIOptions,
  GameUIState,
  ItemCategory,
  LocationId,
  SceneCommand,
  SceneSnapshot,
  ToastMessage,
  UiSettings,
} from "./types";

const INTENT_EVENT = "komorebi:ui-intent";
const COMMAND_EVENT = "komorebi:command";
const STATE_EVENT = "komorebi:state";
const TOAST_EVENT = "komorebi:toast";
const OPEN_SHOP_EVENT = "komorebi:open-shop";
const MAX_VISIBLE_TOASTS = 2;

type Direction = "up" | "down" | "left" | "right";

const FOCUS_IDENTITY_KEYS = [
  "action",
  "input",
  "setting",
  "testid",
  "category",
  "itemId",
  "location",
  "activity",
  "choiceId",
  "toastId",
  "scale",
  "direction",
] as const;

interface FocusIdentity {
  tagName: string;
  values: Partial<Record<(typeof FOCUS_IDENTITY_KEYS)[number], string>>;
}

function getFocusIdentity(element: HTMLElement): FocusIdentity | null {
  const values: FocusIdentity["values"] = {};
  for (const key of FOCUS_IDENTITY_KEYS) {
    const value = element.dataset[key];
    if (value !== undefined) values[key] = value;
  }
  return Object.keys(values).length
    ? { tagName: element.tagName, values }
    : null;
}

function matchesFocusIdentity(
  element: HTMLElement,
  identity: FocusIdentity,
): boolean {
  if (element.tagName !== identity.tagName) return false;
  return Object.entries(identity.values).every(
    ([key, value]) => element.dataset[key] === value,
  );
}

function isInputTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isLocationId(value: unknown): value is LocationId {
  return (
    value === "room" ||
    value === "garden" ||
    value === "cafe" ||
    value === "park"
  );
}

function rotationValue(value: unknown): 0 | 90 | 180 | 270 | undefined {
  if (value === 0 || value === 90 || value === 180 || value === 270) {
    return value;
  }
  return undefined;
}

function sceneCommandForIntent(intent: GameUIIntent): SceneCommand | null {
  switch (intent.type) {
    case "travel":
      return { type: "travel", payload: { location: intent.locationId } };
    case "decor-toggle":
      return {
        type: "toggle-placement",
        payload: { active: intent.active },
      };
    case "inventory-select":
      return { type: "select-item", payload: { itemId: intent.itemId } };
    case "purchase":
      return {
        type: "purchase",
        payload: { itemId: intent.itemId, price: intent.price },
      };
    case "decor-action":
      if (intent.action === "rotate") return { type: "rotate" };
      if (intent.action === "place") return { type: "place" };
      if (intent.action === "cancel" || intent.action === "store") {
        return { type: "cancel", payload: { action: intent.action } };
      }
      return null;
    case "interact":
      return { type: "interact" };
    case "move":
      return {
        type: "move",
        payload: { direction: intent.direction, active: intent.active },
      };
    case "cancel":
      return { type: "cancel" };
    default:
      return null;
  }
}

export class GameUI implements GameUIHandle {
  readonly element: HTMLElement;

  private state: GameUIState;
  private readonly onIntent?: (intent: GameUIIntent) => void;
  private readonly connectWindowEvents: boolean;
  private readonly toasts: ToastMessage[] = [];
  private readonly toastTimers = new Map<string, number>();
  private readonly heldDirections = new Set<Direction>();
  private renderQueued = false;
  private focusTicker: number | null = null;
  private focusTickAt = 0;
  private pendingFocusIdentity: FocusIdentity | null = null;
  private panelOpenerIdentity: FocusIdentity | null = null;
  private restoreFocusIdentity: FocusIdentity | null = null;
  private destroyed = false;
  private toastSerial = 0;
  private unsubscribeAudio: (() => void) | null = null;

  constructor(root: HTMLElement, options: GameUIOptions = {}) {
    this.element = root;
    this.state = createInitialState(options.initialState);
    this.onIntent = options.onIntent;
    this.connectWindowEvents = options.connectWindowEvents !== false;

    const audioSnapshot = audio.getSnapshot();
    this.state = mergeUIState(this.state, {
      settings: {
        music: audioSnapshot.volumes.music,
        ambience: audioSnapshot.volumes.ambience,
        effects: audioSnapshot.volumes.sfx,
        muted: audioSnapshot.muted,
      },
    });

    root.classList.add("kh-ui");
    root.setAttribute("data-ui-ready", "true");
    root.addEventListener("click", this.onClick);
    root.addEventListener("input", this.onInput);
    root.addEventListener("change", this.onChange);
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointerup", this.onPointerUp);
    root.addEventListener("pointercancel", this.onPointerUp);
    root.addEventListener("pointerleave", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.releaseAllDirections);

    if (this.connectWindowEvents) {
      window.addEventListener(STATE_EVENT, this.onSceneState as EventListener);
      window.addEventListener(TOAST_EVENT, this.onSceneToast as EventListener);
      window.addEventListener(
        OPEN_SHOP_EVENT,
        this.onSceneOpenShop as EventListener,
      );
    }
    this.unsubscribeAudio = audio.subscribe((snapshot) => {
      const mutedChanged = this.state.settings.muted !== snapshot.muted;
      this.state = mergeUIState(this.state, {
        settings: {
          music: snapshot.volumes.music,
          ambience: snapshot.volumes.ambience,
          effects: snapshot.volumes.sfx,
          muted: snapshot.muted,
        },
      });
      if (mutedChanged) this.scheduleRender();
    });

    this.renderNow();
    this.syncFocusTicker();
    if (this.state.activePanel || this.state.onboarding.active) {
      requestAnimationFrame(() => this.focusFirstInPanel());
    }
  }

  getState(): Readonly<GameUIState> {
    return this.state;
  }

  update(patch: DeepPartial<GameUIState>): void {
    if (this.destroyed) return;
    this.state = mergeUIState(this.state, patch);
    this.applyPreferenceClasses();
    this.syncFocusTicker();
    this.scheduleRender();
  }

  showToast(toast: Omit<ToastMessage, "id"> & { id?: string }): string {
    const requestedId = toast.id ?? `toast-${Date.now()}-${++this.toastSerial}`;
    const existingIndex = this.toasts.findIndex(
      (entry) => entry.id === requestedId,
    );
    const matchingIndex =
      existingIndex >= 0
        ? -1
        : this.toasts.findIndex(
            (entry) =>
              entry.message === toast.message &&
              entry.detail === toast.detail &&
              entry.tone === toast.tone,
          );
    const previous =
      existingIndex >= 0
        ? this.toasts.splice(existingIndex, 1)[0]
        : matchingIndex >= 0
          ? this.toasts.splice(matchingIndex, 1)[0]
          : undefined;
    const id = previous?.id ?? requestedId;
    const message: ToastMessage = { ...toast, id };
    this.toasts.push(message);

    const existingTimer = this.toastTimers.get(id);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(
      () => this.dismissToast(id),
      Math.max(1500, toast.durationMs ?? 4200),
    );
    this.toastTimers.set(id, timer);

    // Rapid placement feedback should always preserve the newest actionable
    // result, but never form a tall wall over the upper-right playfield.
    while (this.toasts.length > MAX_VISIBLE_TOASTS) {
      const expired = this.toasts.shift();
      if (!expired) continue;
      const expiredTimer = this.toastTimers.get(expired.id);
      if (expiredTimer !== undefined) window.clearTimeout(expiredTimer);
      this.toastTimers.delete(expired.id);
    }
    this.scheduleRender();
    return id;
  }

  private canRotateSelectedItem(): boolean {
    const selected = this.state.inventory.find(
      (item) => item.id === this.state.selectedItemId,
    );
    return Boolean(
      selected &&
        selected.rotatable !== false &&
        furnitureSupportedRotations(selected.id).length > 1,
    );
  }

  dismissToast(id: string): void {
    const index = this.toasts.findIndex((toast) => toast.id === id);
    if (index < 0) return;
    this.toasts.splice(index, 1);
    const timer = this.toastTimers.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    this.toastTimers.delete(id);
    this.scheduleRender();
  }

  showDialogue(dialogue: NonNullable<GameUIState["dialogue"]>): void {
    this.update({ dialogue });
  }

  closeDialogue(): void {
    this.update({ dialogue: null });
  }

  openPanel(panel: Exclude<GameUIState["activePanel"], null>): void {
    if (!this.state.activePanel && !this.state.onboarding.active) {
      const active = document.activeElement;
      this.panelOpenerIdentity =
        (active instanceof HTMLElement ? getFocusIdentity(active) : null) ??
        this.pendingFocusIdentity;
    }
    this.update({ activePanel: panel });
    requestAnimationFrame(() => this.focusFirstInPanel());
  }

  closePanel(): void {
    this.closeActivePanel();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releaseAllDirections();
    this.stopFocusTicker();
    this.toastTimers.forEach((timer) => window.clearTimeout(timer));
    this.toastTimers.clear();
    this.unsubscribeAudio?.();
    this.unsubscribeAudio = null;

    this.element.removeEventListener("click", this.onClick);
    this.element.removeEventListener("input", this.onInput);
    this.element.removeEventListener("change", this.onChange);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.removeEventListener("pointerleave", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.releaseAllDirections);

    if (this.connectWindowEvents) {
      window.removeEventListener(STATE_EVENT, this.onSceneState as EventListener);
      window.removeEventListener(
        TOAST_EVENT,
        this.onSceneToast as EventListener,
      );
      window.removeEventListener(
        OPEN_SHOP_EVENT,
        this.onSceneOpenShop as EventListener,
      );
    }

    this.element.classList.remove(
      "kh-ui",
      "kh-reduced-motion",
      "kh-high-contrast",
      "kh-large-text",
    );
    this.element.removeAttribute("data-ui-ready");
    this.element.replaceChildren();
  }

  private readonly onClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-action]",
    );
    if (!button || !this.element.contains(button)) return;
    const action = button.dataset.action;
    if (!action) return;
    this.pendingFocusIdentity = getFocusIdentity(button);
    void audio.unlock();

    switch (action) {
      case "travel": {
        const locationId = button.dataset.location;
        if (!isLocationId(locationId)) return;
        this.emit({ type: "travel", locationId });
        if (this.state.activePanel) {
          this.closeActivePanel({ currentLocation: locationId });
        } else {
          this.update({ currentLocation: locationId });
        }
        break;
      }
      case "map-open":
        this.emit({ type: "map-toggle", open: true });
        this.openPanel("map");
        break;
      case "shop-open":
        this.emit({ type: "shop-toggle", open: true });
        this.update({ customizerMode: false });
        this.openPanel("shop");
        break;
      case "customizer-open":
        this.emit({ type: "shop-toggle", open: true });
        this.update({ customizerMode: true });
        this.openPanel("shop");
        break;
      case "inventory-open":
        if (this.state.activePanel === "shop") {
          this.emit({ type: "shop-toggle", open: false });
        }
        this.emit({ type: "inventory-toggle", open: true });
        this.openPanel("inventory");
        break;
      case "focus-open":
        this.openPanel("focus");
        break;
      case "pause-open":
        this.emit({ type: "pause-toggle", paused: true });
        this.openPanel("pause");
        break;
      case "mute-toggle": {
        const muted = audio.toggleMuted();
        this.update({ settings: { muted } });
        audio.playSfx(muted ? "ui-back" : "ui-confirm");
        break;
      }
      case "pause-close":
        this.closeActivePanel();
        break;
      case "pause-back":
        this.update({ activePanel: "pause" });
        requestAnimationFrame(() => this.focusFirstInPanel());
        break;
      case "settings-open":
        this.update({ activePanel: "settings" });
        requestAnimationFrame(() => this.focusFirstInPanel());
        break;
      case "panel-close":
      case "panel-scrim":
        this.closeActivePanel();
        break;
      case "shop-category": {
        const category = button.dataset.category as ItemCategory;
        if (!category) return;
        this.update({ catalogCategory: category });
        this.emit({ type: "shop-category", category });
        break;
      }
      case "shop-search-clear":
        this.update({ catalogQuery: "" });
        this.emit({ type: "shop-search", query: "" });
        requestAnimationFrame(() =>
          this.element.querySelector<HTMLInputElement>(
            '[data-input="shop-search"]',
          )?.focus(),
        );
        break;
      case "purchase": {
        const itemId = button.dataset.itemId;
        const price = Number(button.dataset.price);
        if (!itemId || !Number.isFinite(price)) return;
        this.emit({ type: "purchase", itemId, price });
        break;
      }
      case "inventory-category": {
        const category =
          button.dataset
            .category as GameUIState["inventoryCategory"];
        if (!category) return;
        this.update({ inventoryCategory: category });
        this.emit({ type: "inventory-category", category });
        break;
      }
      case "inventory-select": {
        const itemId = button.dataset.itemId;
        if (!itemId) return;
        if (this.state.activePanel === "shop") {
          this.emit({ type: "shop-toggle", open: false });
        } else if (this.state.activePanel === "inventory") {
          this.emit({ type: "inventory-toggle", open: false });
        }
        this.panelOpenerIdentity = null;
        this.restoreFocusIdentity = null;
        this.update({
          selectedItemId: itemId,
          decorMode: true,
          customizerMode: false,
          activePanel: null,
          editingExisting: false,
          existingMoveActive: false,
        });
        this.emit({ type: "inventory-select", itemId });
        break;
      }
      case "decor-start":
        if (this.state.activePanel === "inventory") {
          this.emit({ type: "inventory-toggle", open: false });
        }
        this.panelOpenerIdentity = null;
        this.update({ decorMode: true, activePanel: null });
        this.emit({ type: "decor-toggle", active: true });
        break;
      case "decor-exit":
        this.update({
          decorMode: false,
          selectedItemId: undefined,
          placementValid: false,
          editingExisting: false,
          existingMoveActive: false,
        });
        this.emit({ type: "decor-toggle", active: false });
        break;
      case "decor-move":
        this.update({ existingMoveActive: true });
        break;
      case "decor-place":
        this.emit({ type: "decor-action", action: "place" });
        break;
      case "decor-rotate":
        if (!this.canRotateSelectedItem()) {
          this.showToast({
            message: "This piece keeps its facing.",
            detail: "Its hand-drawn view is already the right way round.",
            tone: "paper",
            durationMs: 2600,
          });
          break;
        }
        this.emit({ type: "decor-action", action: "rotate" });
        this.update({
          rotation: ((this.state.rotation + 90) % 360) as 0 | 90 | 180 | 270,
        });
        break;
      case "decor-store":
        this.emit({ type: "decor-action", action: "store" });
        break;
      case "decor-undo":
        this.emit({ type: "decor-action", action: "undo" });
        break;
      case "decor-redo":
        this.emit({ type: "decor-action", action: "redo" });
        break;
      case "focus-activity": {
        const activity = button.dataset.activity as FocusActivity;
        if (!["study", "read", "journal", "create"].includes(activity)) return;
        this.update({ focus: { activity } });
        break;
      }
      case "focus-start": {
        const durationMinutes = Math.round(
          this.state.focus.durationSeconds / 60,
        );
        this.update({
          focus: {
            phase: "running",
            remainingSeconds: this.state.focus.durationSeconds,
          },
          activePanel: "focus",
        });
        this.emit({
          type: "focus-start",
          activity: this.state.focus.activity,
          durationMinutes,
          locationId: this.state.currentLocation,
        });
        audio.playSfx("study-start");
        break;
      }
      case "focus-pause":
        this.update({ focus: { phase: "paused" } });
        this.emit({ type: "focus-pause" });
        break;
      case "focus-resume":
        this.update({ focus: { phase: "running" } });
        this.emit({ type: "focus-resume" });
        break;
      case "focus-cancel":
        this.closeActivePanel({
          focus: {
            phase: "idle",
            remainingSeconds: this.state.focus.durationSeconds,
          },
        });
        this.emit({ type: "focus-cancel" });
        break;
      case "focus-dismiss":
        this.closeActivePanel({
          focus: {
            phase: "idle",
            remainingSeconds: this.state.focus.durationSeconds,
          },
        });
        this.emit({ type: "focus-dismiss" });
        break;
      case "focus-minimize":
        this.closeActivePanel();
        break;
      case "dialogue-advance":
        this.emit({ type: "dialogue-advance" });
        break;
      case "dialogue-choice": {
        const choiceId = button.dataset.choiceId;
        if (choiceId) this.emit({ type: "dialogue-choice", choiceId });
        break;
      }
      case "toast-dismiss": {
        const id = button.dataset.toastId;
        if (id) this.dismissToast(id);
        break;
      }
      case "pixel-scale": {
        const scale = Number(button.dataset.scale) as 1 | 2 | 3;
        if (![1, 2, 3].includes(scale)) return;
        this.changeSettings({ pixelScale: scale });
        break;
      }
      case "onboarding-next": {
        const next = Math.min(3, this.state.onboarding.step + 1);
        this.update({ onboarding: { step: next } });
        this.emit({
          type: "onboarding-next",
          step: next,
          playerName: this.state.onboarding.playerName.trim(),
        });
        break;
      }
      case "onboarding-back": {
        const previous = Math.max(0, this.state.onboarding.step - 1);
        this.update({ onboarding: { step: previous } });
        this.emit({ type: "onboarding-back", step: previous });
        break;
      }
      case "onboarding-skip":
        this.update({ onboarding: { active: false } });
        this.emit({ type: "onboarding-skip" });
        break;
      case "onboarding-complete": {
        const playerName = this.state.onboarding.playerName.trim();
        this.update({
          playerName: playerName || this.state.playerName,
          onboarding: { active: false },
        });
        this.emit({ type: "onboarding-complete", playerName });
        void audio.unlock();
        break;
      }
      case "interact":
        this.emit({ type: "interact" });
        break;
      case "cancel":
        this.emit({ type: "cancel" });
        break;
      case "goal":
        this.showToast({
          message: this.state.goalTitle,
          detail: this.state.goalDetail,
          tone: "paper",
        });
        break;
      default:
        break;
    }
  };

  private readonly onInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.pendingFocusIdentity = getFocusIdentity(input);

    if (input.dataset.input === "shop-search") {
      this.state = mergeUIState(this.state, { catalogQuery: input.value });
      this.emit({ type: "shop-search", query: input.value });
      this.scheduleRender();
      return;
    }

    if (input.dataset.input === "focus-duration") {
      const minutes = Math.max(5, Math.min(60, Number(input.value)));
      const durationSeconds = minutes * 60;
      this.state = mergeUIState(this.state, {
        focus: { durationSeconds, remainingSeconds: durationSeconds },
      });
      const label = this.element.querySelector<HTMLElement>(
        "[data-focus-duration-label]",
      );
      if (label) label.textContent = String(minutes);
      return;
    }

    if (input.dataset.input === "player-name") {
      this.state = mergeUIState(this.state, {
        onboarding: { playerName: input.value },
      });
      const next =
        this.element.querySelector<HTMLButtonElement>(
          '[data-action="onboarding-next"]',
        ) ??
        this.element.querySelector<HTMLButtonElement>(
          '[data-action="onboarding-complete"]',
        );
      if (next) next.disabled = !input.value.trim();
      return;
    }

    const setting = input.dataset.setting as keyof UiSettings | undefined;
    if (!setting || input.type === "checkbox") return;
    const value = Number(input.value);
    if (
      setting === "music" ||
      setting === "ambience" ||
      setting === "effects"
    ) {
      const next = { [setting]: value } as Partial<UiSettings>;
      this.state = mergeUIState(this.state, {
        settings: next as DeepPartial<UiSettings>,
      });
      const output = input.parentElement?.querySelector("output");
      if (output) output.textContent = String(Math.round(value * 100));
      this.emit({ type: "settings-change", settings: this.state.settings });
      audio.setVolume(
        setting === "effects" ? "sfx" : setting,
        Math.max(0, Math.min(1, value)),
      );
    }
  };

  private readonly onChange = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.pendingFocusIdentity = getFocusIdentity(input);
    const setting = input.dataset.setting as keyof UiSettings | undefined;
    if (!setting || input.type !== "checkbox") return;
    if (
      setting === "reducedMotion" ||
      setting === "highContrast" ||
      setting === "largeText" ||
      setting === "showTouchControls"
    ) {
      this.changeSettings({ [setting]: input.checked } as Partial<UiSettings>);
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-hold-action='move']",
    );
    if (!target || !this.element.contains(target)) return;
    event.preventDefault();
    target.setPointerCapture?.(event.pointerId);
    const direction = target.dataset.direction as Direction;
    if (!["up", "down", "left", "right"].includes(direction)) return;
    this.setDirection(direction, true);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-hold-action='move']",
    );
    if (!target) return;
    const direction = target.dataset.direction as Direction;
    if (["up", "down", "left", "right"].includes(direction)) {
      this.setDirection(direction, false);
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Tab" && this.trapModalFocus(event)) return;
    const key = event.key.toLocaleLowerCase();

    if (key === "escape") {
      event.preventDefault();
      if (this.state.onboarding.active) {
        return;
      }
      if (this.state.dialogue) {
        this.emit({ type: "cancel" });
      } else if (this.state.activePanel === "settings") {
        this.update({ activePanel: "pause" });
        requestAnimationFrame(() => this.focusFirstInPanel());
      } else if (this.state.activePanel) {
        this.closeActivePanel();
      } else if (this.state.decorMode) {
        this.update({
          decorMode: false,
          selectedItemId: undefined,
          placementValid: false,
        });
        this.emit({ type: "decor-toggle", active: false });
      } else {
        this.emit({ type: "pause-toggle", paused: true });
        this.openPanel("pause");
      }
      return;
    }

    if (isInputTarget(event.target)) return;
    const direction = this.directionForKey(event.key);
    if (direction) {
      if (
        this.state.activePanel ||
        this.state.dialogue ||
        this.state.onboarding.active
      ) {
        return;
      }
      event.preventDefault();
      this.setDirection(direction, true);
      return;
    }

    if (event.repeat) return;

    if (this.state.onboarding.active || this.state.dialogue) {
      if (
        this.state.dialogue &&
        event.key === "Enter" &&
        !this.state.dialogue.choices?.length
      ) {
        this.emit({ type: "dialogue-advance" });
      }
      return;
    }

    if (this.state.activePanel) return;
    if (key === "e" || event.key === "Enter") {
      if (this.state.decorMode && this.state.selectedItemId) {
        this.emit({ type: "decor-action", action: "place" });
      } else {
        this.emit({ type: "interact" });
      }
    } else if (key === "b") {
      this.openPanel("inventory");
    } else if (key === "m") {
      this.openPanel("map");
    } else if (key === "f") {
      this.openPanel("focus");
    } else if (key === "r" && this.state.decorMode) {
      if (this.canRotateSelectedItem()) {
        this.emit({ type: "decor-action", action: "rotate" });
      } else if (this.state.selectedItemId) {
        this.showToast({
          message: "This piece keeps its facing.",
          detail: "Its hand-drawn view is already the right way round.",
          tone: "paper",
          durationMs: 2600,
        });
      }
    } else if (
      this.state.decorMode &&
      (event.metaKey || event.ctrlKey) &&
      key === "z"
    ) {
      this.emit({
        type: "decor-action",
        action: event.shiftKey ? "redo" : "undo",
      });
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (isInputTarget(event.target)) return;
    const direction = this.directionForKey(event.key);
    if (direction) this.setDirection(direction, false);
  };

  private readonly onSceneState = (event: CustomEvent<SceneSnapshot>): void => {
    const snapshot = event.detail;
    if (!snapshot || typeof snapshot !== "object") return;
    const patch: DeepPartial<GameUIState> = {};
    if (isLocationId(snapshot.location)) {
      patch.currentLocation = snapshot.location;
    }
    if (typeof snapshot.coins === "number") patch.coins = snapshot.coins;
    if (typeof snapshot.mode === "string") {
      patch.decorMode = snapshot.mode === "placement";
    }
    if (typeof snapshot.placementValid === "boolean") {
      patch.placementValid = snapshot.placementValid;
    }
    if (typeof snapshot.editingExisting === "boolean") {
      patch.editingExisting = snapshot.editingExisting;
      // World selection is already a live, lossless move preview. Reflect that
      // immediately so the panel never presents a dormant “Move” affordance
      // beside an active “Set here” action.
      patch.existingMoveActive = snapshot.editingExisting;
    }
    if (typeof snapshot.selectedItem === "string") {
      patch.selectedItemId = snapshot.selectedItem;
    } else if (snapshot.selectedItem === null) {
      patch.selectedItemId = undefined;
    }
    const rotation = rotationValue(snapshot.rotation);
    if (rotation !== undefined) patch.rotation = rotation;
    if (typeof snapshot.prompt === "string") patch.prompt = snapshot.prompt;
    if (typeof snapshot.timeLabel === "string") {
      patch.timeLabel = snapshot.timeLabel;
    }
    if (typeof snapshot.isNight === "boolean") {
      patch.isNight = snapshot.isNight;
    }
    this.update(patch);
  };

  private readonly onSceneToast = (
    event: CustomEvent<{
      message?: string;
      detail?: string;
      tone?: ToastMessage["tone"];
    }>,
  ): void => {
    if (!event.detail?.message) return;
    const tone =
      event.detail.tone === ("quiet" as ToastMessage["tone"] | "quiet")
        ? "paper"
        : event.detail.tone;
    this.showToast({
      message: event.detail.message,
      detail: event.detail.detail,
      tone,
    });
  };

  private readonly onSceneOpenShop = (): void => {
    this.openPanel("shop");
  };

  private readonly releaseAllDirections = (): void => {
    this.heldDirections.forEach((direction) =>
      this.emit({ type: "move", direction, active: false }),
    );
    this.heldDirections.clear();
  };

  private directionForKey(key: string): Direction | null {
    if (key === "ArrowUp" || key.toLocaleLowerCase() === "w") return "up";
    if (key === "ArrowDown" || key.toLocaleLowerCase() === "s") return "down";
    if (key === "ArrowLeft" || key.toLocaleLowerCase() === "a") return "left";
    if (key === "ArrowRight" || key.toLocaleLowerCase() === "d") return "right";
    return null;
  }

  private setDirection(direction: Direction, active: boolean): void {
    if (active && !this.heldDirections.has(direction)) {
      this.heldDirections.add(direction);
      this.emit({ type: "move", direction, active: true });
    } else if (!active && this.heldDirections.has(direction)) {
      this.heldDirections.delete(direction);
      this.emit({ type: "move", direction, active: false });
    }
  }

  private changeSettings(patch: Partial<UiSettings>): void {
    this.state = mergeUIState(this.state, {
      settings: patch as DeepPartial<UiSettings>,
    });
    this.applyPreferenceClasses();
    this.emit({ type: "settings-change", settings: this.state.settings });
    this.scheduleRender();
  }

  private emit(intent: GameUIIntent): void {
    this.onIntent?.(intent);
    this.element.dispatchEvent(
      new CustomEvent<GameUIIntent>(INTENT_EVENT, {
        detail: intent,
        bubbles: true,
      }),
    );

    if (this.connectWindowEvents) {
      const command = sceneCommandForIntent(intent);
      if (command) {
        window.dispatchEvent(
          new CustomEvent<SceneCommand>(COMMAND_EVENT, { detail: command }),
        );
      }
    }
  }

  private scheduleRender(): void {
    if (this.renderQueued || this.destroyed) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (!this.destroyed) this.renderNow();
    });
  }

  private renderNow(): void {
    const active = document.activeElement;
    const focusIdentity =
      this.restoreFocusIdentity ??
      (active instanceof HTMLElement ? getFocusIdentity(active) : null) ??
      this.pendingFocusIdentity;
    const selection: [number | null, number | null] | null =
      active instanceof HTMLInputElement
        ? [active.selectionStart, active.selectionEnd]
        : null;

    this.element.innerHTML = renderGameUI(this.state, this.toasts);
    this.applyPreferenceClasses();

    if (focusIdentity) {
      const candidates = Array.from(
        this.element.querySelectorAll<HTMLElement>(
          "[data-action], [data-input], [data-setting], [data-testid]",
        ),
      ).filter((candidate) => matchesFocusIdentity(candidate, focusIdentity));
      const replacement =
        candidates.find(
          (candidate) =>
            !candidate.closest("[inert]") &&
            candidate.getClientRects().length > 0,
        ) ?? candidates[0];
      replacement?.focus({ preventScroll: true });
      if (
        replacement instanceof HTMLInputElement &&
        selection &&
        selection[0] !== null &&
        selection[1] !== null
      ) {
        try {
          replacement.setSelectionRange(selection[0], selection[1]);
        } catch {
          // Range inputs do not expose a text selection.
        }
      }
    }
    this.pendingFocusIdentity = null;
    this.restoreFocusIdentity = null;
  }

  private closeActivePanel(
    patch: DeepPartial<GameUIState> = {},
  ): void {
    const panel = this.state.activePanel;
    if (panel === "shop") {
      this.emit({ type: "shop-toggle", open: false });
    } else if (panel === "map") {
      this.emit({ type: "map-toggle", open: false });
    } else if (panel === "inventory") {
      this.emit({ type: "inventory-toggle", open: false });
    } else if (panel === "pause" || panel === "settings") {
      this.emit({ type: "pause-toggle", paused: false });
    }

    this.restoreFocusIdentity = this.panelOpenerIdentity;
    this.panelOpenerIdentity = null;
    this.pendingFocusIdentity = null;
    this.update({ ...patch, activePanel: null, customizerMode: false });
  }

  private applyPreferenceClasses(): void {
    this.element.classList.toggle(
      "kh-reduced-motion",
      this.state.settings.reducedMotion,
    );
    this.element.classList.toggle(
      "kh-high-contrast",
      this.state.settings.highContrast,
    );
    this.element.classList.toggle(
      "kh-large-text",
      this.state.settings.largeText,
    );
    this.element.dataset.pixelScale = String(this.state.settings.pixelScale);
    this.element.dataset.time = this.state.isNight ? "night" : "day";
  }

  private focusFirstInPanel(): void {
    const panel = this.element.querySelector<HTMLElement>(
      '[role="dialog"] button:not([disabled]), [role="dialog"] input:not([disabled])',
    );
    panel?.focus({ preventScroll: true });
  }

  private trapModalFocus(event: KeyboardEvent): boolean {
    const modal = this.state.onboarding.active
      ? this.element.querySelector<HTMLElement>(".kh-onboarding")
      : this.state.activePanel
        ? this.element.querySelector<HTMLElement>('[role="dialog"]')
        : this.state.dialogue
          ? this.element.querySelector<HTMLElement>(".kh-dialogue")
          : null;
    if (!modal) return false;

    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0,
    );
    if (!focusable.length) return false;

    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex === focusable.length - 1
        ? 0
        : currentIndex + 1;
    event.preventDefault();
    focusable[nextIndex]?.focus();
    return true;
  }

  private syncFocusTicker(): void {
    if (this.state.focus.phase === "running") {
      if (this.focusTicker === null) {
        this.focusTickAt = performance.now();
        this.focusTicker = window.setInterval(this.tickFocus, 250);
      }
    } else {
      this.stopFocusTicker();
    }
  }

  private stopFocusTicker(): void {
    if (this.focusTicker !== null) {
      window.clearInterval(this.focusTicker);
      this.focusTicker = null;
    }
  }

  private readonly tickFocus = (): void => {
    if (this.state.focus.phase !== "running") {
      this.stopFocusTicker();
      return;
    }
    const now = performance.now();
    const elapsedSeconds = (now - this.focusTickAt) / 1000;
    if (elapsedSeconds < 1) return;
    this.focusTickAt = now;
    const remainingSeconds = Math.max(
      0,
      this.state.focus.remainingSeconds - elapsedSeconds,
    );
    if (remainingSeconds <= 0) {
      this.state = mergeUIState(this.state, {
        focus: { phase: "complete", remainingSeconds: 0 },
        activePanel: "focus",
      });
      this.stopFocusTicker();
      this.emit({ type: "focus-complete" });
      this.scheduleRender();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => this.focusFirstInPanel()),
      );
      return;
    }
    this.state = mergeUIState(this.state, {
      focus: { remainingSeconds },
    });
    this.scheduleRender();
  };
}
