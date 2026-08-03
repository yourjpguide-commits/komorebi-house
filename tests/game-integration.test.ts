import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_GAME_STATE_VERSION } from '../src/systems';
import {
  normalizeLoadedState,
  placementsFromState,
  RUNTIME_CATALOG,
  systemRuntime,
} from '../src/game/systemRuntime';
import type { GameState } from '../src/systems';
import { ITEM_CATALOG } from '../src/data';
import { isTabletopCatalogItem } from '../src/systems/tabletopSupport';
import { createDefaultWorldState } from '../src/game/storage';

describe('browser game authority integration', () => {
  beforeEach(() => {
    systemRuntime.reset();
  });

  it('boots through the current save schema with durable item identities', () => {
    const state = systemRuntime.getState();

    expect(state.meta.schemaVersion).toBe(CURRENT_GAME_STATE_VERSION);
    expect(state.meta.catalogVersion).toBe(RUNTIME_CATALOG.version);
    expect(state.economy.inventory.stacks).toEqual({});
    expect(Object.keys(state.economy.inventory.instances).length).toBeGreaterThan(0);
    expect(state.extensions.room).toMatchObject({
      schemaVersion: 1,
      worldId: 'room',
    });
    expect(state.extensions.garden).toMatchObject({
      schemaVersion: 1,
      worldId: 'garden',
    });
    expect(systemRuntime.getWorldState().placedDecor).toHaveLength(
      createDefaultWorldState().placedDecor.length,
    );
  });

  it('routes checkout and travel through the atomic command reducer', () => {
    const before = systemRuntime.getState();
    const priorRevision = before.meta.revision;
    const priorBalance = before.economy.wallet.balance;
    const definition = RUNTIME_CATALOG.getShopOffer('round-chabudai', before);

    expect(definition).toBeDefined();
    const purchased = systemRuntime.purchase('round-chabudai');
    expect(purchased.ok).toBe(true);
    expect(systemRuntime.getState().meta.revision).toBe(priorRevision + 1);
    expect(systemRuntime.getState().economy.wallet.balance).toBe(
      priorBalance - (definition?.offer.unitPrice ?? 0),
    );

    const travelled = systemRuntime.travel('cafe');
    expect(travelled.ok).toBe(true);
    expect(systemRuntime.getState().travel.currentLocationId).toBe('cafe');
  });

  it('commits ownership and per-location world snapshots together', () => {
    const placed = systemRuntime.commitPlacement({
      itemId: 'patchwork-zabuton',
      location: 'room',
      x: 240,
      y: 184,
      rotation: 0,
    });

    expect(placed.ok).toBe(true);
    expect(placed.placement).toBeDefined();
    const instanceId = placed.placement!.instanceId;
    expect(
      systemRuntime.getState().economy.inventory.instances[instanceId]
        ?.disposition,
    ).toEqual({
      kind: 'placed',
      placementId: instanceId,
      locationId: 'room',
    });
    expect(systemRuntime.getWorldState().placedDecor).toContainEqual(
      placed.placement,
    );

    const moved = systemRuntime.commitPlacement(
      {
        itemId: 'patchwork-zabuton',
        location: 'room',
        x: 264,
        y: 192,
        rotation: 90,
      },
      instanceId,
    );
    expect(moved.ok).toBe(true);
    expect(
      systemRuntime
        .getWorldState()
        .placedDecor.filter((item) => item.instanceId === instanceId),
    ).toEqual([moved.placement]);
  });

  it('persists tabletop authority and moves supported children with their table', () => {
    const initial = systemRuntime.getWorldState().placedDecor;
    expect(initial.find((item) => item.instanceId === 'starter-notebook')?.support).toEqual({
      parentInstanceId: 'starter-table',
      socket: 'notebook',
      offset: { x: -9, y: -21 },
    });

    const moved = systemRuntime.commitPlacement(
      {
        itemId: 'round-chabudai',
        location: 'room',
        x: 318,
        y: 206,
        rotation: 0,
      },
      'starter-table',
    );
    expect(moved.ok).toBe(true);
    expect(systemRuntime.getWorldState().placedDecor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: 'starter-notebook', x: 309, y: 185, rotation: 270 }),
        expect.objectContaining({ instanceId: 'starter-lamp', x: 321.5, y: 185.5 }),
      ]),
    );

    expect(systemRuntime.getState().extensions.room).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          instanceId: 'starter-notebook',
          support: expect.objectContaining({ parentInstanceId: 'starter-table' }),
        }),
      ]),
    });
  });

  it('rebinds tabletop children and stores a table without floating children', () => {
    const movedOff = systemRuntime.commitPlacement(
      {
        itemId: 'seigaiha-notebook',
        location: 'room',
        x: 180,
        y: 180,
        rotation: 0,
      },
      'starter-notebook',
    );
    expect(movedOff.ok).toBe(true);
    expect(movedOff.placement?.support).toBeUndefined();

    const movedBack = systemRuntime.commitPlacement(
      {
        itemId: 'seigaiha-notebook',
        location: 'room',
        x: 294,
        y: 169,
        rotation: 0,
      },
      'starter-notebook',
    );
    expect(movedBack.ok).toBe(true);
    expect(movedBack.placement?.support?.parentInstanceId).toBe('starter-table');

    const stored = systemRuntime.storePlacement('starter-table');
    expect(stored.ok).toBe(true);
    const remaining = systemRuntime.getWorldState().placedDecor;
    expect(remaining.some((item) => item.instanceId === 'starter-table')).toBe(false);
    expect(remaining.some((item) => item.support?.parentInstanceId === 'starter-table')).toBe(false);
    expect(systemRuntime.getState().economy.inventory.instances['starter-notebook']?.disposition).toEqual({ kind: 'stored' });
    expect(systemRuntime.getState().economy.inventory.instances['starter-lamp']?.disposition).toEqual({ kind: 'stored' });
  });

  it('preserves valid saved support authority and resolves duplicate sockets deterministically', () => {
    const source = structuredClone(systemRuntime.getState()) as GameState;
    const room = source.extensions.room as { items: Array<Record<string, unknown>> };
    const notebook = room.items.find((item) => item.instanceId === 'starter-notebook')!;
    notebook.position = { x: 999, y: 999 };
    notebook.support = {
      parentInstanceId: 'starter-table',
      socket: 'notebook',
      offset: { x: -7.25, y: -19.75 },
    };
    const duplicate = room.items.find((item) => item.instanceId === 'starter-lamp')!;
    duplicate.itemId = 'seigaiha-notebook';
    duplicate.support = {
      parentInstanceId: 'starter-table',
      socket: 'notebook',
      offset: { x: 4, y: -8 },
    };

    const normalized = normalizeLoadedState(source);
    const placements = placementsFromState(normalized);
    expect(placements.find((item) => item.instanceId === 'starter-notebook')).toMatchObject({
      x: 286.75,
      y: 170.25,
      support: {
        parentInstanceId: 'starter-table',
        socket: 'notebook',
        offset: { x: -7.25, y: -19.75 },
      },
    });
    expect(placements.find((item) => item.instanceId === 'starter-lamp')).toBeUndefined();
    expect(normalized.economy.inventory.instances['starter-lamp']?.disposition).toEqual({ kind: 'stored' });
  });

  it('migrates only the exact legacy starter shape and leaves near or ambiguous items unbound', () => {
    const source = structuredClone(systemRuntime.getState()) as GameState;
    delete source.extensions.tabletopSupportMigration;
    const room = source.extensions.room as { items: Array<Record<string, unknown>> };
    const notebook = room.items.find((item) => item.instanceId === 'starter-notebook')!;
    notebook.position = { x: 282, y: 178 };
    delete notebook.support;
    const lamp = room.items.find((item) => item.instanceId === 'starter-lamp')!;
    lamp.position = { x: 305, y: 178 };
    delete lamp.support;

    const placements = placementsFromState(normalizeLoadedState(source));
    expect(placements.find((item) => item.instanceId === 'starter-notebook')?.support).toMatchObject({
      parentInstanceId: 'starter-table', socket: 'notebook',
    });
    const nearLamp = placements.find((item) => item.instanceId === 'starter-lamp');
    expect(nearLamp).toMatchObject({ x: 305, y: 178 });
    expect(nearLamp?.support).toBeUndefined();
  });

  it('rejects an occupied authored socket and supports another catalog tabletop item', () => {
    expect(systemRuntime.purchase('seigaiha-notebook').ok).toBe(true);
    const occupied = systemRuntime.commitPlacement({
      itemId: 'seigaiha-notebook', location: 'room', x: 294, y: 169, rotation: 0,
    });
    expect(occupied).toMatchObject({ ok: false, code: 'TABLETOP_SOCKET_OCCUPIED' });

    expect(systemRuntime.purchase('tea-set').ok).toBe(true);
    const generic = systemRuntime.commitPlacement({
      itemId: 'tea-set', location: 'room', x: 294, y: 169, rotation: 0,
    });
    expect(generic).toMatchObject({
      ok: true,
      placement: {
        support: { parentInstanceId: 'starter-table', socket: 'tabletop-center' },
      },
    });
  });

  it('keeps every current data-catalog tabletop item in the canonical support registry', () => {
    const tabletopIds = ITEM_CATALOG
      .filter((item) => item.footprint.surface === 'tabletop')
      .map((item) => item.id);
    expect(tabletopIds.length).toBeGreaterThan(0);
    expect(tabletopIds.filter((itemId) => !isTabletopCatalogItem(itemId))).toEqual([]);
    expect(['tea-set', 'record-player', 'book-stack', 'ceramic-tea-set', 'retro-radio']
      .filter((itemId) => !isTabletopCatalogItem(itemId))).toEqual([]);
    const tray = systemRuntime.commitPlacement({
      itemId: 'steam-tea-tray', location: 'room', x: 294, y: 169, rotation: 0,
    });
    expect(tray).toMatchObject({
      ok: true,
      placement: { support: { parentInstanceId: 'starter-table' } },
    });
  });
});
