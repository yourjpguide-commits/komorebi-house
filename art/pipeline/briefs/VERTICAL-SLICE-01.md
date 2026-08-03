# Vertical Slice 01 — Original Room Restyle

## Outcome

Restyle the exact shipped Komorebi House room at its existing 480 × 270 geometry. The current room silhouette, gameplay coordinates, starter layout, and interaction landmarks remain authoritative. The CityPop references govern palette, lighting, materials, and finish—not composition.

## Frozen gameplay surface

The authoritative values and file hashes are recorded in `../manifests/vertical-slice-01.json` and verified by `npm run art:validate`. This slice may not change:

- room bounds, obstacles, placement area, portals, spawns, or interaction points;
- the 8 × 8 placement grid, camera contract, depth ordering, collision, or save semantics;
- the starter item IDs, positions, rotations, footprints, texture keys, or avatar contract.

## First visual proof

Only six runtime assets belong to the first proof:

1. `room-base` — replace `public/assets/world/room-base.png` in place at exactly 480 × 270. It contains static architecture only: no movable furniture, avatar, UI, prompts, or invented portals.
2. `round-chabudai` — transparent 58 × 34 source canvas; existing placement `(294,190)`.
3. `patchwork-zabuton` — transparent 32 × 17 source canvas; existing placement `(294,210)`.
4. `folded-futon` — transparent 62 × 35 source canvas; existing placement `(194,212)`.
5. `seigaiha-notebook` — transparent 20 × 13 source canvas; existing placement `(282,178)`.
6. `milk-glass-desk-lamp` — transparent 20 × 28 source canvas; existing placement `(306,178)`.

The five movable assets are one coordinated visual family but receive independent acceptance decisions. A failed member does not inherit another member's approval.

## Visual direction

- Preserve the current room's large silhouette, entrances, tatami/wall/engawa divisions, and interaction landmarks.
- Use deep chromatic navy/indigo shadows, warm paper and amber light, and localized cyan/coral accents.
- Keep one-source-pixel chromatic contours, intentional clusters, material-specific texture, and clean nearest-neighbor edges.
- Reject global neon washes, mixed pixel cadence, semi-transparent fringe, noisy microtexture, copied characters/UI/compositions, and any geometry drift.
- Day is the first review state and preserves the original screen's geometry. Any later night presentation must derive from identical geometry and asset identities.

## Pre-generation stop

The live game has no external PNG loading path for furniture sprites and still has multiple generated/fallback producers. Image generation remains blocked until a separately approved cutover defines one canonical writer per accepted texture key and strict missing/wrong-dimension failure for `room-base` plus each accepted sprite. No generic loader, atlas, feature flag, compatibility layer, or parallel renderer may be introduced through this brief.

## Acceptance

- `npm run art:validate` confirms hashes, geometry locks, unique asset authority rows, exact room PNG dimensions, and the absence of an unauthorized cutover claim.
- Production build and cold boot have no missing texture, network, console, or WebGL errors.
- The real buy/place/move/cancel, valid/invalid placement, front/behind depth, portal/interaction, and save/reload paths pass.
- A real 390 × 844 touch run repeats cold boot with audio suspended or unavailable, buy/place/move, depth, travel, and reload.
- Fresh desktop 1280 × 720 DPR 1 and mobile 390 × 844 DPR 2 captures are judged at native world resolution and nearest-neighbor enlargement.
- Independent visual review scores at least 85/100, no category below 8/10, and prefers the candidate to the shipped screen while finding no recognizable copied trade dress.

## Subtraction gate

The manifest is the only decomposition, producer matrix, and deletion ledger. For every accepted cutover:

- existing runtime key and gameplay metadata stay unchanged;
- the old producer and alias/fallback closure proven exclusive to that ID are deleted in the same change;
- no duplicate asset path or runtime writer remains;
- new runtime files, renderers, feature flags, atlases, map schemas, and migration layers remain zero;
- net runtime source lines are non-positive unless the founder separately authorizes a named, measured exception;
- retained fallbacks name their live consumer and deletion blocker.
