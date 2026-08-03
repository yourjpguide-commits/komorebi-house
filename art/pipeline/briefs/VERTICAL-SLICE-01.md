# Vertical Slice 01 — Room, engawa, and visible garden

**Status:** Ready for asset generation

**Branch:** `art/citypop-pipeline-v2`

**Geometry authority:** Current `main` runtime at 480 × 270

## Deliverable

Replace the visual skin of the existing room composition without changing its map, entrances, walkability, placement grid, or save model.

The slice contains:

- modular room shell: wall, shoji/window, tatami, wood trim, and engawa;
- visible garden: stone, foliage, water, and one seasonal cherry-tree mass;
- seven movable families: study desk, floor chair/cushion, shelf, lamp, plant, low table, and storage;
- one readable player character;
- night-primary and day-derived states;
- one tall occluder and one rotatable/movable object.

## Required real-player proof

1. Cold start into the room without missing assets or errors.
2. Sparse and furnished room captures at native scale.
3. Buy or select, preview, valid-place, invalid-place, move/rotate, and cancel.
4. Walk in front of and behind the tall object without collision or draw-order failure.
5. Save, reload, and recover the exact placement.
6. Repeat the placement path at 390 × 844 touch emulation.
7. Compare fresh night and day runtime captures against the canonical references for palette hierarchy and cohesion—not copied layout.

## Stop/go gate

Do not generate the next family until the current family has correct isolation, anchor, footprint, contact shadow, native-scale readability, palette role, and fresh in-game evidence. Do not expand the catalog, café, park, story, economy, or test inventory during this slice.
