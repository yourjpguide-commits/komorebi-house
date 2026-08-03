import { icon, weatherIcon, type IconName } from "./icons";
import {
  createFurnitureSprite,
  furnitureSupportedRotations,
} from "../art/furniture";
import { WORLD_FURNITURE_ASSETS } from "../game/worldAssets";
import type {
  CatalogItem,
  FocusActivity,
  GameUIState,
  ItemCategory,
  ItemVisual,
  ToastMessage,
  } from "./types";

const furnitureSvgCache = new Map<string, string>();

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatHikari(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString("en-US");
}

function locationIcon(
  name: GameUIState["locations"][number]["icon"],
): IconName {
  return name;
}

/**
 * A place name is a label first and a noun second on a small handheld screen.
 * Keep the complete name in the accessible label while giving the two narrow
 * HUD surfaces a deliberately short, non-ellipsized reading.
 */
function compactLocationName(
  location: GameUIState["locations"][number] | undefined,
): string {
  if (!location) return "My room";
  switch (location.id) {
    case "cafe":
      return "Kissa";
    case "park":
      return "Riverside";
    default:
      return location.nameEn;
  }
}

function compactLocationKana(
  location: GameUIState["locations"][number],
): string {
  return location.id === "cafe" ? "こもれび・喫茶" : location.nameJa;
}

/**
 * Rotation is only offered when both the placement record and authored texture
 * cels support another facing. Upright props deliberately have a single
 * camera-facing cel, so sending a rotate command for them is a lie.
 */
function supportsAuthoredRotation(
  item: Pick<CatalogItem, "id" | "rotatable"> | undefined,
): boolean {
  return Boolean(
    item &&
      item.rotatable !== false &&
      furnitureSupportedRotations(item.id).length > 1,
  );
}

function itemArt(item: CatalogItem, compact = false): string {
  if (item.image) {
    return `<div class="kh-item-art${compact ? " is-compact" : ""}">
      <img src="${escapeHtml(item.image)}" alt="" draggable="false" />
    </div>`;
  }
  const externalArt = WORLD_FURNITURE_ASSETS.find(
    ({ key }) => key === `koh:decor:${item.id}`,
  );
  if (externalArt) {
    return `<div class="kh-item-art${compact ? " is-compact" : ""}">
      <img src="${escapeHtml(externalArt.path)}" alt="" draggable="false" />
    </div>`;
  }

  const visual: ItemVisual = item.visual ?? "vase";
  const cacheKey = `${item.id}:${item.palette ?? "default"}`;
  let svg = furnitureSvgCache.get(cacheKey);
  if (!svg) {
    const art = createFurnitureSprite(item.id, {
      seed: "komorebi-ui-catalog",
      palette: item.palette ? { mid: item.palette } : undefined,
    });
    const rectangles = art.commands
      .map(
        (command) =>
          `<rect x="${command.x}" y="${command.y}" width="${command.width}" height="${command.height}" fill="${escapeHtml(command.color)}"${command.alpha < 1 ? ` opacity="${command.alpha}"` : ""}/>`,
      )
      .join("");
    svg = `<svg class="kh-furniture-sprite" viewBox="0 0 ${art.width} ${art.height}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" focusable="false">${rectangles}</svg>`;
    furnitureSvgCache.set(cacheKey, svg);
  }

  return `<div class="kh-item-art${compact ? " is-compact" : ""}" data-visual="${visual}" aria-hidden="true">
    ${svg}
  </div>`;
}

function renderStatusBar(state: GameUIState): string {
  const location = state.locations.find(
    (entry) => entry.id === state.currentLocation,
  );

  return `<header class="kh-status-bar" aria-label="Game status">
    <div class="kh-status-brand" aria-label="Komorebi House">
      <span class="kh-brand-seal">${icon("leaf")}</span>
      <span class="kh-brand-copy">
        <span class="kh-brand-title">KOMOREBI</span>
        <span class="kh-brand-kana">こもれび日和</span>
      </span>
    </div>

    <div class="kh-status-place">
      <span class="kh-status-weather" data-weather="${state.weather}">
        ${weatherIcon(state.weather)}
      </span>
      <span data-testid="location-label">
        <strong><span class="kh-place-name-full">${escapeHtml(location?.nameEn ?? state.currentLocation)}</span><span class="kh-place-name-compact">${escapeHtml(compactLocationName(location))}</span></strong>
        <span class="kh-visually-hidden">${escapeHtml(location?.nameJa ?? "")}</span>
        <small>${escapeHtml(state.dayLabel)} · ${escapeHtml(state.timeLabel)}</small>
      </span>
    </div>

    <div class="kh-status-actions">
      <button class="kh-status-prompt" type="button" data-action="goal" aria-label="Current little goal">
        ${icon("spark")}
        <span>
          <small>Today’s little goal</small>
          <strong>${escapeHtml(state.goalTitle)}</strong>
        </span>
        ${
          typeof state.goalProgress === "number"
            ? `<i style="--goal-progress:${Math.max(0, Math.min(1, state.goalProgress))}"></i>`
            : ""
        }
      </button>
      <div class="kh-currency" title="Hikari earned by spending time well" data-testid="hud-coins">
        <span class="kh-hikari-gem">${icon("hikari")}</span>
        <span><strong><span aria-hidden="true">${formatHikari(state.coins)}</span><span class="kh-visually-hidden">${Math.max(0, Math.floor(state.coins))}</span></strong><small>光 HIKARI</small></span>
      </div>
      <button class="kh-icon-button kh-mute-button" type="button" data-action="mute-toggle" data-testid="mute-button" aria-label="${state.settings.muted ? "Unmute sound" : "Mute sound"}" aria-pressed="${state.settings.muted}">
        ${icon(state.settings.muted ? "sound" : "music")}
      </button>
      <button class="kh-icon-button kh-pause-button" type="button" data-action="pause-open" aria-label="Pause and settings">
        ${icon("menu")}
      </button>
    </div>
  </header>`;
}

function renderLocationRail(state: GameUIState): string {
  return `<nav class="kh-location-rail" aria-label="Places">
    <span class="kh-rail-label">PLACES</span>
    <div class="kh-location-list">
      ${state.locations
        .map(
          (location) => `<button
            class="kh-location-button${location.id === state.currentLocation ? " is-current" : ""}"
            type="button"
            data-action="travel"
            data-location="${location.id}"
            data-accent="${location.accent}"
            ${location.unlocked ? "" : "disabled"}
            aria-current="${location.id === state.currentLocation ? "location" : "false"}"
            aria-label="${escapeHtml(location.nameEn)}${location.unlocked ? "" : ", locked"}"
          >
            <span class="kh-location-icon">${icon(
              location.unlocked ? locationIcon(location.icon) : "lock",
            )}</span>
            <span class="kh-location-copy">
              <strong>${escapeHtml(compactLocationName(location))}</strong>
              <small>${escapeHtml(compactLocationKana(location))}</small>
            </span>
          </button>`,
        )
        .join("")}
    </div>
    <button class="kh-map-button" type="button" data-action="map-open" data-testid="travel-button">
      ${icon("map")}<span>Neighborhood map</span>
    </button>
  </nav>`;
}

function renderQuickActions(state: GameUIState): string {
  const focusRunning =
    state.focus.phase === "running" || state.focus.phase === "paused";
  return `<aside class="kh-quick-actions" aria-label="Quick actions">
    <button type="button" data-action="shop-open" aria-pressed="${state.activePanel === "shop" && !state.customizerMode}">
      <span>${icon("shop")}</span><b>Shop</b><small>暮らしの店</small>
    </button>
    <button type="button" data-action="customizer-open" data-testid="customize-button" class="${state.decorMode ? "is-active" : ""}" aria-pressed="${state.decorMode || state.activePanel === "inventory" || (state.activePanel === "shop" && state.customizerMode)}">
      <span>${icon("bag")}</span><b>Decorate</b><small>模様替え</small>
    </button>
    <button type="button" data-action="focus-open" data-testid="focus-button" class="${focusRunning ? "is-active" : ""}" aria-pressed="${focusRunning || state.activePanel === "focus"}">
      <span>${icon("timer")}</span><b>${focusRunning ? "Focusing" : "Focus"}</b><small>${focusRunning ? formatClock(state.focus.remainingSeconds) : "ひとやすみ"}</small>
    </button>
  </aside>`;
}

function renderInteractionPrompt(state: GameUIState): string {
  if (!state.prompt || state.activePanel || state.dialogue) return "";
  return `<button class="kh-interaction-prompt" type="button" data-action="interact">
    <kbd>E</kbd>
    <span>${escapeHtml(state.prompt)}</span>
    ${icon("chevron")}
  </button>`;
}

const SHOP_CATEGORIES: Array<{
  id: ItemCategory;
  label: string;
  kana: string;
}> = [
  { id: "featured", label: "Picked for you", kana: "おすすめ" },
  { id: "furniture", label: "Furniture", kana: "家具" },
  { id: "lighting", label: "Lighting", kana: "照明" },
  { id: "study", label: "Study", kana: "勉強" },
  { id: "plants", label: "Plants", kana: "植物" },
  { id: "garden", label: "Garden", kana: "庭" },
  { id: "cafe", label: "Kissaten", kana: "喫茶" },
  { id: "decor", label: "Small things", kana: "雑貨" },
];

function getShopItems(state: GameUIState): CatalogItem[] {
  const query = state.catalogQuery.trim().toLocaleLowerCase();
  const matching = state.catalog.filter((item) => {
    const categoryMatch =
      state.catalogCategory === "featured"
        ? item.new || item.rarity === "special" || item.rarity === "artisan"
        : item.category === state.catalogCategory;
    const queryMatch =
      !query ||
      `${item.nameEn} ${item.nameJa} ${item.description}`
        .toLocaleLowerCase()
        .includes(query);
    return categoryMatch && queryMatch;
  });
  if (state.catalogCategory === "featured" && !query) {
    const ordered = state.customizerMode
      ? [...matching].sort((left, right) => {
          const leftFits = left.placementLocations?.includes(
            state.currentLocation,
          )
            ? 1
            : 0;
          const rightFits = right.placementLocations?.includes(
            state.currentLocation,
          )
            ? 1
            : 0;
          return rightFits - leftFits;
        })
      : matching;
    return ordered.slice(0, 12);
  }
  return matching;
}

function renderItemCard(item: CatalogItem, state: GameUIState): string {
  const affordable = state.coins >= item.price;
  const rarity = item.rarity ?? "everyday";
  return `<article class="kh-shop-card" data-rarity="${rarity}" data-testid="catalog-item-${escapeHtml(item.id)}" data-sku="${escapeHtml(item.id)}" data-price="${item.price}" data-rotatable="${item.rotatable !== false}">
    <div class="kh-shop-card-art">
      ${itemArt(item)}
      ${item.new ? '<span class="kh-new-ribbon">NEW</span>' : ""}
      ${item.owned ? `<span class="kh-owned-mark">${icon("check")} ${item.owned} owned</span>` : ""}
    </div>
    <div class="kh-shop-card-copy">
      <small>${escapeHtml(item.nameJa)}</small>
      <h3>${escapeHtml(item.nameEn)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="kh-shop-card-foot">
        <span class="kh-item-price">${icon("hikari")}<b>${formatHikari(item.price)}</b></span>
        <button
          type="button"
          data-action="purchase"
          data-testid="buy-${escapeHtml(item.id)}"
          data-item-id="${escapeHtml(item.id)}"
          data-price="${item.price}"
          data-affordable="${affordable}"
          aria-label="${affordable ? `Buy ${escapeHtml(item.nameEn)} for ${item.price} Hikari` : `Not enough Hikari for ${escapeHtml(item.nameEn)}`}"
        >${affordable ? "Bring home" : "Save up"}</button>
      </div>
    </div>
  </article>`;
}

function renderInventoryItemButton(
  item: GameUIState["inventory"][number],
  state: GameUIState,
  extraClass = "",
): string {
  const available = Math.max(0, item.quantity - (item.placed ?? 0));
  const selectedItem = item.id === state.selectedItemId;
  const compatible =
    !item.placementLocations?.length ||
    item.placementLocations.includes(state.currentLocation);
  const unavailable = available <= 0 || !compatible;
  const unavailableLabel = !compatible
    ? state.currentLocation === "garden"
      ? "This piece belongs indoors"
      : state.currentLocation === "room"
        ? "This piece belongs in the garden"
        : "Decorating is available at home and in the garden"
    : "Every copy is already placed";
  return `<button
    class="kh-inventory-item${extraClass ? ` ${extraClass}` : ""}${selectedItem ? " is-selected" : ""}"
    type="button"
    aria-pressed="${selectedItem}"
    data-action="inventory-select"
    data-testid="inventory-item-${escapeHtml(item.id)}"
    data-item-id="${escapeHtml(item.id)}"
    ${available <= 0 ? 'data-all-placed="true"' : ""}
    ${!compatible ? 'data-wrong-location="true"' : ""}
    ${unavailable && !selectedItem ? `disabled aria-label="${escapeHtml(unavailableLabel)}"` : ""}
  >
    ${itemArt(item, true)}
    <span class="kh-inventory-name">${escapeHtml(item.nameEn)}</span>
    <span class="kh-inventory-count">${!compatible ? (state.currentLocation === "garden" ? "indoors" : state.currentLocation === "room" ? "garden" : "home") : available > 0 ? `×${available}` : "placed"}</span>
  </button>`;
}

function renderShop(state: GameUIState): string {
  if (state.activePanel !== "shop") return "";
  const items = getShopItems(state);
  const readyItems = state.inventory.filter(
    (item) =>
      item.quantity - (item.placed ?? 0) > 0 &&
      (!item.placementLocations?.length ||
        item.placementLocations.includes(state.currentLocation)),
  );
  const hasUnplacedItems = state.inventory.some(
    (item) => item.quantity - (item.placed ?? 0) > 0,
  );
  const atelierCopy =
    state.currentLocation === "garden"
      ? {
          kicker: "GARDEN ATELIER · 庭づくり",
          title: "Treasures for your garden",
        }
      : state.currentLocation === "room"
        ? {
            kicker: "MY ROOM ATELIER · 模様替え",
            title: "Treasures for your space",
          }
        : {
            kicker: "POCKET CATALOG · 持ちもの",
            title: "Choose treasures for home",
          };
  return `<div class="kh-scrim kh-panel-scrim" data-action="panel-scrim" aria-hidden="true"></div>
    <section class="kh-drawer kh-shop" role="dialog" aria-modal="true" aria-labelledby="kh-shop-title" data-testid="catalog-panel">
      <div class="kh-drawer-handle" aria-hidden="true"></div>
      <header class="kh-drawer-header">
        <span class="kh-drawer-emblem">${icon(state.customizerMode ? "bag" : "shop")}</span>
        <div>
          <small>${state.customizerMode ? atelierCopy.kicker : "KURASHI NO MISE · 暮らしの店"}</small>
          <h2 id="kh-shop-title">${state.customizerMode ? atelierCopy.title : "Things for a softer day"}</h2>
        </div>
        <button class="kh-icon-button" type="button" data-action="panel-close" aria-label="${state.customizerMode ? "Close customizer" : "Close shop"}">${icon("close")}</button>
      </header>
      <div class="kh-shop-wallet">
        <span>${icon("hikari")} Your Hikari</span>
        <strong>${formatHikari(state.coins)} <small>光</small></strong>
      </div>
      <label class="kh-search">
        ${icon("search")}
        <span class="kh-visually-hidden">Search the shop</span>
        <input type="search" data-input="shop-search" value="${escapeHtml(state.catalogQuery)}" placeholder="Find something lovely…" autocomplete="off" />
        ${state.catalogQuery ? `<button type="button" data-action="shop-search-clear" aria-label="Clear search">${icon("close")}</button>` : ""}
      </label>
      <section class="kh-shop-owned${readyItems.length ? "" : " is-empty"}" aria-labelledby="kh-owned-title">
        <header>
          <span>${icon("bag")}</span>
          <span><strong id="kh-owned-title">Ready to place</strong><small>持ちもの · choose one to decorate</small></span>
          <button type="button" data-action="inventory-open">Full tray ${icon("arrow")}</button>
        </header>
        <div class="kh-shop-owned-row">
          ${
            readyItems.length
              ? readyItems
                  .map((item) =>
                    renderInventoryItemButton(item, state, "kh-owned-shelf-item"),
                  )
                  .join("")
              : `<p>${
                  hasUnplacedItems
                    ? state.currentLocation === "garden"
                      ? "Your other free pieces are waiting inside."
                      : state.currentLocation === "room"
                        ? "Your garden pieces are waiting just outside."
                        : "Decorating waits for you at home or in the garden."
                    : "Everything you own is already making a room feel lived-in."
                }</p>`
          }
        </div>
      </section>
      <div class="kh-shop-body">
        <nav class="kh-category-tabs" aria-label="Shop departments">
          ${SHOP_CATEGORIES.map(
            (category) => `<button type="button" data-action="shop-category" data-category="${category.id}" class="${state.catalogCategory === category.id ? "is-active" : ""}" aria-pressed="${state.catalogCategory === category.id}">
              <span>${category.label}</span><small>${category.kana}</small>
            </button>`,
          ).join("")}
        </nav>
        <div class="kh-shop-grid" aria-live="polite">
          ${
            items.length
              ? items.map((item) => renderItemCard(item, state)).join("")
              : `<div class="kh-empty-state">
                  <span>${icon("leaf")}</span>
                  <h3>Nothing tucked away here</h3>
                  <p>Try a different shelf or another search.</p>
                </div>`
          }
        </div>
      </div>
    </section>`;
}

const INVENTORY_CATEGORIES: Array<{
  id: GameUIState["inventoryCategory"];
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "furniture", label: "Furniture" },
  { id: "lighting", label: "Lights" },
  { id: "study", label: "Study" },
  { id: "plants", label: "Plants" },
  { id: "garden", label: "Garden" },
  { id: "cafe", label: "Kissaten" },
  { id: "decor", label: "Small things" },
];

function renderInventory(state: GameUIState): string {
  const isOpen = state.activePanel === "inventory" || state.decorMode;
  if (!isOpen) return "";
  const items = state.inventory.filter(
    (item) =>
      state.inventoryCategory === "all" ||
      item.category === state.inventoryCategory,
  );
  const selected = state.inventory.find(
    (item) => item.id === state.selectedItemId,
  );
  const canRotateSelected = supportsAuthoredRotation(selected);

  return `<section class="kh-decor-tray${state.decorMode ? " is-decorating" : ""}" aria-label="Decorating tray"${state.decorMode && selected ? ` data-testid="placement-preview" data-valid="${state.placementValid}"` : ""}>
    <header class="kh-tray-header">
      <span class="kh-tray-title-icon">${icon("bag")}</span>
      <div>
        <small>${state.editingExisting ? "EDITING A FAVORITE · 家具を整える" : state.decorMode ? "PLACEMENT MODE · 配置中" : "MY THINGS · 持ちもの"}</small>
        <h2>${state.editingExisting ? "Keep it, move it, or tuck it away" : state.decorMode ? "Where should it live?" : "Make the space yours"}</h2>
      </div>
      ${
        state.decorMode
          ? `<span class="kh-grid-hint"><kbd>G</kbd> Grid on</span>`
          : `<button class="kh-tray-start" type="button" data-action="decor-start">${icon("place")} Start decorating</button>`
      }
      <button class="kh-icon-button" type="button" data-action="${state.decorMode ? "decor-exit" : "panel-close"}"${state.decorMode ? ' data-testid="placement-cancel"' : ""} aria-label="${state.decorMode ? "Cancel placement and finish decorating" : "Close inventory"}">${state.decorMode ? icon("close") : icon("close")}</button>
    </header>
    ${
      state.editingExisting && selected
        ? `<section class="kh-selected-object-panel${state.existingMoveActive ? " is-moving" : ""}${canRotateSelected ? "" : " is-fixed-facing"}" data-testid="selected-object-panel" aria-label="Selected object controls">
            <span class="kh-selected-object-art">${itemArt(selected, true)}</span>
            <span class="kh-selected-object-copy">
              <small>${state.existingMoveActive ? "CHOOSE ITS NEW SPOT" : "SELECTED"}</small>
              <strong>${escapeHtml(selected.nameEn)}</strong>
              <em>${state.existingMoveActive ? "Move the preview, then choose Set here." : "What would feel better?"}</em>
            </span>
            <button class="is-primary" type="button" data-action="decor-move" data-testid="move-selected" aria-pressed="${state.existingMoveActive}">${icon("place")} ${state.existingMoveActive ? "Moving" : "Move"}</button>
            ${canRotateSelected ? `<button type="button" data-action="decor-rotate" data-testid="rotate-selected">${icon("rotate")} Rotate</button>` : ""}
            <button type="button" data-action="decor-store" data-testid="remove-selected">${icon("store")} Store</button>
          </section>`
        : ""
    }
    <div class="kh-tray-main">
      <nav class="kh-inventory-tabs" aria-label="Item types">
        ${INVENTORY_CATEGORIES.map(
          (category) => `<button type="button" data-action="inventory-category" data-category="${category.id}" class="${state.inventoryCategory === category.id ? "is-active" : ""}" aria-pressed="${state.inventoryCategory === category.id}">${category.label}</button>`,
        ).join("")}
      </nav>
      <div class="kh-inventory-row" aria-label="Owned items">
        ${
          items.length
            ? items
                .map((item) => renderInventoryItemButton(item, state))
                .join("")
            : `<div class="kh-inventory-empty">No treasures in this category yet.</div>`
        }
      </div>
      ${
        state.decorMode
          ? `<div class="kh-decor-tools" aria-label="Placement tools">
              ${selected && !state.placementValid ? `<span class="kh-placement-error" data-testid="placement-error">${icon("leaf")} That spot needs a little more room.</span>` : ""}
              <button type="button" data-action="decor-undo" ${state.canUndo ? "" : "disabled"} aria-label="Undo">${icon("undo")}<small>Z</small></button>
              <button type="button" data-action="decor-redo" ${state.canRedo ? "" : "disabled"} aria-label="Redo">${icon("redo")}<small>Y</small></button>
              ${
                state.editingExisting
                  ? ""
                  : `${canRotateSelected ? `<button type="button" data-action="decor-rotate" data-testid="placement-rotate" aria-label="Rotate selected item">${icon("rotate")}<small>R</small></button>` : ""}
                    <button type="button" data-action="decor-store" ${selected ? "" : "disabled"} aria-label="Put item away">${icon("store")}<small>⌫</small></button>`
              }
              <button class="is-primary" type="button" data-action="decor-place" data-testid="placement-confirm" ${selected && state.placementValid ? "" : "disabled"}>${icon("place")} ${state.editingExisting ? "Set here" : "Place"} <small>↵</small></button>
            </div>`
          : ""
      }
    </div>
  </section>`;
}

function renderMap(state: GameUIState): string {
  if (state.activePanel !== "map") return "";
  const currentIndex = Math.max(
    0,
    state.locations.findIndex((location) => location.id === state.currentLocation),
  );
  return `<div class="kh-scrim" data-action="panel-scrim" aria-hidden="true"></div>
    <section class="kh-paper-modal kh-map-modal" role="dialog" aria-modal="true" aria-labelledby="kh-map-title" data-testid="travel-sheet">
      <header class="kh-modal-heading">
        <div><small>OUR LITTLE NEIGHBORHOOD · まち歩き</small><h2 id="kh-map-title">Where shall we spend the day?</h2></div>
        <button class="kh-icon-button" type="button" data-action="panel-close" aria-label="Close map">${icon("close")}</button>
      </header>
      <div class="kh-map-canvas" style="--current-stop:${currentIndex}">
        <div class="kh-map-river" aria-hidden="true"></div>
        <div class="kh-map-path" aria-hidden="true"></div>
        <span class="kh-map-cloud cloud-one" aria-hidden="true">${icon("cloud")}</span>
        <span class="kh-map-cloud cloud-two" aria-hidden="true">${icon("cloud")}</span>
        ${state.locations
          .map(
            (location, index) => `<button
              type="button"
              class="kh-map-stop${location.id === state.currentLocation ? " is-current" : ""}"
              style="--stop:${index}"
              data-action="travel"
              data-testid="travel-${location.id}"
              data-location="${location.id}"
              data-accent="${location.accent}"
              ${location.id === state.currentLocation ? 'aria-current="location"' : ""}
              ${location.unlocked ? "" : "disabled"}
            >
              <span>${icon(location.unlocked ? locationIcon(location.icon) : "lock")}</span>
              <strong>${escapeHtml(location.nameEn)}</strong>
              <small>${escapeHtml(location.nameJa)}</small>
            </button>`,
          )
          .join("")}
      </div>
      <footer class="kh-map-note">
        ${icon("footsteps")}<span><strong>Everything is close by.</strong> Take a slow walk and listen to the neighborhood.</span>
      </footer>
    </section>`;
}

const ACTIVITIES: Array<{
  id: FocusActivity;
  label: string;
  kana: string;
  copy: string;
  icon: IconName;
}> = [
  {
    id: "study",
    label: "Study",
    kana: "勉強する",
    copy: "Settle into one clear task.",
    icon: "pencil",
  },
  {
    id: "read",
    label: "Read",
    kana: "本を読む",
    copy: "Disappear into a few quiet pages.",
    icon: "book",
  },
  {
    id: "journal",
    label: "Journal",
    kana: "日記を書く",
    copy: "Make a little room for your thoughts.",
    icon: "journal",
  },
  {
    id: "create",
    label: "Create",
    kana: "ものづくり",
    copy: "Follow an idea without rushing.",
    icon: "palette",
  },
];

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function renderFocus(state: GameUIState): string {
  const focusOpen = state.activePanel === "focus";
  const active =
    state.focus.phase === "running" ||
    state.focus.phase === "paused" ||
    state.focus.phase === "complete";
  if (!focusOpen && !active) return "";

  if (!focusOpen && active) {
    const progress =
      1 - state.focus.remainingSeconds / Math.max(1, state.focus.durationSeconds);
    return `<button class="kh-focus-mini" type="button" data-action="focus-open" style="--focus-progress:${Math.max(0, Math.min(1, progress))}">
      <span class="kh-mini-timer">${icon(state.focus.phase === "paused" ? "pause" : state.focus.phase === "complete" ? "check" : "timer")}</span>
      <span><small>${state.focus.phase === "paused" ? "PAUSED" : state.focus.phase === "complete" ? "MOMENT COMPLETE" : "IN THE FLOW"}</small><strong>${formatClock(state.focus.remainingSeconds)}</strong></span>
      ${icon("chevron")}
    </button>`;
  }

  const durationMinutes = Math.round(state.focus.durationSeconds / 60);
  const progress =
    1 - state.focus.remainingSeconds / Math.max(1, state.focus.durationSeconds);
  const activity =
    ACTIVITIES.find((entry) => entry.id === state.focus.activity) ??
    ACTIVITIES[0]!;
  const currentLocation = state.locations.find(
    (entry) => entry.id === state.currentLocation,
  );

  return `<div class="kh-scrim kh-focus-scrim" aria-hidden="true"></div>
    <section class="kh-focus-overlay" role="dialog" aria-modal="true" aria-labelledby="kh-focus-title" data-testid="focus-panel">
      <div class="kh-focus-paper">
        <button class="kh-icon-button kh-focus-close" type="button" data-action="${active ? "focus-minimize" : "panel-close"}" aria-label="${active ? "Minimize focus timer" : "Close focus setup"}">${icon("close")}</button>
        ${
          state.focus.phase === "idle"
            ? `<div class="kh-focus-intro">
                <span class="kh-focus-kicker">${icon("leaf")} A SMALL POCKET OF TIME</span>
                <h2 id="kh-focus-title">What feels good to do here?</h2>
                <p>No pressure, no score. Just choose a gentle intention and let the room keep you company.</p>
              </div>
              <div class="kh-activity-grid">
                ${ACTIVITIES.map(
                  (entry) => `<button type="button" data-action="focus-activity" data-activity="${entry.id}" class="${state.focus.activity === entry.id ? "is-selected" : ""}" aria-pressed="${state.focus.activity === entry.id}">
                    <span>${icon(entry.icon)}</span>
                    <strong>${entry.label}<small>${entry.kana}</small></strong>
                    <p>${entry.copy}</p>
                    <i>${icon("check")}</i>
                  </button>`,
                ).join("")}
              </div>
              <div class="kh-duration-picker">
                <div>
                  <small>HOW LONG FEELS RIGHT?</small>
                  <strong><span data-focus-duration-label>${durationMinutes}</span> minutes</strong>
                </div>
                <input type="range" data-input="focus-duration" min="5" max="60" step="5" value="${durationMinutes}" aria-label="Focus duration in minutes" />
                <div class="kh-duration-marks" aria-hidden="true"><span>5</span><span>25</span><span>45</span><span>60</span></div>
              </div>
              <div class="kh-focus-place">
                <span>${icon(locationIcon(currentLocation?.icon ?? "home"))}</span>
                <span><small>Settling in at</small><strong>${escapeHtml(currentLocation?.nameEn ?? "My room")}</strong></span>
                <span class="kh-place-okay">${icon("check")} Cozy enough</span>
              </div>
              <button class="kh-focus-start" type="button" data-action="focus-start" data-testid="focus-start">${icon("timer")} Begin a quiet ${durationMinutes} minutes <span>${icon("arrow")}</span></button>`
            : state.focus.phase === "complete"
              ? `<div class="kh-focus-complete">
                  <span class="kh-complete-sun">${icon("sun")}</span>
                  <small>A MOMENT WELL SPENT</small>
                  <h2 id="kh-focus-title">You made a little room for yourself.</h2>
                  <p>${durationMinutes} peaceful minutes of ${activity.label.toLocaleLowerCase()} at ${escapeHtml(currentLocation?.nameEn ?? "home")}.</p>
                  <div class="kh-focus-reward"><span>${icon("hikari")}</span><strong>+${Math.max(5, durationMinutes * 10)} 光</strong><small>Hikari gathered</small></div>
                  <div class="kh-streak-note">${icon("heart")} A ${state.focus.streak}-day gentle streak. Come back because it feels good.</div>
                  <button class="kh-focus-start" type="button" data-action="focus-dismiss" data-testid="focus-complete">Return to the day ${icon("arrow")}</button>
                </div>`
              : `<div class="kh-running-focus">
                  <span class="kh-focus-kicker">${icon(activity.icon)} ${activity.label.toLocaleUpperCase()} · ${activity.kana}</span>
                  <div class="kh-focus-dial" style="--focus-progress:${Math.max(0, Math.min(1, progress))}">
                    <div>
                      <small>${state.focus.phase === "paused" ? "TAKE YOUR TIME" : "A QUIET WHILE"}</small>
                      <strong>${formatClock(state.focus.remainingSeconds)}</strong>
                      <span>${escapeHtml(currentLocation?.nameJa ?? "わたしの部屋")}</span>
                    </div>
                  </div>
                  <h2 id="kh-focus-title">${state.focus.phase === "paused" ? "Paused. The room will wait." : escapeHtml(state.focus.sessionLabel ?? "Let the rest of the world soften.")}</h2>
                  <p class="kh-focus-whisper">“${state.focus.phase === "paused" ? "Stretch, sip some water, and return when you’re ready." : "One page, one thought, one small thing at a time."}”</p>
                  <div class="kh-focus-controls">
                    <button type="button" data-action="focus-cancel">${icon("stop")} End</button>
                    <button class="is-primary" type="button" data-action="${state.focus.phase === "paused" ? "focus-resume" : "focus-pause"}" data-testid="${state.focus.phase === "paused" ? "focus-resume" : "focus-pause"}">${icon(state.focus.phase === "paused" ? "play" : "pause")} ${state.focus.phase === "paused" ? "Continue" : "Pause"}</button>
                  </div>
                  <div class="kh-focus-ambience">${icon("music")} Window breeze · distant neighborhood · soft vinyl</div>
                </div>`
        }
      </div>
    </section>`;
}

function volumeSetting(
  key: "music" | "ambience" | "effects",
  label: string,
  kana: string,
  value: number,
  iconName: IconName,
): string {
  return `<label class="kh-volume-row">
    <span>${icon(iconName)}</span>
    <span><strong>${label}</strong><small>${kana}</small></span>
    <input type="range" data-setting="${key}" min="0" max="1" step="0.01" value="${Math.max(0, Math.min(1, value))}" aria-label="${label} volume" />
    <output>${Math.round(value * 100)}</output>
  </label>`;
}

function toggleSetting(
  key:
    | "reducedMotion"
    | "highContrast"
    | "largeText"
    | "showTouchControls",
  label: string,
  detail: string,
  enabled: boolean,
  iconName: IconName,
): string {
  return `<label class="kh-setting-toggle">
    <span>${icon(iconName)}</span>
    <span><strong>${label}</strong><small>${detail}</small></span>
    <input type="checkbox" data-setting="${key}" ${enabled ? "checked" : ""} />
    <i aria-hidden="true"></i>
  </label>`;
}

function renderPause(state: GameUIState): string {
  if (state.activePanel !== "pause" && state.activePanel !== "settings") return "";
  const settings = state.activePanel === "settings";
  return `<div class="kh-scrim kh-pause-scrim" aria-hidden="true"></div>
    <section class="kh-paper-modal kh-pause-modal${settings ? " is-settings" : ""}" role="dialog" aria-modal="true" aria-labelledby="kh-pause-title">
      <header class="kh-modal-heading">
        <div><small>${settings ? "HOW THE WORLD FEELS · 設定" : "A LITTLE PAUSE · ひとやすみ"}</small><h2 id="kh-pause-title">${settings ? "Settings" : "The day can wait."}</h2></div>
        <button class="kh-icon-button" type="button" data-action="${settings ? "pause-back" : "pause-close"}" aria-label="${settings ? "Back to pause menu" : "Resume game"}">${settings ? icon("arrow", "is-back") : icon("close")}</button>
      </header>
      ${
        settings
          ? `<div class="kh-settings">
              <section>
                <h3>Sound <small>音</small></h3>
                ${volumeSetting("music", "Music", "音楽", state.settings.music, "music")}
                ${volumeSetting("ambience", "Ambience", "環境音", state.settings.ambience, "leaf")}
                ${volumeSetting("effects", "Little sounds", "効果音", state.settings.effects, "sound")}
              </section>
              <section>
                <h3>Comfort <small>遊びやすさ</small></h3>
                ${toggleSetting("reducedMotion", "Reduce motion", "Gentler transitions and no drifting particles", state.settings.reducedMotion, "motion")}
                ${toggleSetting("highContrast", "High contrast", "Stronger edges and clearer controls", state.settings.highContrast, "contrast")}
                ${toggleSetting("largeText", "Larger words", "Give labels and dialogue more room", state.settings.largeText, "text")}
                ${toggleSetting("showTouchControls", "Touch controls", "Always show the movement pad", state.settings.showTouchControls, "footsteps")}
              </section>
              <section class="kh-pixel-scale-setting">
                <h3>Pixel scale <small>画面</small></h3>
                <div role="radiogroup" aria-label="Pixel scale">
                  ${([1, 2, 3] as const)
                    .map(
                      (scale) => `<button type="button" data-action="pixel-scale" data-scale="${scale}" role="radio" aria-checked="${state.settings.pixelScale === scale}" class="${state.settings.pixelScale === scale ? "is-active" : ""}">
                      <span class="kh-scale-pixels" data-scale="${scale}"><i></i><i></i><i></i></span>
                      <b>${scale === 1 ? "Soft" : scale === 2 ? "Crisp" : "Chunky"}</b>
                    </button>`,
                    )
                    .join("")}
                </div>
              </section>
            </div>`
          : `<div class="kh-pause-postcard">
              <div class="kh-postcard-scene" aria-hidden="true"><span></span><i></i><b></b></div>
              <div><small>${escapeHtml(state.seasonLabel)}</small><strong>${escapeHtml(state.timeLabel)}</strong><span>${weatherIcon(state.weather)} ${escapeHtml(state.currentLocation)}</span></div>
            </div>
            <nav class="kh-pause-menu" aria-label="Pause menu">
              <button type="button" data-action="pause-close"><span>${icon("play")}</span><strong>Return to the day<small>つづける</small></strong>${icon("chevron")}</button>
              <button type="button" data-action="settings-open"><span>${icon("sound")}</span><strong>Settings<small>設定</small></strong>${icon("chevron")}</button>
              <button type="button" data-action="map-open"><span>${icon("map")}</span><strong>Neighborhood map<small>まちの地図</small></strong>${icon("chevron")}</button>
            </nav>
            <p class="kh-save-note">${icon("check")} Your room is saved whenever you put something down.</p>`
      }
    </section>`;
}

function renderDialogue(state: GameUIState): string {
  if (!state.dialogue) return "";
  const dialogue = state.dialogue;
  return `<section class="kh-dialogue" role="dialog" aria-live="polite" aria-label="Conversation with ${escapeHtml(dialogue.speaker)}">
    ${
      dialogue.portrait && dialogue.portrait !== "none"
        ? `<div class="kh-dialogue-portrait" data-portrait="${dialogue.portrait}" aria-hidden="true"><span></span><i></i><b></b></div>`
        : ""
    }
    <div class="kh-dialogue-card">
      <header><strong>${escapeHtml(dialogue.speaker)}</strong>${dialogue.speakerJa ? `<small>${escapeHtml(dialogue.speakerJa)}</small>` : ""}</header>
      <p>${escapeHtml(dialogue.text)}</p>
      ${
        dialogue.choices?.length
          ? `<div class="kh-dialogue-choices">${dialogue.choices
              .map(
                (choice) => `<button type="button" data-action="dialogue-choice" data-choice-id="${escapeHtml(choice.id)}">${escapeHtml(choice.label)}${icon("chevron")}</button>`,
              )
              .join("")}</div>`
          : dialogue.canAdvance !== false
            ? `<button class="kh-dialogue-next" type="button" data-action="dialogue-advance" aria-label="Continue">${icon("chevron")}</button>`
            : ""
      }
    </div>
  </section>`;
}

function renderToasts(toasts: ToastMessage[]): string {
  // The UI handle retains a maximum of two, but the render boundary is also
  // defensive so a future caller can never cover the playfield with a stack.
  const visibleToasts = toasts.slice(-2);
  return `<div class="kh-toast-stack" role="region" aria-label="Notifications" aria-live="polite" data-testid="toast-region">
    ${visibleToasts
      .map(
        (toast) => `<article class="kh-toast" data-tone="${toast.tone ?? "paper"}" data-toast-id="${escapeHtml(toast.id)}">
          <span class="kh-toast-icon">${icon(toast.tone === "warning" ? "leaf" : toast.tone === "success" ? "check" : "spark")}</span>
          <span><strong>${escapeHtml(toast.message)}</strong>${toast.detail ? `<small>${escapeHtml(toast.detail)}</small>` : ""}</span>
          <button type="button" data-action="toast-dismiss" data-toast-id="${escapeHtml(toast.id)}" aria-label="Dismiss notification">${icon("close")}</button>
        </article>`,
      )
      .join("")}
  </div>`;
}

function renderOnboarding(state: GameUIState): string {
  if (!state.onboarding.active) return "";
  const step = Math.max(0, Math.min(3, state.onboarding.step));
  const pages = [
    `<div class="kh-onboarding-hero">
      <div class="kh-welcome-window" aria-hidden="true"><span></span><i></i><b></b><em></em></div>
      <span class="kh-onboarding-kicker">${icon("leaf")} WELCOME HOME · おかえりなさい</span>
      <h2 id="kh-onboarding-title">A small place for<br/><em>your kind of day.</em></h2>
      <p>Fill a quiet Japanese home with things you love, wander the neighborhood, and make space for whatever matters today.</p>
      <label class="kh-name-field"><span>What should the neighbors call you?</span><input data-input="player-name" maxlength="14" value="${escapeHtml(state.onboarding.playerName)}" placeholder="Your name" autocomplete="nickname" /></label>
    </div>`,
    `<div class="kh-onboarding-feature">
      <div class="kh-feature-illustration is-decor" aria-hidden="true"><span></span><i></i><b></b><em></em></div>
      <span class="kh-onboarding-kicker">01 · MAKE IT YOURS</span>
      <h2 id="kh-onboarding-title">Every corner can tell<br/>a tiny story.</h2>
      <p>Open <strong>My Things</strong>, choose an object, then place and rotate it. Your room and garden remember every thoughtful detail.</p>
      <div class="kh-key-hints"><span><kbd>B</kbd> My things</span><span><kbd>R</kbd> Rotate</span><span><kbd>↵</kbd> Place</span></div>
    </div>`,
    `<div class="kh-onboarding-feature">
      <div class="kh-feature-illustration is-focus" aria-hidden="true"><span></span><i></i><b></b><em></em></div>
      <span class="kh-onboarding-kicker">02 · FIND YOUR RHYTHM</span>
      <h2 id="kh-onboarding-title">The room keeps time<br/>without rushing you.</h2>
      <p>Start a quiet timer when you want to study, read, journal, or create. You’ll gather <strong>Hikari</strong> simply by spending time well.</p>
      <div class="kh-onboarding-hikari">${icon("hikari")} <span>Quiet time</span>${icon("arrow")}<strong>光 Hikari</strong>${icon("arrow")}<span>Lovely things</span></div>
    </div>`,
    `<div class="kh-onboarding-feature">
      <div class="kh-feature-illustration is-neighborhood" aria-hidden="true"><span></span><i></i><b></b><em></em></div>
      <span class="kh-onboarding-kicker">03 · A NEIGHBORHOOD NEARBY</span>
      <h2 id="kh-onboarding-title">Your favorite place<br/>might be down the road.</h2>
      <p>Study by the café window, read beneath the park trees, or come home when the lanterns begin to glow.</p>
      <div class="kh-onboarding-places"><span>${icon("home")} Room</span><span>${icon("coffee")} Café</span><span>${icon("park")} Park</span><span>${icon("garden")} Garden</span></div>
    </div>`,
  ];

  return `<div class="kh-onboarding-backdrop"></div>
    <section class="kh-onboarding" role="dialog" aria-modal="true" aria-labelledby="kh-onboarding-title">
      <button class="kh-onboarding-skip" type="button" data-action="onboarding-skip">Skip introduction</button>
      <div class="kh-onboarding-page">${pages[step]}</div>
      <footer class="kh-onboarding-footer">
        <div class="kh-onboarding-dots" aria-label="Step ${step + 1} of 4">
          ${[0, 1, 2, 3].map((index) => `<i class="${index === step ? "is-current" : ""}${index < step ? " is-done" : ""}"></i>`).join("")}
        </div>
        <div>
          ${step > 0 ? `<button class="kh-onboarding-back" type="button" data-action="onboarding-back">${icon("arrow", "is-back")} Back</button>` : `<button class="kh-onboarding-back is-tour" type="button" data-action="onboarding-next">Quick tour</button>`}
          <button class="kh-onboarding-next" type="button" data-action="${step === 0 || step === 3 ? "onboarding-complete" : "onboarding-next"}" ${step === 0 || step === 3 ? 'data-testid="start-game"' : ""} ${step === 0 && !state.onboarding.playerName.trim() ? "disabled" : ""}>${step === 0 ? `Begin my day ${icon("sun")}` : step === 3 ? `Step into your day ${icon("sun")}` : `Next ${icon("arrow")}`}</button>
        </div>
      </footer>
    </section>`;
}

function renderMobileControls(state: GameUIState): string {
  if (!state.settings.showTouchControls) return "";
  return `<div class="kh-mobile-controls" aria-label="Touch controls">
    <div class="kh-dpad" data-testid="mobile-dpad">
      <button type="button" data-hold-action="move" data-direction="up" data-testid="dpad-up" aria-label="Move up">${icon("chevron")}</button>
      <button type="button" data-hold-action="move" data-direction="left" data-testid="dpad-left" aria-label="Move left">${icon("chevron")}</button>
      <i aria-hidden="true"></i>
      <button type="button" data-hold-action="move" data-direction="right" data-testid="dpad-right" aria-label="Move right">${icon("chevron")}</button>
      <button type="button" data-hold-action="move" data-direction="down" data-testid="dpad-down" aria-label="Move down">${icon("chevron")}</button>
    </div>
    <div class="kh-touch-actions">
      <button type="button" data-action="cancel" aria-label="Cancel"><span>B</span><small>Back</small></button>
      <button type="button" data-action="interact" aria-label="Interact"><span>A</span><small>Do</small></button>
    </div>
  </div>`;
}

function renderMobileNav(state: GameUIState): string {
  return `<nav class="kh-mobile-nav" aria-label="Game menu">
    <button type="button" data-action="map-open" aria-pressed="${state.activePanel === "map"}">${icon("map")}<span>Places</span></button>
    <button type="button" data-action="shop-open" aria-pressed="${state.activePanel === "shop" && !state.customizerMode}">${icon("shop")}<span>Shop</span></button>
    <button type="button" data-action="customizer-open" class="${state.decorMode ? "is-active" : ""}" aria-pressed="${state.decorMode || state.activePanel === "inventory" || (state.activePanel === "shop" && state.customizerMode)}">${icon("bag")}<span>Decor</span></button>
    <button type="button" data-action="focus-open" class="${state.focus.phase !== "idle" ? "is-active" : ""}" aria-pressed="${state.focus.phase !== "idle" || state.activePanel === "focus"}">${icon("timer")}<span>Focus</span></button>
    <button type="button" data-action="pause-open" aria-pressed="${state.activePanel === "pause" || state.activePanel === "settings"}">${icon("menu")}<span>More</span></button>
  </nav>`;
}

export function renderGameUI(
  state: GameUIState,
  toasts: ToastMessage[],
): string {
  const modalOpen =
    state.onboarding.active ||
    state.activePanel === "shop" ||
    state.activePanel === "map" ||
    state.activePanel === "focus" ||
    state.activePanel === "pause" ||
    state.activePanel === "settings";
  return `<a class="kh-skip-link" href="#kh-game-controls">Skip to game controls</a>
    <div class="kh-ui-chrome" id="kh-game-controls">
      <div class="kh-passive-chrome"${modalOpen ? ' aria-hidden="true" inert' : ""}>
        ${renderStatusBar(state)}
        ${renderLocationRail(state)}
        ${renderQuickActions(state)}
        ${renderInteractionPrompt(state)}
        ${renderInventory(state)}
        ${renderMobileControls(state)}
        ${renderMobileNav(state)}
      </div>
      ${renderShop(state)}
      ${renderMap(state)}
      ${renderFocus(state)}
      ${renderPause(state)}
      ${renderDialogue(state)}
      ${renderToasts(toasts)}
      ${renderOnboarding(state)}
    </div>`;
}
