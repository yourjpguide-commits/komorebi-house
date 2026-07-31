import {
  getItemDefinition,
  getFootprintCells,
  intersectCells,
} from "./footprints";
import {
  compareGridPoints,
  compareStableStrings,
  gridCellKey,
  isRotation,
  normalizeRotation,
} from "./projection";
import { getCellInfo } from "./zones";
import type {
  ItemDefinition,
  ItemRegistry,
  PlacedItem,
  PlacementIssue,
  PlacementOptions,
  PlacementValidation,
  Rotation,
  WorldDefinition,
  WorldMutationResult,
  WorldState,
} from "./types";
import { freezeWorldState } from "./immutability";
import {
  WORLD_CORE_LIMITS,
  isBoundedId,
  isPersistableGridPoint,
} from "./limits";

function issueSortKey(issue: PlacementIssue): string {
  const cell = issue.cell ? gridCellKey(issue.cell) : "";
  return `${issue.code}|${cell}|${issue.conflictingInstanceId ?? ""}|${issue.message}`;
}

function finishValidation(
  issues: PlacementIssue[],
  cells: readonly { readonly x: number; readonly y: number }[],
): PlacementValidation {
  const uniqueIssues = new Map<string, PlacementIssue>();
  for (const issue of issues) {
    uniqueIssues.set(issueSortKey(issue), issue);
  }
  return {
    ok: uniqueIssues.size === 0,
    issues: [...uniqueIssues.values()].sort((a, b) =>
      compareStableStrings(issueSortKey(a), issueSortKey(b)),
    ),
    cells: [...cells].sort(compareGridPoints),
  };
}

function allowedByZone(
  definition: ItemDefinition,
  zoneId: string,
  zoneKind: string,
): boolean {
  const idAllowed =
    definition.allowedZoneIds === undefined ||
    definition.allowedZoneIds.includes(zoneId);
  const kindAllowed =
    definition.allowedZoneKinds === undefined ||
    definition.allowedZoneKinds.includes(zoneKind);
  return idAllowed && kindAllowed;
}

function layersConflict(
  candidate: ItemDefinition,
  existing: ItemDefinition,
): boolean {
  if (
    candidate.blocksPlacement === false ||
    existing.blocksPlacement === false
  ) {
    return false;
  }
  return (
    (candidate.placementLayer ?? "object") ===
    (existing.placementLayer ?? "object")
  );
}

export function validatePlacement(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  candidate: PlacedItem,
  options: PlacementOptions = {},
): PlacementValidation {
  const issues: PlacementIssue[] = [];

  if (state.worldId !== world.id) {
    issues.push({
      code: "WORLD_MISMATCH",
      message: `State world "${state.worldId}" does not match "${world.id}".`,
    });
  }
  if (
    !isBoundedId(candidate.instanceId)
  ) {
    issues.push({
      code: "INVALID_INSTANCE",
      message: `Item instance id must be a non-empty string up to ${WORLD_CORE_LIMITS.maxIdLength} characters.`,
    });
  }
  if (!isPersistableGridPoint(candidate.position)) {
    issues.push({
      code: "INVALID_POSITION",
      message: `Item position must contain integer coordinates within ±${WORLD_CORE_LIMITS.maxCoordinateMagnitude}.`,
    });
  }
  if (!isRotation(candidate.rotation)) {
    issues.push({
      code: "INVALID_ROTATION",
      message: "Item rotation must be 0, 90, 180, or 270 degrees.",
    });
  }
  if (
    candidate.variant !== undefined &&
    (typeof candidate.variant !== "string" ||
      candidate.variant.length > WORLD_CORE_LIMITS.maxVariantLength)
  ) {
    issues.push({
      code: "INVALID_ITEM_STATE",
      message: `Item variant must be at most ${WORLD_CORE_LIMITS.maxVariantLength} characters.`,
    });
  }

  const definition = getItemDefinition(registry, candidate.itemId);
  if (!definition) {
    issues.push({
      code: "UNKNOWN_ITEM",
      message: `Unknown item definition "${candidate.itemId}".`,
    });
  }

  const duplicate = state.items.find(
    (item) =>
      item.instanceId === candidate.instanceId &&
      item.instanceId !== options.ignoreInstanceId,
  );
  if (duplicate) {
    issues.push({
      code: "DUPLICATE_INSTANCE",
      message: `Instance id "${candidate.instanceId}" is already placed.`,
      conflictingInstanceId: duplicate.instanceId,
    });
  }

  if (definition?.unique) {
    const existingUnique = state.items.find(
      (item) =>
        item.itemId === candidate.itemId &&
        item.instanceId !== options.ignoreInstanceId,
    );
    if (existingUnique) {
      issues.push({
        code: "UNIQUE_ITEM",
        message: `Only one "${candidate.itemId}" may be placed.`,
        conflictingInstanceId: existingUnique.instanceId,
      });
    }
  }

  if (
    definition &&
    definition.rotatable === false &&
    candidate.rotation !== 0
  ) {
    issues.push({
      code: "ROTATION_NOT_ALLOWED",
      message: `Item "${candidate.itemId}" cannot be rotated.`,
    });
  }

  if (
    !definition ||
    !isPersistableGridPoint(candidate.position) ||
    !isRotation(candidate.rotation)
  ) {
    return finishValidation(issues, []);
  }

  const cells = getFootprintCells(
    definition,
    candidate.position,
    candidate.rotation,
  );
  for (const cell of cells) {
    const info = getCellInfo(world, cell);
    if (info.zone === null) {
      issues.push({
        code: "OUTSIDE_WORLD",
        message: `Cell ${gridCellKey(cell)} is outside the world.`,
        cell,
      });
      continue;
    }
    if (!info.placeable) {
      issues.push({
        code: "CELL_NOT_PLACEABLE",
        message: `Cell ${gridCellKey(cell)} does not allow placement.`,
        cell,
      });
    }
    if (!allowedByZone(definition, info.zone.id, info.zone.kind)) {
      issues.push({
        code: "ZONE_NOT_ALLOWED",
        message: `Item "${candidate.itemId}" is not allowed in zone "${info.zone.id}".`,
        cell,
      });
    }
    if (
      definition.allowedSurfaces !== undefined &&
      (info.surface === null ||
        !definition.allowedSurfaces.includes(info.surface))
    ) {
      issues.push({
        code: "SURFACE_NOT_ALLOWED",
        message: `Surface "${info.surface ?? "none"}" is not allowed for "${candidate.itemId}".`,
        cell,
      });
    }
  }

  for (const existing of state.items) {
    if (existing.instanceId === options.ignoreInstanceId) {
      continue;
    }
    const existingDefinition = getItemDefinition(registry, existing.itemId);
    if (!existingDefinition) {
      issues.push({
        code: "UNKNOWN_EXISTING_ITEM",
        message: `Placed instance "${existing.instanceId}" uses unknown item "${existing.itemId}".`,
        conflictingInstanceId: existing.instanceId,
      });
      continue;
    }
    if (!layersConflict(definition, existingDefinition)) {
      continue;
    }
    const overlap = intersectCells(
      cells,
      getFootprintCells(
        existingDefinition,
        existing.position,
        existing.rotation,
      ),
    );
    for (const cell of overlap) {
      issues.push({
        code: "FOOTPRINT_CONFLICT",
        message: `Cell ${gridCellKey(cell)} is occupied by "${existing.instanceId}".`,
        cell,
        conflictingInstanceId: existing.instanceId,
      });
    }
  }

  return finishValidation(issues, cells);
}

function nextState(
  state: WorldState,
  items: readonly PlacedItem[],
): WorldState {
  return freezeWorldState(state.worldId, state.revision + 1, items);
}

function failure(
  state: WorldState,
  issues: readonly PlacementIssue[],
): WorldMutationResult {
  return { ok: false, state, issues };
}

function commit(
  state: WorldState,
  items: readonly PlacedItem[],
): WorldMutationResult {
  try {
    return { ok: true, state: nextState(state, items), issues: [] };
  } catch (error) {
    return failure(state, [
      {
        code: "INVALID_ITEM_STATE",
        message:
          error instanceof Error
            ? error.message
            : "Item state cannot be committed safely.",
      },
    ]);
  }
}

function revisionIssue(state: WorldState): readonly PlacementIssue[] | null {
  if (
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    state.revision === Number.MAX_SAFE_INTEGER
  ) {
    return [
      {
        code: "REVISION_OVERFLOW",
        message: "World revision cannot be advanced safely.",
      },
    ];
  }
  return null;
}

export function createEmptyWorldState(worldId: string): WorldState {
  if (!isBoundedId(worldId)) {
    throw new TypeError(
      `World id must be a non-empty string up to ${WORLD_CORE_LIMITS.maxIdLength} characters.`,
    );
  }
  return freezeWorldState(worldId, 0, []);
}

export function placeItem(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  item: PlacedItem,
): WorldMutationResult {
  const revisionFailure = revisionIssue(state);
  if (revisionFailure) return failure(state, revisionFailure);
  const validation = validatePlacement(world, state, registry, item);
  if (!validation.ok) {
    return failure(state, validation.issues);
  }
  return commit(state, [...state.items, item]);
}

export function moveItem(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  instanceId: string,
  position: { readonly x: number; readonly y: number },
): WorldMutationResult {
  const revisionFailure = revisionIssue(state);
  if (revisionFailure) return failure(state, revisionFailure);
  const existing = state.items.find((item) => item.instanceId === instanceId);
  if (!existing) {
    return failure(state, [
      {
        code: "INSTANCE_NOT_FOUND",
        message: `No placed item has instance id "${instanceId}".`,
      },
    ]);
  }
  const candidate: PlacedItem = { ...existing, position };
  const validation = validatePlacement(world, state, registry, candidate, {
    ignoreInstanceId: instanceId,
  });
  if (!validation.ok) {
    return failure(state, validation.issues);
  }
  return commit(
    state,
    state.items.map((item) =>
      item.instanceId === instanceId ? candidate : item,
    ),
  );
}

export function rotateItem(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  instanceId: string,
  rotation: Rotation,
): WorldMutationResult {
  const revisionFailure = revisionIssue(state);
  if (revisionFailure) return failure(state, revisionFailure);
  const existing = state.items.find((item) => item.instanceId === instanceId);
  if (!existing) {
    return failure(state, [
      {
        code: "INSTANCE_NOT_FOUND",
        message: `No placed item has instance id "${instanceId}".`,
      },
    ]);
  }
  const candidate: PlacedItem = { ...existing, rotation };
  const validation = validatePlacement(world, state, registry, candidate, {
    ignoreInstanceId: instanceId,
  });
  if (!validation.ok) {
    return failure(state, validation.issues);
  }
  return commit(
    state,
    state.items.map((item) =>
      item.instanceId === instanceId ? candidate : item,
    ),
  );
}

export function rotateItemClockwise(
  world: WorldDefinition,
  state: WorldState,
  registry: ItemRegistry,
  instanceId: string,
): WorldMutationResult {
  const revisionFailure = revisionIssue(state);
  if (revisionFailure) return failure(state, revisionFailure);
  const existing = state.items.find((item) => item.instanceId === instanceId);
  if (!existing) {
    return failure(state, [
      {
        code: "INSTANCE_NOT_FOUND",
        message: `No placed item has instance id "${instanceId}".`,
      },
    ]);
  }
  return rotateItem(
    world,
    state,
    registry,
    instanceId,
    normalizeRotation(existing.rotation + 90),
  );
}

export function removeItem(
  state: WorldState,
  instanceId: string,
): WorldMutationResult {
  const revisionFailure = revisionIssue(state);
  if (revisionFailure) return failure(state, revisionFailure);
  if (!state.items.some((item) => item.instanceId === instanceId)) {
    return failure(state, [
      {
        code: "INSTANCE_NOT_FOUND",
        message: `No placed item has instance id "${instanceId}".`,
      },
    ]);
  }
  return commit(
    state,
    state.items.filter((item) => item.instanceId !== instanceId),
  );
}
