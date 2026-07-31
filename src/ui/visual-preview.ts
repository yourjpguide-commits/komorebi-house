import { createGameUI, type PanelId } from "./index";

const host = document.querySelector<HTMLElement>("#ui-preview");
if (!host) throw new Error("Missing UI preview host.");

const params = new URLSearchParams(window.location.search);
const requestedPanel = params.get("panel");
const panels: Array<Exclude<PanelId, null>> = [
  "shop",
  "map",
  "inventory",
  "focus",
  "pause",
  "settings",
  "onboarding",
];
const activePanel = panels.includes(
  requestedPanel as Exclude<PanelId, null>,
)
  ? (requestedPanel as Exclude<PanelId, null>)
  : null;
const requestedLocation = params.get("location");
const currentLocation =
  requestedLocation === "garden" ||
  requestedLocation === "cafe" ||
  requestedLocation === "park"
    ? requestedLocation
    : "room";

const ui = createGameUI(host, {
  connectWindowEvents: false,
  initialState: {
    activePanel,
    coins: 1260,
    currentLocation,
    customizerMode: params.get("customizer") === "1",
    onboarding: {
      active: activePanel === "onboarding",
      step: Math.max(0, Math.min(3, Number(params.get("step") ?? 0))),
    },
  },
});

if (params.get("empty") === "1") {
  ui.update({
    inventory: ui
      .getState()
      .inventory.map((item) => ({ ...item, placed: item.owned })),
  });
}

if (params.get("editing") === "1") {
  const selected =
    ui.getState().inventory.find((item) => (item.placed ?? 0) > 0) ??
    ui.getState().inventory[0];
  ui.update({
    activePanel: null,
    decorMode: true,
    editingExisting: true,
    selectedItemId: selected?.id,
    placementValid: true,
  });
}

Object.assign(window, { __KOMOREBI_UI_PREVIEW__: ui });
