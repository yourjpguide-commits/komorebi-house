import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_GAME_STATE_VERSION } from '../src/systems';
import {
  RUNTIME_CATALOG,
  systemRuntime,
} from '../src/game/systemRuntime';
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
});
