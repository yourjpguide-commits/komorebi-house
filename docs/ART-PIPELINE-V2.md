# Komorebi House — Art Pipeline V2

**Status:** Normative production plan

**Authority:** `docs/art-bible.md` defines the visual contract; this document defines how art reaches the game.

**Phase:** CityPop visual rebuild, vertical slice first

## 1. Goal and boundary

Rebuild the current room, engawa, and visible garden in an original CityPop-inflected pixel-art language while preserving the shipped Phaser game and its customization loop.

The V2 art phase does not replace Phaser, redesign the maps, alter the 480 × 270 simulation canvas, change placement coordinates, or replatform gameplay. The simulation is projected at an exact 2× camera zoom into a 960 × 540 render surface. Code remains authoritative for topology, collision, navigation, placement, draw order, economy, persistence, and interaction. Image generation proposes appearance only.

Whole generated furnished scenes are concept references, never runtime plates or extraction sources. Runtime art is assembled from isolated, metadata-bound assets.

## 2. Visual direction

- The canonical night reference is `art/references/citypop-night-primary.png`.
- The canonical day reference is `art/references/citypop-day-derived.png`.
- Night is the primary art-direction and review state: deep ink and indigo ambient values, warm domestic light, restrained cyan/coral accents, luminous water, tactile wood, and dense but legible lived-in detail.
- Day is derived from the same geometry, material families, silhouettes, anchors, and masks. It is not a separately invented visual identity.
- The references establish palette hierarchy, atmosphere, detail density, lighting rhythm, and material ambition. They are not source pixels, layouts to trace, or furnished scenes to cut apart.

## 3. Runtime contract that remains locked

- Phaser 3.90 with TypeScript and Vite.
- 480 × 270 simulation world, 16 × 16 world tiles, and 8 × 8 placement grid.
- 960 × 540 render surface, fixed whole-room 2× camera projection, and nearest-neighbor display.
- Current room/garden topology, entrances, walkable areas, placement zones, and save semantics.
- Authored facings; no runtime raster rotation.
- Contact anchors and spatial metadata determine placement and depth.

Any further resolution, projection, renderer, or topology change requires a separate runtime bakeoff. It may not enter through an asset promotion.

## 4. Asset units

The pipeline admits only isolated or modular production units:

- architectural layers and material tiles;
- furniture, study objects, storage, lighting, plants, and garden objects;
- characters and authored animation facings;
- contact/cast shadows, foreground occluders, reveal masks, emissive masks, reflections, and atmosphere;
- UI icons and frames that are original to Komorebi House.

Each movable object is generated and finished independently. A generated furnished room may be retained only as a non-shipping art-direction reference.

## 5. GPT Image 2 directed-edit loop

1. Freeze an asset brief: purpose, native bounds, facing, placement plane, materials, palette families, light source, state, and prohibited elements.
2. Supply a small ordered reference set: the canonical style reference, a clean live Komorebi canvas export, a local slot crop, and accepted family exemplars when available.
3. Produce two to four isolated candidates. Do not request a replacement room.
4. Compare candidates in the ImageGen viewer. Select one candidate and make one directed change at a time, stating both the change and all invariants.
5. Reject any result that changes its canvas unexpectedly, invents UI/text, contaminates the background, or cannot survive isolation.
6. Normalize the winner deterministically at 1×: crop, alpha cleanup, palette/cluster repair, exact canvas, anchor registration, and hash.
7. Bind metadata, integrate in Phaser, and judge the fresh runtime capture. Atlas or concept quality is not acceptance.
8. Repair the smallest named defect and repeat until the runtime gate passes.

ImageGen never owns map topology, exact grid placement, footprints, collision, anchors, render bands, state correspondence, or atlas coordinates.

## 6. Asset metadata and promotion

Every admitted asset records:

- stable ID, family, revision, source/candidate/normalized hashes, and normalization version;
- native canvas, opaque bounds, palette family, and alpha policy;
- contact anchor, placement footprint, collision footprint, support surface, and sockets;
- authored facings/rotations, render band, shadow, occlusion/reveal, emissive/reflection masks, and animation tags;
- prompt and edit lineage, reference IDs, model, reviewer decision, and runtime evidence paths.

Promotion is serialized:

`brief → candidate → normalized → metadata-bound → runtime-approved → shipped`

Rejected candidates and raw generation batches live outside the shipping tree. Only canonical references, approved masters, manifests, and runtime assets are committed.

## 7. First vertical slice

The first slice keeps the existing room/garden shape and proves one coherent playable composition:

- room shell: wall, shoji/window, tatami, wood trim, and engawa;
- visible garden layer: stone, foliage, water, and one cherry-tree/seasonal mass;
- seven representative movable assets: study desk, floor chair or cushion, shelf, lamp, plant, low table, and one storage object;
- one character with idle and walking readability;
- night-primary and day-derived presentation;
- one tall occluder and one rotatable/movable object.

The slice must prove sparse and furnished room states, valid and invalid placement, front/behind traversal, correct shadows/anchors, touch placement, and save/reload. It does not expand the shop catalog, café, park, story, economy, or test inventory.

## 8. Load-bearing acceptance gate

The slice proceeds to asset-family scale-out only when all of these are true:

- fresh boot with no missing texture, console, network, or WebGL error;
- crisp 1× pixels and correct nearest-neighbor presentation on desktop and 390 × 844 mobile;
- no halo, fringe, floor contamination, pasted-on contact, floating/sinking, or foreign style;
- player, route, exit, study surface, and movable objects remain readable at native scale;
- placement, collision, draw order, front/behind traversal, day/night state, and save/reload use the real production paths;
- a fresh blind visual review scores the runtime scene, not a concept image, and finds no recognizable copied trade dress.

Only checks that can falsify a shipping user path or art-integration invariant belong in this phase. Broad test proliferation is explicitly out of scope.

## 9. Repository layout

```text
art/
  references/          # canonical, provenance-recorded visual direction
  pipeline/
    briefs/            # frozen asset and slice briefs
    contracts/         # schemas and normalization contracts
    manifests/         # accepted-asset lineage and metadata
  work/                # ignored raw generations and temporary edits
public/assets/v2/      # runtime-approved production assets only
```

The active implementation branch is `art/citypop-pipeline-v2`. No file or commit from the deleted P128 probe or the deleted SakuraStudy cozy-probe machinery may be imported. The current 960 × 540 room candidate is an independent export from the approved original ImageGen source.

## 10. Stop and rollback conditions

Stop scale-out if the slice requires geometry drift, generated backplate extraction, manual exception metadata, inconsistent facings, or non-deterministic placement. Roll back a promoted asset by reverting its manifest and runtime asset together; the prior shipped game remains the recovery baseline.
