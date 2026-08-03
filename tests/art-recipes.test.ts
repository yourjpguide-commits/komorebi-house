import { describe, expect, it } from "vitest";
import { ITEM_CATALOG } from "../src/data/catalog";
import {
  AVATAR_FRAME_COUNTS,
  EXTERNAL_FURNITURE_IDS,
  FURNITURE_ANIMATION_MANIFEST,
  FURNITURE_IDS,
  FURNITURE_SPECS,
  MATERIAL_KINDS,
  PALETTE,
  PROCEDURAL_FURNITURE_IDS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  avatarTextureKey,
  catalogFurnitureTextureKey,
  createAvatarSprite,
  createEffectLayer,
  createEnvironment,
  createFurnitureSprite,
  createMaterialTile,
  drawPixelArt,
  environmentTextureKey,
  furnitureTextureKey,
  pixelArtSignature,
  registerPixelArtTextures,
  type CanvasLike,
  type FurnitureId,
  type PixelArt,
} from "../src/art";

function expectValidArt(art: PixelArt, requireContained = false): void {
  expect(Number.isInteger(art.width)).toBe(true);
  expect(Number.isInteger(art.height)).toBe(true);
  expect(art.width).toBeGreaterThan(0);
  expect(art.height).toBeGreaterThan(0);
  expect(art.commands.length).toBeGreaterThan(0);
  for (const command of art.commands) {
    const label = `${art.metadata.id ?? "pixel-art"} command ${JSON.stringify(command)}`;
    expect(Number.isInteger(command.x)).toBe(true);
    expect(Number.isInteger(command.y)).toBe(true);
    expect(Number.isInteger(command.width)).toBe(true);
    expect(Number.isInteger(command.height)).toBe(true);
    expect(command.width).toBeGreaterThan(0);
    expect(command.height).toBeGreaterThan(0);
    expect(command.alpha).toBeGreaterThan(0);
    expect(command.alpha).toBeLessThanOrEqual(1);
    if (typeof command.color !== "string") throw new Error(label);
    expect(command.color, label).toMatch(/^#[0-9a-f]{6}$/i);
    if (requireContained) {
      expect(command.x, label).toBeGreaterThanOrEqual(0);
      expect(command.y, label).toBeGreaterThanOrEqual(0);
      expect(command.x + command.width, label).toBeLessThanOrEqual(art.width);
      expect(command.y + command.height, label).toBeLessThanOrEqual(art.height);
    }
  }
}

describe("deterministic code-native pixel recipes", () => {
  it("renders each authored location at the 480x270 virtual resolution", () => {
    const locations = ["room", "garden", "cafe", "park", "shop", "street"] as const;
    for (const location of locations) {
      const art = createEnvironment(location, { seed: "golden-master" });
      expect(art.width).toBe(VIRTUAL_WIDTH);
      expect(art.height).toBe(VIRTUAL_HEIGHT);
      expect(art.commands.length).toBeGreaterThan(100);
      expect(art.metadata.tags).toContain(location);
      expectValidArt(art);
    }
  });

  it("is reproducible for the same seed and varied for a different seed", () => {
    const first = createEnvironment("garden", { seed: "same" });
    const again = createEnvironment("garden", { seed: "same" });
    const different = createEnvironment("garden", { seed: "different" });
    expect(pixelArtSignature(first)).toBe(pixelArtSignature(again));
    expect(pixelArtSignature(first)).not.toBe(pixelArtSignature(different));
  });

  it("keeps the master palette chromatic with no pure black or white", () => {
    const colors = Object.values(PALETTE);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors).not.toContain("#000000");
    expect(colors).not.toContain("#FFFFFF");
    colors.forEach((color) => expect(color).toMatch(/^#[0-9A-F]{6}$/));
  });
});

describe("material tiles", () => {
  it("provides deterministic material recipes for every material family", () => {
    for (const material of MATERIAL_KINDS) {
      const art = createMaterialTile(material, "material-test");
      expectValidArt(art, true);
      expect(pixelArtSignature(art)).toBe(
        pixelArtSignature(createMaterialTile(material, "material-test")),
      );
    }
  });

  it("authors tatami as canonical 64x32 modules", () => {
    const tatami = createMaterialTile("tatami", 1);
    expect([tatami.width, tatami.height]).toEqual([64, 32]);
    expect(tatami.metadata.tags).toContain("tileable");
  });
});

describe("avatar animation frames", () => {
  it("covers every direction and idle, walk, study, and carry action", () => {
    const directions = ["north", "east", "south", "west"] as const;
    const actions = ["idle", "walk", "study", "carry"] as const;
    const signatures = new Set<string>();
    let celTotal = 0;
    for (const direction of directions) {
      for (const action of actions) {
        const celCommands = new Set<string>();
        for (let frame = 0; frame < AVATAR_FRAME_COUNTS[action]; frame += 1) {
          const art = createAvatarSprite(direction, action, frame);
          expect([art.width, art.height]).toEqual([36, 48]);
          expect(art.metadata.anchor).toEqual({ x: 18, y: 45 });
          expect(art.metadata.id).toBe(
            `avatar:indigo:${direction}:${action}:${frame}`,
          );
          expect(art.metadata.tags).toContain("native-36x48");
          expectValidArt(art, true);
          signatures.add(pixelArtSignature(art));
          celCommands.add(JSON.stringify(art.commands));
          celTotal += 1;
        }
        expect(
          celCommands.size,
          `${direction}/${action} must use distinct authored cels`,
        ).toBe(AVATAR_FRAME_COUNTS[action]);
      }
    }
    // Mirrored facings and restrained idle cels may share some geometry, but
    // the complete directional/action sheet must remain richly differentiated.
    expect(celTotal).toBe(44);
    expect(signatures.size).toBeGreaterThanOrEqual(28);
  });

  it("normalizes screen-language and cardinal direction texture keys", () => {
    expect(avatarTextureKey("down", "walk", 2)).toBe(
      avatarTextureKey("south", "walk", 2),
    );
    expect(avatarTextureKey("left", "idle", 0, "moss")).toContain("moss-west");
  });
});

describe("catalog furniture render closure", () => {
  it("has an individually keyed art recipe for all 60 catalog items", () => {
    const catalogIds = ITEM_CATALOG.map((item) => item.id).sort();
    expect([...FURNITURE_IDS].sort()).toEqual(catalogIds);
    expect(FURNITURE_IDS).toHaveLength(60);
    expect(EXTERNAL_FURNITURE_IDS).toHaveLength(5);
    expect(PROCEDURAL_FURNITURE_IDS).toHaveLength(55);
    expect(new Set([...EXTERNAL_FURNITURE_IDS, ...PROCEDURAL_FURNITURE_IDS])).toEqual(
      new Set(FURNITURE_IDS),
    );

    for (const externalId of EXTERNAL_FURNITURE_IDS) {
      expect(() => createFurnitureSprite(externalId)).toThrow(/external furniture asset/);
    }

    const signatures = new Set<string>();
    for (const item of ITEM_CATALOG) {
      if ((EXTERNAL_FURNITURE_IDS as readonly string[]).includes(item.id)) continue;
      const art = createFurnitureSprite(item.id, {
        palette: item.visual.palette,
        seed: "catalog-proof",
      });
      expectValidArt(art, true);
      expect(art.metadata.tags).toContain(item.category);
      expect(art.metadata.anchor?.x).toBeGreaterThan(0);
      expect(art.metadata.anchor?.y).toBeGreaterThan(0);
      expect(FURNITURE_SPECS[item.id as FurnitureId].width).toBe(art.width);
      expect(catalogFurnitureTextureKey(item.id)).toBe(item.visual.textureKey);
      expect(furnitureTextureKey(item.id)).toBe(`koh:decor:${item.id}`);
      signatures.add(pixelArtSignature(art));
    }
    expect(signatures.size).toBe(PROCEDURAL_FURNITURE_IDS.length);
  });

  it("declares an explicit valid static fallback for every catalog animation", () => {
    for (const item of ITEM_CATALOG) {
      const animation = item.visual.animation;
      if (!animation) continue;
      const recipe = FURNITURE_ANIMATION_MANIFEST[animation];
      expect(recipe, `${item.id} references ${animation}`).toBeDefined();
      expect(recipe?.staticFallback).toBe(true);
      expect(recipe?.frameCount).toBeGreaterThan(1);
      expect(recipe?.framesPerSecond).toBeGreaterThan(0);
    }
  });
});

describe("weather, particles, and lighting masks", () => {
  it("animates deterministic rain, petals, fireflies, steam, and leaves", () => {
    const effects = ["rain", "petals", "fireflies", "steam", "leaves"] as const;
    for (const effect of effects) {
      const first = createEffectLayer(effect, { seed: "weather", frame: 0 });
      const same = createEffectLayer(effect, { seed: "weather", frame: 0 });
      const next = createEffectLayer(effect, { seed: "weather", frame: 1 });
      expectValidArt(first);
      expect(pixelArtSignature(first)).toBe(pixelArtSignature(same));
      expect(pixelArtSignature(first)).not.toBe(pixelArtSignature(next));
    }
  });

  it("provides geometric window, night, focus, and vignette masks", () => {
    for (const effect of ["window-light", "night-mask", "focus-mask", "vignette"] as const) {
      const art = createEffectLayer(effect);
      expectValidArt(art);
      expect(art.metadata.renderBand).toBe("atmosphere");
    }
  });
});

describe("renderer-neutral texture registration", () => {
  it("draws integer-scaled rectangles without smoothing", () => {
    const calls: Array<readonly [number, number, number, number]> = [];
    const context: CanvasLike = {
      fillStyle: "#000000",
      globalAlpha: 1,
      imageSmoothingEnabled: true,
      fillRect: (x, y, width, height) => calls.push([x, y, width, height]),
    };
    const art = createAvatarSprite("down");
    drawPixelArt(context, art, 10, 20, 3);
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(calls).toHaveLength(art.commands.length);
    calls.flat().forEach((value) => expect(Number.isInteger(value)).toBe(true));
  });

  it("registers environments, avatar cels, and canonical catalog keys synchronously", () => {
    const textureKeys = new Set<string>();
    const drawCounts = new Map<string, number>();
    const textureSizes = new Map<string, readonly [number, number]>();
    const manager = {
      exists: (key: string) => textureKeys.has(key),
      createCanvas: (key: string, width: number, height: number) => {
        textureKeys.add(key);
        textureSizes.set(key, [width, height]);
        const context: CanvasLike = {
          fillStyle: "#000000",
          globalAlpha: 1,
          fillRect: () => drawCounts.set(key, (drawCounts.get(key) ?? 0) + 1),
        };
        return { getContext: () => context, refresh: () => undefined };
      },
    };
    const result = registerPixelArtTextures(
      { textures: manager },
      {
        locations: ["room"],
        itemIds: ["hinoki-writing-desk", "indigo-tansu"],
        avatarActions: ["idle"],
      },
    );
    expect(result.created).toBe(11); // 1 environment + 4x2 avatar cels + 2 items
    expect(textureKeys).toContain(environmentTextureKey("room"));
    expect(textureKeys).toContain("koh:decor:hinoki-writing-desk");
    expect(textureKeys).toContain(avatarTextureKey("south", "idle", 0));
    expect(textureSizes.get(avatarTextureKey("south", "idle", 0))).toEqual([
      36,
      48,
    ]);
    result.keys.forEach((key) => expect(drawCounts.get(key)).toBeGreaterThan(0));
  });
});
