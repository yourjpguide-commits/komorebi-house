import { describe, expect, it } from "vitest";
import {
  RenderBand,
  createEmptyWorldState,
  findPath,
  getCellInfo,
  getFootprintCells,
  getRenderDepth,
  getZoneAt,
  gridToScreen,
  isValidProjectionConfig,
  isCellWalkable,
  moveItem,
  parseWorldSave,
  placeItem,
  rotateItem,
  screenToGrid,
  screenToNearestGrid,
  serializeWorldState,
  sortRenderables,
  validateItemRegistry,
  validatePlacement,
  validateWorldDefinition,
  type ItemRegistry,
  type PlacedItem,
  type WorldDefinition,
} from "../src/core";

const world: WorldDefinition = {
  schemaVersion: 1,
  id: "komorebi-home",
  zones: [
    {
      id: "room",
      kind: "room",
      shape: { type: "rect", x: 0, y: 0, width: 5, height: 4 },
      surface: "tatami",
    },
    {
      id: "engawa",
      kind: "engawa",
      shape: { type: "rect", x: 0, y: 4, width: 5, height: 1 },
      surface: "wood",
    },
    {
      id: "garden",
      kind: "garden",
      shape: { type: "rect", x: 0, y: 5, width: 5, height: 3 },
      surface: "soil",
    },
  ],
  blockedCells: [{ x: 4, y: 0 }],
  reservedCells: [{ x: 2, y: 4 }],
  cellOverrides: [
    { position: { x: 1, y: 5 }, surface: "stone", placeable: false },
  ],
};

const registry: ItemRegistry = {
  desk: {
    id: "desk",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    allowedZoneKinds: ["room"],
    allowedSurfaces: ["tatami"],
    placementLayer: "object",
    renderBand: RenderBand.OBJECTS,
  },
  rug: {
    id: "rug",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    allowedZoneKinds: ["room"],
    placementLayer: "floor",
    blocksMovement: false,
  },
  lantern: {
    id: "lantern",
    footprint: [{ x: 0, y: 0 }],
    allowedZoneKinds: ["garden"],
    allowedSurfaces: ["soil"],
    rotatable: false,
  },
};

const desk: PlacedItem = {
  instanceId: "desk-1",
  itemId: "desk",
  position: { x: 1, y: 1 },
  rotation: 0,
};

describe("projection", () => {
  it("round-trips dimetric grid positions at elevation", () => {
    const projection = {
      tileWidth: 48,
      tileHeight: 24,
      originX: 320,
      originY: 80,
      elevationHeight: 20,
    };
    const screen = gridToScreen({ x: 3, y: -2 }, projection, 2);
    expect(screen).toEqual({ x: 440, y: 52 });
    expect(screenToGrid(screen, projection, 2)).toEqual({ x: 3, y: -2 });
    expect(
      screenToNearestGrid({ x: screen.x + 3, y: screen.y + 2 }, projection, 2),
    ).toEqual({ x: 3, y: -2 });
    expect(
      isValidProjectionConfig({ ...projection, tileWidth: 0 }),
    ).toBe(false);
    expect(() =>
      screenToGrid(screen, { ...projection, tileHeight: 0 }),
    ).toThrow(RangeError);
  });
});

describe("zones and definition validation", () => {
  it("resolves cells, surfaces, reserved thresholds, and deterministic priority", () => {
    expect(getZoneAt(world, { x: 2, y: 4 })?.id).toBe("engawa");
    expect(getCellInfo(world, { x: 2, y: 4 })).toMatchObject({
      walkable: true,
      placeable: false,
      surface: "wood",
    });
    expect(getCellInfo(world, { x: 1, y: 5 })).toMatchObject({
      walkable: true,
      placeable: false,
      surface: "stone",
    });

    const overlapWorld: WorldDefinition = {
      schemaVersion: 1,
      id: "overlap",
      zones: [
        {
          id: "low",
          kind: "base",
          priority: 0,
          shape: { type: "rect", x: 0, y: 0, width: 2, height: 2 },
        },
        {
          id: "high",
          kind: "detail",
          priority: 5,
          shape: { type: "cells", cells: [{ x: 0, y: 0 }] },
        },
      ],
    };
    expect(getZoneAt(overlapWorld, { x: 0, y: 0 })?.id).toBe("high");
    expect(validateWorldDefinition(world)).toEqual([]);
    expect(validateItemRegistry(registry)).toEqual([]);

    const unsafeWorld: WorldDefinition = {
      schemaVersion: 1,
      id: "unsafe",
      zones: [
        {
          id: "impossible",
          kind: "room",
          shape: {
            type: "rect",
            x: Number.MAX_SAFE_INTEGER,
            y: 0,
            width: 3,
            height: 1,
          },
        },
      ],
    };
    expect(validateWorldDefinition(unsafeWorld)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "zones[0].shape" }),
      ]),
    );
  });
});

describe("footprints and placement transactions", () => {
  it("rotates a multi-cell footprint around its contact anchor", () => {
    expect(
      getFootprintCells(registry.desk!, { x: 2, y: 2 }, 90),
    ).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ]);
  });

  it("rejects zone, surface, boundary, and same-layer conflicts", () => {
    const state = {
      ...createEmptyWorldState(world.id),
      items: [desk],
    };
    expect(
      validatePlacement(world, state, registry, {
        ...desk,
        instanceId: "desk-2",
        position: { x: 2, y: 1 },
      }).issues.map((issue) => issue.code),
    ).toContain("FOOTPRINT_CONFLICT");

    expect(
      validatePlacement(world, state, registry, {
        ...desk,
        instanceId: "desk-3",
        position: { x: 0, y: 4 },
      }).issues.map((issue) => issue.code),
    ).toContain("ZONE_NOT_ALLOWED");

    expect(
      validatePlacement(world, state, registry, {
        instanceId: "lantern-1",
        itemId: "lantern",
        position: { x: 1, y: 5 },
        rotation: 0,
      }).issues.map((issue) => issue.code),
    ).toEqual(expect.arrayContaining(["CELL_NOT_PLACEABLE", "SURFACE_NOT_ALLOWED"]));
  });

  it("allows different placement layers and applies immutable move/rotate operations", () => {
    expect(() => createEmptyWorldState("")).toThrow(TypeError);
    const mutablePreview = {
      ...desk,
      position: { x: desk.position.x, y: desk.position.y },
      state: { mood: "calm" },
    };
    const withDesk = placeItem(
      world,
      createEmptyWorldState(world.id),
      registry,
      mutablePreview,
    );
    expect(withDesk.ok).toBe(true);
    mutablePreview.position.x = 4;
    mutablePreview.state.mood = "changed";
    expect(withDesk.state.items[0]).toMatchObject({
      position: { x: 1, y: 1 },
      state: { mood: "calm" },
    });
    expect(Object.isFrozen(withDesk.state.items[0]?.position)).toBe(true);

    const withRug = placeItem(world, withDesk.state, registry, {
      instanceId: "rug-1",
      itemId: "rug",
      position: { x: 1, y: 1 },
      rotation: 0,
    });
    expect(withRug.ok).toBe(true);

    const moved = moveItem(
      world,
      withRug.state,
      registry,
      "desk-1",
      { x: 2, y: 2 },
    );
    expect(moved.ok).toBe(true);
    expect(withRug.state.items.find((item) => item.instanceId === "desk-1")?.position)
      .toEqual({ x: 1, y: 1 });
    expect(moved.state.revision).toBe(3);

    const rotated = rotateItem(
      world,
      moved.state,
      registry,
      "desk-1",
      90,
    );
    expect(rotated.ok).toBe(true);
    expect(rotated.state.items.find((item) => item.instanceId === "desk-1")?.rotation)
      .toBe(90);

    const overflow = placeItem(
      world,
      {
        ...createEmptyWorldState(world.id),
        revision: Number.MAX_SAFE_INTEGER,
      },
      registry,
      desk,
    );
    expect(overflow).toMatchObject({
      ok: false,
      issues: [{ code: "REVISION_OVERFLOW" }],
    });

    const unsavable = placeItem(
      world,
      createEmptyWorldState(world.id),
      registry,
      {
        ...desk,
        instanceId: "bad-state",
        state: { value: Number.NaN },
      },
    );
    expect(unsavable).toMatchObject({
      ok: false,
      issues: [{ code: "INVALID_ITEM_STATE" }],
    });

    const sparseValues = new Array<never>(1);
    const sparse = placeItem(
      world,
      createEmptyWorldState(world.id),
      registry,
      {
        ...desk,
        instanceId: "sparse-state",
        state: { values: sparseValues },
      },
    );
    expect(sparse).toMatchObject({
      ok: false,
      issues: [{ code: "INVALID_ITEM_STATE" }],
    });

    const oversizedIdentity = placeItem(
      world,
      createEmptyWorldState(world.id),
      registry,
      {
        ...desk,
        instanceId: "x".repeat(129),
        variant: "v".repeat(129),
      },
    );
    expect(oversizedIdentity.ok).toBe(false);
    expect(oversizedIdentity.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["INVALID_INSTANCE", "INVALID_ITEM_STATE"]),
    );
  });
});

describe("collision and deterministic navigation", () => {
  it("treats solid item collision as unwalkable but ignores rugs", () => {
    const state = {
      ...createEmptyWorldState(world.id),
      items: [
        desk,
        {
          instanceId: "rug-1",
          itemId: "rug",
          position: { x: 0, y: 2 },
          rotation: 0 as const,
        },
      ],
    };
    expect(isCellWalkable(world, state, registry, { x: 1, y: 1 })).toBe(false);
    expect(isCellWalkable(world, state, registry, { x: 0, y: 2 })).toBe(true);
    expect(
      findPath(world, state, registry, { x: 1, y: 1 }, { x: 1, y: 1 }),
    ).toBeNull();
    expect(
      findPath(
        world,
        state,
        registry,
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { allowGoalOccupied: true },
      ),
    ).toEqual([{ x: 1, y: 1 }]);
    expect(
      isCellWalkable(
        world,
        { ...state, worldId: "other-world" },
        registry,
        { x: 0, y: 2 },
      ),
    ).toBe(false);
    expect(
      isCellWalkable(
        world,
        state,
        registry,
        { x: 0.5, y: 2 } as { x: number; y: number },
      ),
    ).toBe(false);
  });

  it("finds the same shortest path around collisions", () => {
    const state = {
      ...createEmptyWorldState(world.id),
      items: [desk],
    };
    const path = findPath(
      world,
      state,
      registry,
      { x: 0, y: 1 },
      { x: 3, y: 1 },
    );
    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
    ]);
    expect(
      findPath(
        world,
        createEmptyWorldState(world.id),
        registry,
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { maxVisited: 1 },
      ),
    ).toBeNull();
  });
});

describe("render ordering", () => {
  it("uses fixed bands before deterministic isometric depth", () => {
    expect(getRenderDepth({ x: 2, y: 3 })).toBe(5);
    const sorted = sortRenderables([
      {
        id: "front",
        band: RenderBand.OBJECTS,
        position: { x: 3, y: 3 },
      },
      {
        id: "character",
        band: RenderBand.CHARACTERS,
        position: { x: 0, y: 0 },
      },
      {
        id: "rug",
        band: RenderBand.GROUND_DECOR,
        position: { x: 9, y: 9 },
      },
      {
        id: "canopy",
        band: RenderBand.FOREGROUND,
        position: { x: -9, y: -9 },
      },
      {
        id: "back",
        band: RenderBand.OBJECTS,
        position: { x: 1, y: 1 },
      },
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual([
      "rug",
      "character",
      "back",
      "front",
      "canopy",
    ]);
  });
});

describe("save schema", () => {
  it("serializes canonically and round-trips validated state", () => {
    const state = {
      schemaVersion: 1 as const,
      worldId: world.id,
      revision: 7,
      items: [
        {
          ...desk,
          state: { z: 1, nested: { b: true, a: "first" } },
        },
      ],
    };
    const serialized = serializeWorldState(state);
    expect(serialized.indexOf('"a":"first"')).toBeLessThan(
      serialized.indexOf('"b":true'),
    );
    const parsed = parseWorldSave(serialized, { world, registry });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(state);
  });

  it("fails closed on malformed, duplicate, unknown, and polluted saves", () => {
    expect(parseWorldSave("{")).toMatchObject({
      ok: false,
      errors: [{ code: "INVALID_JSON" }],
    });
    expect(
      parseWorldSave(
        {
          schemaVersion: 1,
          worldId: world.id,
          revision: 0,
          items: [desk],
        },
        { maxItems: Number.NaN },
      ),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ path: "$options.maxItems" }),
      ]),
    });
    expect(
      parseWorldSave(
        JSON.stringify({
          schemaVersion: 1,
          worldId: world.id,
          revision: 0,
          items: [],
        }),
        { maxInputCharacters: 10 },
      ),
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
      ]),
    });

    const invalid = parseWorldSave(
      JSON.stringify({
        schemaVersion: 1,
        worldId: world.id,
        revision: 0,
        items: [
          {
            instanceId: "same",
            itemId: "missing",
            position: { x: 0.25, y: 1 },
            rotation: 45,
            state: JSON.parse('{"__proto__":{"polluted":true}}'),
          },
          {
            instanceId: "same",
            itemId: "desk",
            position: { x: 1, y: 1 },
            rotation: 0,
          },
        ],
      }),
      { registry },
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.map((error) => error.code)).toEqual(
        expect.arrayContaining([
          "UNKNOWN_ITEM",
          "INVALID_VALUE",
          "DUPLICATE_INSTANCE",
        ]),
      );
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();

    const inheritedId = parseWorldSave(
      JSON.stringify({
        schemaVersion: 1,
        worldId: world.id,
        revision: 0,
        items: [
          {
            instanceId: "prototype-item",
            itemId: "__proto__",
            position: { x: 1, y: 1 },
            rotation: 0,
          },
        ],
      }),
      { world, registry },
    );
    expect(inheritedId).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_ITEM" }),
      ]),
    });
  });
});
