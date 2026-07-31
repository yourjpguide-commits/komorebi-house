import { describe, expect, it } from "vitest";
import {
  ECONOMY_CONFIG,
  CATALOG_VERSION,
  ITEM_BY_ID,
  ITEM_CATALOG,
  ITEM_CATEGORIES,
  LOCATION_CATALOG,
  LOCATION_IDS,
  STARTER_ITEM_IDS,
  estimateStudyReward,
  getAffordableItems,
  getItemsForLocation,
  getUnlockedItems,
  grantsEarnedThroughMinutes,
  isItemUnlocked,
  levelFromStudyMinutes,
  levelGrantsBetween,
  makeUnlockContext,
  placementMountFits,
  resaleValue,
  totalCatalogCost,
  unlockRequirementMet,
} from "../src/data";

const japaneseText = /[\u3040-\u30ff\u3400-\u9fff]/u;
const hexColor = /^#[0-9a-f]{6}$/iu;

describe("item catalog content", () => {
  it("offers ten authored items in every requested category", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(45);

    for (const category of ITEM_CATEGORIES) {
      expect(
        ITEM_CATALOG.filter((item) => item.category === category),
        category,
      ).toHaveLength(10);
    }
  });

  it("keeps identifiers and renderer texture keys unique", () => {
    const ids = ITEM_CATALOG.map((item) => item.id);
    const textureKeys = ITEM_CATALOG.map((item) => item.visual.textureKey);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(textureKeys).size).toBe(textureKeys.length);
    expect(Object.keys(ITEM_BY_ID)).toHaveLength(ITEM_CATALOG.length);
    expect(CATALOG_VERSION).toMatch(/^komorebi-catalog-v\d+$/u);
    expect(STARTER_ITEM_IDS).toEqual([
      "patchwork-zabuton",
      "folded-futon",
      "seigaiha-notebook",
      "milk-glass-desk-lamp",
      "steam-tea-tray",
    ]);
  });

  it("ships bilingual copy, placement truth, visual recipes, and interactions for every item", () => {
    for (const item of ITEM_CATALOG) {
      expect(item.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
      expect(item.name.ja).toMatch(japaneseText);
      expect(item.name.en.trim().length).toBeGreaterThan(2);
      expect(item.description.ja).toMatch(japaneseText);
      expect(item.description.en.trim().length).toBeGreaterThan(20);

      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(item.footprint.width)).toBe(true);
      expect(Number.isInteger(item.footprint.height)).toBe(true);
      expect(item.footprint.width).toBeGreaterThan(0);
      expect(item.footprint.height).toBeGreaterThan(0);
      expect(item.footprint.mount).toBeDefined();
      expect(item.locations.length).toBeGreaterThan(0);
      expect(item.locations.every((id) => LOCATION_IDS.includes(id))).toBe(true);

      expect(item.visual.textureKey).toBe(item.id);
      expect(item.visual.materials.length).toBeGreaterThan(0);
      expect(item.visual.layers.length).toBeGreaterThanOrEqual(4);
      expect(item.visual.anchor.x).toBeGreaterThanOrEqual(0);
      expect(item.visual.anchor.x).toBeLessThanOrEqual(1);
      expect(item.visual.anchor.y).toBeGreaterThanOrEqual(0);
      expect(item.visual.anchor.y).toBeLessThanOrEqual(1);
      expect(Object.values(item.visual.palette).every((color) => hexColor.test(color))).toBe(
        true,
      );

      expect(item.interactions.length).toBeGreaterThan(0);
      expect(item.interactions.every((action) => japaneseText.test(action.label.ja))).toBe(
        true,
      );
      expect(item.tags.length).toBeGreaterThanOrEqual(4);
      expect(item.coziness).toBeGreaterThanOrEqual(0);
      expect(item.focus).toBeGreaterThanOrEqual(0);
    }
  });

  it("covers both customizable spaces and every placement surface", () => {
    expect(getItemsForLocation("home-room").length).toBeGreaterThan(30);
    expect(getItemsForLocation("home-garden").length).toBeGreaterThanOrEqual(10);

    const surfaces = new Set(ITEM_CATALOG.map((item) => item.footprint.surface));
    expect(surfaces).toEqual(
      new Set([
        "floor",
        "wall",
        "tabletop",
        "ceiling",
        "outdoor-ground",
        "water-edge",
      ]),
    );
  });

  it("distinguishes support, attachment, outdoor, and water-edge mounts", () => {
    const notebook = ITEM_BY_ID["seigaiha-notebook"]!;
    const print = ITEM_BY_ID["rainy-town-print"]!;
    const pendant = ITEM_BY_ID["pleated-washi-pendant"]!;
    const path = ITEM_BY_ID["river-stone-path"]!;
    const pond = ITEM_BY_ID["rain-fed-lily-pond"]!;

    expect(
      placementMountFits(notebook.footprint.mount, {
        plane: "support",
        socket: "tabletop",
      }),
    ).toBe(true);
    expect(
      placementMountFits(notebook.footprint.mount, {
        plane: "floor",
        surface: "tatami",
      }),
    ).toBe(false);
    expect(
      placementMountFits(print.footprint.mount, {
        plane: "wall",
        socket: "wall",
      }),
    ).toBe(true);
    expect(
      placementMountFits(pendant.footprint.mount, {
        plane: "ceiling",
        socket: "ceiling",
      }),
    ).toBe(true);
    expect(
      placementMountFits(path.footprint.mount, {
        plane: "outdoor",
        surface: "soil",
      }),
    ).toBe(true);
    expect(
      placementMountFits(pond.footprint.mount, {
        plane: "outdoor",
        surface: "stone",
      }),
    ).toBe(false);
    expect(
      placementMountFits(pond.footprint.mount, {
        plane: "outdoor",
        surface: "stone",
        adjacentSurfaces: ["water"],
      }),
    ).toBe(true);
  });
});

describe("world location catalog", () => {
  it("defines the room, garden, cafe, park, and shopping street exactly once", () => {
    expect(LOCATION_CATALOG.map((location) => location.id)).toEqual(LOCATION_IDS);

    for (const location of LOCATION_CATALOG) {
      expect(location.name.ja).toMatch(japaneseText);
      expect(location.name.en.length).toBeGreaterThan(3);
      expect(location.description.ja).toMatch(japaneseText);
      expect(location.description.en.length).toBeGreaterThan(25);
      expect(location.activities.length).toBeGreaterThanOrEqual(3);
      expect(location.study.focusMood).toBeGreaterThanOrEqual(1);
      expect(location.study.focusMood).toBeLessThanOrEqual(5);
    }
  });

  it("keeps only the player's home spaces customizable", () => {
    const customizable = LOCATION_CATALOG.filter(
      (location) => location.supportsDecoration,
    ).map((location) => location.id);
    expect(customizable).toEqual(["home-room", "home-garden"]);
  });
});

describe("study economy and progression", () => {
  it("pays equal base Hikari for equal active time, however sessions are split", () => {
    const uninterrupted = estimateStudyReward({ activeMinutes: 25 });
    const split =
      estimateStudyReward({ activeMinutes: 10 }).base +
      estimateStudyReward({ activeMinutes: 15 }).base;

    expect(uninterrupted.base).toBe(250);
    expect(split).toBe(uninterrupted.base);
    expect(estimateStudyReward({ activeMinutes: -10 }).total).toBe(0);
    expect(estimateStudyReward({ activeMinutes: Number.NaN }).total).toBe(0);
  });

  it("awards one forgiving, capped daily rhythm bonus only after ten minutes", () => {
    expect(
      estimateStudyReward({
        activeMinutes: 9,
        awardDailyRhythmBonus: true,
        qualifyingDaysInPreviousSix: 5,
      }).dailyRhythm,
    ).toBe(0);
    expect(
      estimateStudyReward({
        activeMinutes: 10,
        awardDailyRhythmBonus: true,
        qualifyingDaysInPreviousSix: 0,
      }).dailyRhythm,
    ).toBe(50);
    expect(
      estimateStudyReward({
        activeMinutes: 25,
        awardDailyRhythmBonus: true,
        qualifyingDaysInPreviousSix: 99,
      }).dailyRhythm,
    ).toBe(100);

    const tenSingleMinuteSettlements = Array.from({ length: 10 }, (_, index) =>
      estimateStudyReward({
        activeMinutes: 1,
        dailyActiveMinutesBefore: index,
        awardDailyRhythmBonus: true,
        qualifyingDaysInPreviousSix: 2,
      }),
    );
    expect(
      tenSingleMinuteSettlements.reduce(
        (sum, settlement) => sum + settlement.dailyRhythm,
        0,
      ),
    ).toBe(70);
    expect(
      estimateStudyReward({
        activeMinutes: 1,
        dailyActiveMinutesBefore: 9,
        dailyRhythmAlreadyAwarded: true,
        awardDailyRhythmBonus: true,
        qualifyingDaysInPreviousSix: 2,
      }).dailyRhythm,
    ).toBe(0);
  });

  it("changes levels at exact, documented focus thresholds", () => {
    expect(levelFromStudyMinutes(0)).toBe(1);
    expect(levelFromStudyMinutes(44)).toBe(1);
    expect(levelFromStudyMinutes(45)).toBe(2);
    expect(levelFromStudyMinutes(119)).toBe(2);
    expect(levelFromStudyMinutes(120)).toBe(3);
    expect(levelFromStudyMinutes(900)).toBe(7);
    expect(grantsEarnedThroughMinutes(900)).toBe(1_350);
    expect(levelGrantsBetween(44, 45)).toBe(100);
    expect(levelGrantsBetween(45, 120)).toBe(150);
    expect(levelGrantsBetween(119, 241)).toBe(350);
    expect(levelGrantsBetween(240, 240)).toBe(0);
  });

  it("makes the full catalog affordable in fifteen focus hours without rhythm bonuses", () => {
    const minutes = 15 * 60;
    const guaranteedResources =
      ECONOMY_CONFIG.startingBalance +
      estimateStudyReward({ activeMinutes: minutes }).base +
      grantsEarnedThroughMinutes(minutes);
    const prices = ITEM_CATALOG.map((item) => item.price).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)]!;
    const maximum = Math.max(...prices);

    expect(totalCatalogCost()).toBeLessThanOrEqual(guaranteedResources);
    expect(median).toBeLessThanOrEqual(
      estimateStudyReward({ activeMinutes: 25 }).base,
    );
    expect(maximum).toBeLessThan(
      estimateStudyReward({ activeMinutes: 50 }).base,
    );
  });

  it("has a valid five-day endgame schedule that satisfies every unlock", () => {
    const scheduleContext = makeUnlockContext(15 * 60, 5, {
      "kissaten-cafe": 5,
      "riverside-park": 1,
    });
    expect(getUnlockedItems(scheduleContext)).toHaveLength(ITEM_CATALOG.length);
  });

  it("offers a useful start and unlocks the garden at the first milestone", () => {
    const starterContext = makeUnlockContext();
    const starters = getUnlockedItems(starterContext);
    const affordableStarters = getAffordableItems(
      ECONOMY_CONFIG.startingBalance,
      starters,
    );

    expect(starters.length).toBeGreaterThanOrEqual(8);
    expect(
      affordableStarters.some((item) => item.interactions.some((a) => a.mode === "study")),
    ).toBe(true);
    expect(
      affordableStarters.some((item) => item.interactions.some((a) => a.mode === "sit")),
    ).toBe(true);

    const gardenLocation = LOCATION_CATALOG.find(
      (location) => location.id === "home-garden",
    )!;
    expect(unlockRequirementMet(gardenLocation.unlock, makeUnlockContext(44))).toBe(
      false,
    );
    expect(unlockRequirementMet(gardenLocation.unlock, makeUnlockContext(45))).toBe(
      true,
    );
    expect(
      getUnlockedItems(makeUnlockContext(45)).filter((item) =>
        item.locations.includes("home-garden"),
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("supports exact focus, rhythm, and location-session unlocks", () => {
    const desk = ITEM_BY_ID["hinoki-writing-desk"]!;
    const rainLight = ITEM_BY_ID["rain-chain-light"]!;
    const radio = ITEM_BY_ID["walnut-focus-radio"]!;

    expect(isItemUnlocked(desk, makeUnlockContext(44))).toBe(false);
    expect(isItemUnlocked(desk, makeUnlockContext(45))).toBe(true);
    expect(isItemUnlocked(rainLight, makeUnlockContext(900, 2))).toBe(false);
    expect(isItemUnlocked(rainLight, makeUnlockContext(900, 3))).toBe(true);
    expect(
      isItemUnlocked(
        radio,
        makeUnlockContext(900, 5, { "kissaten-cafe": 2 }),
      ),
    ).toBe(false);
    expect(
      isItemUnlocked(
        radio,
        makeUnlockContext(900, 5, { "kissaten-cafe": 3 }),
      ),
    ).toBe(true);

    const endgame = makeUnlockContext(900, 6, {
      "kissaten-cafe": 8,
      "riverside-park": 8,
    });
    expect(getUnlockedItems(endgame)).toHaveLength(ITEM_CATALOG.length);
  });

  it("cannot create resale profit or affordability from invalid balances", () => {
    for (const item of ITEM_CATALOG) {
      expect(resaleValue(item.price)).toBeLessThanOrEqual(item.price);
    }
    expect(getAffordableItems(Number.NaN).every((item) => item.price === 0)).toBe(
      true,
    );
  });
});
