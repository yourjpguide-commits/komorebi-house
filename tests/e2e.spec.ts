import { expect, test, type Locator, type Page } from "@playwright/test";

type LocationId = "room" | "garden" | "cafe" | "park";
type FocusStatus = "idle" | "running" | "paused" | "complete";

type QaState = {
  ready: boolean;
  world: {
    location: LocationId;
    phase?: string;
  };
  player: {
    tileX: number;
    tileY: number;
    screenX: number;
    screenY: number;
    depth: number;
    moving: boolean;
    occludedBy: string[];
  };
  economy: {
    coins: number;
  };
  inventory: Record<string, number>;
  placements: Array<{
    id: string;
    sku: string;
    zone: string;
    tileX: number;
    tileY: number;
    rotation: number;
    depth: number;
    footprint: Array<{ x: number; y: number }>;
  }>;
  focus: {
    status: FocusStatus;
    remainingMs: number;
    completedSessions: number;
    pendingReward: number;
  };
  audio: {
    contextState: "suspended" | "running" | "closed" | "unavailable";
    muted: boolean;
    masterGain: number;
    unlockedByGesture: boolean;
  };
  persistence: {
    schemaVersion: number;
    lastSavedAt: number | null;
    pending: boolean;
    lastError: string | null;
  };
  render: {
    fps: number;
    frameTimeP95Ms: number;
    smoothing: boolean;
    contextLost: boolean;
  };
};

type QaCommand =
  | "reset"
  | "grantCoins"
  | "setPlayerTile"
  | "advanceClock"
  | "samplePerformance"
  | "setVisualPreset";

type QaQuery =
  | "placementTargets"
  | "placementHitPoint"
  | "occlusionWaypoints"
  | "navigationAnchors"
  | "saveStorageKey";

type KomorebiQaBridge = {
  state(): QaState;
  command(name: QaCommand, payload?: unknown): unknown | Promise<unknown>;
  query(name: QaQuery, payload?: unknown): unknown | Promise<unknown>;
};

declare global {
  interface Window {
    __KOMOREBI_QA__?: KomorebiQaBridge;
  }
}

type RuntimeIssues = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  badResponses: string[];
};

type CatalogItem = {
  card: Locator;
  sku: string;
  price: number;
  rotatable: boolean;
};

type PlacementTarget = {
  screenX: number;
  screenY: number;
  tileX: number;
  tileY: number;
  zone: string;
  valid: boolean;
  reason?: "occupied" | "out-of-bounds" | "wrong-zone" | "blocks-route" | string;
};

type ViewportPoint = {
  screenX: number;
  screenY: number;
};

type OcclusionWaypoint = {
  objectId: string;
  behind: {
    location: LocationId;
    tileX: number;
    tileY: number;
  };
  front: {
    location: LocationId;
    tileX: number;
    tileY: number;
  };
};

const APP_URL =
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.E2E_BASE_URL ?? "http://127.0.0.1:4188/";
const runtimeIssues = new WeakMap<Page, RuntimeIssues>();

test.beforeEach(async ({ page }) => {
  const issues: RuntimeIssues = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    badResponses: [],
  };

  runtimeIssues.set(page, issues);

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    issues.pageErrors.push(error.stack ?? error.message);
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    // Navigation can legitimately abort an obsolete document request during reload.
    if (!failure.includes("ERR_ABORTED")) {
      issues.requestFailures.push(`${request.method()} ${request.url()}: ${failure}`);
    }
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      issues.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const issues = runtimeIssues.get(page);
  if (!issues) return;

  const total =
    issues.consoleErrors.length +
    issues.pageErrors.length +
    issues.requestFailures.length +
    issues.badResponses.length;

  if (total > 0) {
    await testInfo.attach("runtime-issues.json", {
      body: JSON.stringify(issues, null, 2),
      contentType: "application/json",
    });
  }

  expect(issues, "The candidate emitted browser, network, or page errors.").toEqual({
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    badResponses: [],
  });
});

async function requireQaBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__KOMOREBI_QA__?.state === "function" &&
      typeof window.__KOMOREBI_QA__?.command === "function" &&
      typeof window.__KOMOREBI_QA__?.query === "function",
    undefined,
    { timeout: 15_000 },
  );
}

async function qaState(page: Page): Promise<QaState> {
  return page.evaluate(() => {
    if (!window.__KOMOREBI_QA__) {
      throw new Error("Missing window.__KOMOREBI_QA__ test bridge.");
    }
    return window.__KOMOREBI_QA__.state();
  });
}

async function qaCommand<T = unknown>(
  page: Page,
  name: QaCommand,
  payload?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ commandName, commandPayload }) => {
      if (!window.__KOMOREBI_QA__) {
        throw new Error("Missing window.__KOMOREBI_QA__ test bridge.");
      }
      return window.__KOMOREBI_QA__.command(commandName, commandPayload);
    },
    { commandName: name, commandPayload: payload },
  ) as Promise<T>;
}

async function qaQuery<T = unknown>(
  page: Page,
  name: QaQuery,
  payload?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ queryName, queryPayload }) => {
      if (!window.__KOMOREBI_QA__) {
        throw new Error("Missing window.__KOMOREBI_QA__ test bridge.");
      }
      return window.__KOMOREBI_QA__.query(queryName, queryPayload);
    },
    { queryName: name, queryPayload: payload },
  ) as Promise<T>;
}

async function gotoShell(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("game-root")).toBeVisible();
  await requireQaBridge(page);
}

async function enterGame(page: Page): Promise<void> {
  const start = page.getByTestId("start-game");
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  }

  await expect(page.getByTestId("game-canvas")).toBeVisible();
  await expect
    .poll(async () => (await qaState(page)).ready, {
      message: "The visible game never became controllable.",
      timeout: 15_000,
    })
    .toBe(true);
}

async function openFreshGame(page: Page): Promise<void> {
  await gotoShell(page);
  await enterGame(page);
  await qaCommand(page, "reset");
  await expect
    .poll(async () => (await qaState(page)).ready, { timeout: 10_000 })
    .toBe(true);
}

async function openCustomizer(page: Page): Promise<void> {
  const panel = page.getByTestId("catalog-panel");
  if (!(await panel.isVisible().catch(() => false))) {
    await page.locator('[data-action="customizer-open"]:visible').click();
  }
  await expect(panel).toBeVisible();
}

async function catalogItems(page: Page): Promise<CatalogItem[]> {
  await openCustomizer(page);
  const cards = page.locator('[data-testid^="catalog-item-"]');
  const count = await cards.count();
  expect(count, "The catalog must contain at least one purchasable item.").toBeGreaterThan(0);

  const items: CatalogItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const sku = await card.getAttribute("data-sku");
    const rawPrice = await card.getAttribute("data-price");
    const rawRotatable = await card.getAttribute("data-rotatable");

    expect(sku, `Catalog card ${index} has no data-sku.`).toBeTruthy();
    expect(rawPrice, `Catalog card ${index} has no data-price.`).toMatch(/^\d+$/);

    const price = Number(rawPrice);
    expect(Number.isSafeInteger(price) && price >= 0).toBe(true);
    items.push({
      card,
      sku: sku!,
      price,
      rotatable: rawRotatable === "true",
    });
  }
  return items;
}

async function buyOne(page: Page, item: CatalogItem): Promise<void> {
  const before = await qaState(page);
  const priorCount = before.inventory[item.sku] ?? 0;

  await item.card.getByTestId(`buy-${item.sku}`).click();
  await expect
    .poll(async () => (await qaState(page)).inventory[item.sku] ?? 0)
    .toBe(priorCount + 1);
  await expect.poll(async () => (await qaState(page)).economy.coins).toBe(
    before.economy.coins - item.price,
  );
}

async function beginPlacement(page: Page, sku: string): Promise<void> {
  await openCustomizer(page);
  await page.getByTestId(`inventory-item-${sku}`).click();
  await expect(page.getByTestId("placement-preview")).toBeVisible();
}

async function clickViewportPoint(
  page: Page,
  point: ViewportPoint,
  touch = false,
): Promise<void> {
  if (touch) {
    await page.touchscreen.tap(point.screenX, point.screenY);
  } else {
    await page.mouse.click(point.screenX, point.screenY);
  }
}

async function placementTargets(page: Page, sku: string, zone = "room") {
  const targets = await qaQuery<PlacementTarget[]>(page, "placementTargets", { sku, zone });
  expect(Array.isArray(targets), "placementTargets must return an array.").toBe(true);
  expect(targets.length, `No placement targets were exposed for ${sku}.`).toBeGreaterThan(0);
  return targets;
}

async function placeOwnedItem(
  page: Page,
  sku: string,
  options: { touch?: boolean; doubleConfirm?: boolean } = {},
) {
  const before = await qaState(page);
  await beginPlacement(page, sku);

  const targets = await placementTargets(page, sku);
  const target = targets.find((candidate) => candidate.valid);
  expect(target, `No valid room placement target exists for ${sku}.`).toBeTruthy();

  await clickViewportPoint(page, target!, options.touch);
  await expect(page.getByTestId("placement-preview")).toHaveAttribute("data-valid", "true");

  const confirm = page.getByTestId("placement-confirm");
  if (options.doubleConfirm) {
    await confirm.evaluate((element) => {
      (element as HTMLElement).click();
      (element as HTMLElement).click();
    });
  } else {
    await confirm.click();
  }

  await expect
    .poll(async () => (await qaState(page)).placements.length)
    .toBe(before.placements.length + 1);

  const after = await qaState(page);
  const oldIds = new Set(before.placements.map((placement) => placement.id));
  const placed = after.placements.find((placement) => !oldIds.has(placement.id));
  expect(placed, "The committed placement did not appear in world state.").toBeTruthy();
  return placed!;
}

async function travelTo(page: Page, location: LocationId): Promise<void> {
  if ((await qaState(page)).world.location === location) return;

  await page.getByTestId("travel-button").click();
  await expect(page.getByTestId("travel-sheet")).toBeVisible();
  await page.getByTestId(`travel-${location}`).click();

  await expect
    .poll(async () => (await qaState(page)).world.location, {
      message: `Travel never reached ${location}.`,
      timeout: 10_000,
    })
    .toBe(location);
  const visibleLocationNames: Record<LocationId, RegExp> = {
    room: /room|house|部屋|家|間/i,
    garden: /garden|庭/i,
    cafe: /café|cafe|kissaten|喫茶/i,
    park: /park|公園/i,
  };
  await expect(page.getByTestId("location-label")).toContainText(
    visibleLocationNames[location],
  );
}

async function waitForSave(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const persistence = (await qaState(page)).persistence;
        return {
          pending: persistence.pending,
          hasTimestamp: persistence.lastSavedAt !== null,
          lastError: persistence.lastError,
        };
      },
      { message: "Autosave did not settle to a valid transaction.", timeout: 10_000 },
    )
    .toEqual({ pending: false, hasTimestamp: true, lastError: null });
}

function normalizedPlacements(state: QaState) {
  return state.placements
    .map((placement) => ({
      ...placement,
      footprint: [...placement.footprint].sort((a, b) => a.y - b.y || a.x - b.x),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

test("cold boot reaches a visible, controllable world with crisp rendering", async ({ page }) => {
  await openFreshGame(page);

  const canvas = page.getByTestId("game-canvas");
  const box = await canvas.boundingBox();
  expect(box, "The canvas has no rendered box.").not.toBeNull();
  expect(box!.width).toBeGreaterThan(640);
  expect(box!.height).toBeGreaterThan(360);

  const state = await qaState(page);
  expect(state.render.smoothing, "Pixel-art smoothing must remain disabled.").toBe(false);
  expect(state.render.contextLost).toBe(false);
  expect(["room", "garden", "cafe", "park"]).toContain(state.world.location);
  await expect(page.getByTestId("hud-coins")).toContainText(String(state.economy.coins));
});

test("keyboard movement responds, stops, and never scrolls the page", async ({ page }) => {
  await openFreshGame(page);
  const initial = await qaState(page);
  const initialScrollY = await page.evaluate(() => window.scrollY);
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"] as const;

  let moved = false;
  for (const key of keys) {
    const before = await qaState(page);
    await page.keyboard.down(key);
    await page.waitForTimeout(300);
    await page.keyboard.up(key);
    const after = await qaState(page);
    if (after.player.screenX !== before.player.screenX || after.player.screenY !== before.player.screenY) {
      moved = true;
      break;
    }
  }

  expect(moved, "No arrow-key direction moved the player from a fresh spawn.").toBe(true);
  await expect.poll(async () => (await qaState(page)).player.moving).toBe(false);

  const stopped = await qaState(page);
  await page.waitForTimeout(250);
  const stillStopped = await qaState(page);
  expect(stillStopped.player.screenX).toBe(stopped.player.screenX);
  expect(stillStopped.player.screenY).toBe(stopped.player.screenY);
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollY);
  expect(`${stillStopped.player.screenX}:${stillStopped.player.screenY}`).not.toBe(
    `${initial.player.screenX}:${initial.player.screenY}`,
  );
});

test("the complete room, garden, cafe, park, room circuit stays playable", async ({ page }) => {
  await openFreshGame(page);

  for (const location of ["garden", "cafe", "park", "room"] as const) {
    await travelTo(page, location);
    await expect(page.getByTestId("game-canvas")).toBeVisible();
    expect((await qaState(page)).player.moving).toBe(false);
    await page.waitForTimeout(850);
    expect(
      (await qaState(page)).world.location,
      `${location} arrival overlapped a return portal and bounced away.`,
    ).toBe(location);
  }
});

test("a rapid double purchase is one atomic economy transaction", async ({ page }) => {
  await openFreshGame(page);
  await qaCommand(page, "grantCoins", { amount: 10_000 });
  const item = (await catalogItems(page))[0]!;
  const before = await qaState(page);
  const priorCount = before.inventory[item.sku] ?? 0;
  const buy = item.card.getByTestId(`buy-${item.sku}`);

  await buy.evaluate((element) => {
    (element as HTMLElement).click();
    (element as HTMLElement).click();
  });

  await expect
    .poll(async () => (await qaState(page)).inventory[item.sku] ?? 0)
    .toBe(priorCount + 1);
  const after = await qaState(page);
  expect(after.economy.coins).toBe(before.economy.coins - item.price);
  await expect(page.getByTestId("hud-coins")).toContainText(String(after.economy.coins));
});

test("insufficient funds reject the purchase with zero state mutation", async ({ page }) => {
  await openFreshGame(page);
  const before = await qaState(page);
  const items = await catalogItems(page);
  const unaffordable = items.find((item) => item.price > before.economy.coins);

  expect(
    unaffordable,
    "The release catalog needs at least one item above the fresh-save balance to exercise insufficient funds.",
  ).toBeTruthy();

  const priorCount = before.inventory[unaffordable!.sku] ?? 0;
  await unaffordable!.card.getByTestId(`buy-${unaffordable!.sku}`).click();
  await expect(page.getByTestId("toast-region")).toContainText(
    /not enough|insufficient|足り|不足/i,
  );
  const after = await qaState(page);
  expect(after.economy.coins).toBe(before.economy.coins);
  expect(after.inventory[unaffordable!.sku] ?? 0).toBe(priorCount);
});

test("invalid placement is blocked and rapid valid confirm creates one object", async ({ page }) => {
  await openFreshGame(page);
  await qaCommand(page, "grantCoins", { amount: 10_000 });
  const item = (await catalogItems(page))[0]!;
  await buyOne(page, item);
  const afterPurchase = await qaState(page);

  await beginPlacement(page, item.sku);
  const targets = await placementTargets(page, item.sku);
  const invalid = targets.find(
    (candidate) =>
      !candidate.valid &&
      ["occupied", "out-of-bounds", "wrong-zone", "blocks-route"].includes(
        candidate.reason ?? "",
      ),
  );
  expect(invalid, `No meaningful invalid target was exposed for ${item.sku}.`).toBeTruthy();

  await clickViewportPoint(page, invalid!);
  await expect(page.getByTestId("placement-preview")).toHaveAttribute("data-valid", "false");
  await expect(page.getByTestId("placement-error")).toBeVisible();
  await expect(page.getByTestId("placement-confirm")).toBeDisabled();
  expect((await qaState(page)).placements).toEqual(afterPurchase.placements);
  await page.getByTestId("placement-cancel").click();

  const placed = await placeOwnedItem(page, item.sku, { doubleConfirm: true });
  const afterPlacement = await qaState(page);
  expect(afterPlacement.economy.coins).toBe(afterPurchase.economy.coins);
  expect(afterPlacement.placements.filter((entry) => entry.id === placed.id)).toHaveLength(1);

  const allCells = afterPlacement.placements.flatMap((entry) =>
    entry.footprint.map((cell) => `${entry.zone}:${cell.x}:${cell.y}`),
  );
  expect(new Set(allCells).size, "Two committed footprints overlap.").toBe(allCells.length);
});

test("moving then cancelling is lossless; moving then confirming is free", async ({ page }) => {
  await openFreshGame(page);
  await qaCommand(page, "grantCoins", { amount: 10_000 });
  const item = (await catalogItems(page))[0]!;
  await buyOne(page, item);
  const placed = await placeOwnedItem(page, item.sku);
  await waitForSave(page);

  const beforeMove = await qaState(page);
  await openCustomizer(page);
  const hitPoint = await qaQuery<ViewportPoint>(page, "placementHitPoint", { id: placed.id });
  await clickViewportPoint(page, hitPoint);
  await expect(page.getByTestId("selected-object-panel")).toBeVisible();
  await page.getByTestId("move-selected").click();

  const targets = await placementTargets(page, item.sku, placed.zone);
  const alternate = targets.find(
    (target) =>
      target.valid && (target.tileX !== placed.tileX || target.tileY !== placed.tileY),
  );
  expect(alternate, "No alternate valid target exists for the move transaction.").toBeTruthy();
  await clickViewportPoint(page, alternate!);
  await page.getByTestId("placement-cancel").click();

  const afterCancel = await qaState(page);
  expect(normalizedPlacements(afterCancel)).toEqual(normalizedPlacements(beforeMove));
  expect(afterCancel.economy.coins).toBe(beforeMove.economy.coins);

  const hitPointAgain = await qaQuery<ViewportPoint>(page, "placementHitPoint", {
    id: placed.id,
  });
  await clickViewportPoint(page, hitPointAgain);
  await page.getByTestId("move-selected").click();
  await clickViewportPoint(page, alternate!);
  await page.getByTestId("placement-confirm").click();

  const afterConfirm = await qaState(page);
  expect(afterConfirm.placements).toHaveLength(beforeMove.placements.length);
  expect(afterConfirm.economy.coins).toBe(beforeMove.economy.coins);
  expect(afterConfirm.placements.find((entry) => entry.id === placed.id)).toMatchObject({
    tileX: alternate!.tileX,
    tileY: alternate!.tileY,
  });
});

test("depth ordering flips correctly behind and in front of a tall object", async ({ page }) => {
  await openFreshGame(page);
  await qaCommand(page, "setVisualPreset", {
    preset: "room-occlusion",
    frozen: true,
  });
  const waypoints = await qaQuery<OcclusionWaypoint[]>(page, "occlusionWaypoints", {
    location: "room",
  });
  expect(waypoints.length, "No tall-object occlusion fixture exists.").toBeGreaterThan(0);
  const waypoint = waypoints[0]!;

  await qaCommand(page, "setPlayerTile", waypoint.behind);
  await expect
    .poll(async () => (await qaState(page)).player.occludedBy)
    .toContain(waypoint.objectId);
  await expect(page.getByTestId("game-canvas")).toHaveScreenshot("room-occlusion-behind.png");

  await qaCommand(page, "setPlayerTile", waypoint.front);
  await expect
    .poll(async () => (await qaState(page)).player.occludedBy)
    .not.toContain(waypoint.objectId);
  await expect(page.getByTestId("game-canvas")).toHaveScreenshot("room-occlusion-front.png");
});

test("furnished state, inventory, and economy survive a real reload", async ({ page }) => {
  await openFreshGame(page);
  await qaCommand(page, "grantCoins", { amount: 10_000 });
  const item = (await catalogItems(page))[0]!;
  await buyOne(page, item);
  await placeOwnedItem(page, item.sku);
  await travelTo(page, "garden");
  await waitForSave(page);

  const beforeReload = await qaState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await requireQaBridge(page);
  await enterGame(page);
  const afterReload = await qaState(page);

  expect(afterReload.economy).toEqual(beforeReload.economy);
  expect(afterReload.inventory).toEqual(beforeReload.inventory);
  expect(normalizedPlacements(afterReload)).toEqual(normalizedPlacements(beforeReload));
  expect(afterReload.persistence.schemaVersion).toBe(beforeReload.persistence.schemaVersion);
  expect(afterReload.persistence.lastError).toBeNull();
});

test("corrupt save data produces a recoverable fresh game, not a blank screen", async ({ page }) => {
  await openFreshGame(page);
  await waitForSave(page);
  const storageKey = await qaQuery<string>(page, "saveStorageKey");
  expect(storageKey, "The QA bridge did not identify its persisted save key.").toBeTruthy();

  await page.evaluate(
    ({ key }) => localStorage.setItem(key, '{"schemaVersion":999999,"placements":['),
    { key: storageKey },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await requireQaBridge(page);
  await enterGame(page);

  await expect(page.getByTestId("save-recovery-notice")).toBeVisible();
  expect((await qaState(page)).ready).toBe(true);
  await expect(page.getByTestId("game-canvas")).toBeVisible();
});

test("focus pause/resume/completion grants exactly one reward across reload", async ({ page }) => {
  await openFreshGame(page);
  await travelTo(page, "cafe");
  const before = await qaState(page);

  await page.getByTestId("focus-button").click();
  await expect(page.getByTestId("focus-panel")).toBeVisible();
  await page.getByTestId("focus-start").click();
  await expect.poll(async () => (await qaState(page)).focus.status).toBe("running");

  await page.getByTestId("focus-pause").click();
  await expect.poll(async () => (await qaState(page)).focus.status).toBe("paused");
  const pausedRemaining = (await qaState(page)).focus.remainingMs;
  await qaCommand(page, "advanceClock", { milliseconds: 2_000 });
  expect((await qaState(page)).focus.remainingMs).toBe(pausedRemaining);

  await page.getByTestId("focus-resume").click();
  const running = await qaState(page);
  expect(running.focus.status).toBe("running");
  expect(running.focus.pendingReward).toBeGreaterThan(0);
  await qaCommand(page, "advanceClock", {
    milliseconds: running.focus.remainingMs + 1_000,
  });
  await expect.poll(async () => (await qaState(page)).focus.status).toBe("complete");

  const completed = await qaState(page);
  expect(completed.economy.coins).toBe(before.economy.coins + running.focus.pendingReward);
  expect(completed.focus.completedSessions).toBe(before.focus.completedSessions + 1);
  await page.getByTestId("focus-complete").evaluate((element) => {
    (element as HTMLElement).click();
    (element as HTMLElement).click();
  });
  await waitForSave(page);

  const rewardedCoins = (await qaState(page)).economy.coins;
  await page.reload({ waitUntil: "domcontentloaded" });
  await requireQaBridge(page);
  await enterGame(page);
  expect((await qaState(page)).economy.coins).toBe(rewardedCoins);
});

test("audio waits for a gesture, mute is effective, and mute persists", async ({ page }) => {
  await gotoShell(page);
  const beforeGesture = await qaState(page);
  expect(beforeGesture.audio.unlockedByGesture).toBe(false);
  expect(["suspended", "unavailable"]).toContain(beforeGesture.audio.contextState);

  await page.getByTestId("start-game").click();
  await expect.poll(async () => (await qaState(page)).ready).toBe(true);
  await expect
    .poll(async () => (await qaState(page)).audio.unlockedByGesture)
    .toBe(true);
  const unlocked = await qaState(page);
  if (unlocked.audio.contextState !== "unavailable") {
    expect(unlocked.audio.contextState).toBe("running");
  }

  const mute = page.getByTestId("mute-button");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await qaState(page)).audio.masterGain).toBe(0);
  expect((await qaState(page)).audio.muted).toBe(true);
  await waitForSave(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await requireQaBridge(page);
  await enterGame(page);
  await expect(page.getByTestId("mute-button")).toHaveAttribute("aria-pressed", "true");
  expect((await qaState(page)).audio.masterGain).toBe(0);
});

test("desktop render-loop smoke budget has no smoothing or context loss", async ({ page }) => {
  await openFreshGame(page);
  await qaCommand(page, "samplePerformance", { durationMs: 3_000 });
  const render = (await qaState(page)).render;

  expect(render.smoothing).toBe(false);
  expect(render.contextLost).toBe(false);
  expect(render.fps, "Three-second desktop smoke FPS fell below the release floor.").toBeGreaterThanOrEqual(
    55,
  );
  expect(render.frameTimeP95Ms).toBeLessThanOrEqual(33);
});

test.describe("390x844 mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test("has no overflow, clipped controls, or undersized visible touch targets", async ({
    page,
  }) => {
    await openFreshGame(page);

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.innerHeight + 1);

    await expect(page.getByTestId("mobile-dpad")).toBeVisible();
    const controls = page.locator('button:visible, [role="button"]:visible');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      const box = await control.boundingBox();
      expect(box, `Visible control ${index} has no box.`).not.toBeNull();
      expect(box!.width, `Visible control ${index} is narrower than 44px.`).toBeGreaterThanOrEqual(
        44,
      );
      expect(
        box!.height,
        `Visible control ${index} is shorter than 44px.`,
      ).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
  });

  test("touch D-pad moves once and stops on release", async ({ page }) => {
    await openFreshGame(page);
    const directions = ["right", "down", "left", "up"] as const;
    let moved = false;

    for (const direction of directions) {
      const before = await qaState(page);
      const control = page.getByTestId(`dpad-${direction}`);
      await control.dispatchEvent("pointerdown", {
        bubbles: true,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
      });
      await page.waitForTimeout(300);
      await control.dispatchEvent("pointerup", {
        bubbles: true,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
      });
      const after = await qaState(page);
      if (
        after.player.screenX !== before.player.screenX ||
        after.player.screenY !== before.player.screenY
      ) {
        moved = true;
        break;
      }
    }

    expect(moved, "No touch direction moved the player.").toBe(true);
    await expect.poll(async () => (await qaState(page)).player.moving).toBe(false);
    const stopped = await qaState(page);
    await page.waitForTimeout(250);
    const stable = await qaState(page);
    expect(stable.player.screenX).toBe(stopped.player.screenX);
    expect(stable.player.screenY).toBe(stopped.player.screenY);
  });

  test("touch can buy, place, save, and reload without losing the object", async ({ page }) => {
    await openFreshGame(page);
    await qaCommand(page, "grantCoins", { amount: 10_000 });
    const item = (await catalogItems(page))[0]!;
    await buyOne(page, item);
    const placed = await placeOwnedItem(page, item.sku, { touch: true });
    await waitForSave(page);
    const coins = (await qaState(page)).economy.coins;

    await page.reload({ waitUntil: "domcontentloaded" });
    await requireQaBridge(page);
    await enterGame(page);
    const restored = await qaState(page);
    expect(restored.economy.coins).toBe(coins);
    expect(restored.placements.find((entry) => entry.id === placed.id)).toEqual(placed);
  });

  test("room and customization visual baselines remain authored at mobile size", async ({
    page,
  }) => {
    await openFreshGame(page);
    await qaCommand(page, "setVisualPreset", {
      preset: "room-default",
      frozen: true,
    });
    await expect(page).toHaveScreenshot("mobile-room-default.png", {
      fullPage: true,
    });

    await openCustomizer(page);
    const panel = await page.getByTestId("catalog-panel").boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.y).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(844);
    await expect(page).toHaveScreenshot("mobile-customization.png", {
      fullPage: true,
    });
  });
});
