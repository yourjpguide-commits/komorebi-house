# Komorebi House — Pixel Art Bible

**Status:** Normative visual contract
**Art target:** Original, premium handheld-inspired pixel art for a browser game
**Version:** 1.0

This document is the single visual source of truth for `Komorebi House`. When a mockup, generated asset, implementation shortcut, or reference image conflicts with this document, this document wins until the art director explicitly revises it.

## 1. North star

`Komorebi House` should feel like a tiny, lovingly observed Japanese life that the player authors one object at a time.

The image is warm without becoming sepia, detailed without becoming noisy, and recognizably Japanese without becoming a theme-park collage. The room is the emotional center. The garden, café, and park are changes of rhythm, not separate visual brands.

The visual promise is:

- **Readable at a glance:** silhouettes, paths, exits, seats, study surfaces, and movable objects are immediately legible.
- **Rewarding up close:** every material has intentional pixel clusters, contact shadows, and small lived-in details.
- **Quietly alive:** light, leaves, water, steam, curtains, and character idles move on restrained, asynchronous cadences.
- **Authored by the player:** sparse, modest, and fully decorated spaces all look composed; the room never depends on one canonical furniture layout.
- **Specific, not stereotyped:** architecture and daily-life details carry the Japanese setting. Sacred, historic, and festival motifs are used only where context makes them truthful.

“Premium handheld quality” means disciplined art direction, responsive feedback, consistent scale, and polished transitions. It does not mean photorealism, excessive frame counts, or filling every pixel.

## 2. Visual pillars

### 2.1 Komorebi is the signature

Sun filtered through leaves is the game’s main visual motif. It appears as sparse, clustered pools of warm light with leaf-shaped interruptions—not as a generic full-screen bloom.

- Dapple groups contain one large cluster, two medium clusters, and a few 1–2 px flecks.
- The pattern drifts by only 1–2 native pixels over several seconds.
- Komorebi never covers text, item silhouettes, collision edges, or the player’s face.
- Indoors, it enters from a credible window or open shoji direction.
- At night and in rain, the motif becomes memory rather than effect: a leaf-shadow UI mark, a reflection, or a warm lamp lattice.

### 2.2 Handmade order

Edges are crisp, clusters are designed, and repeated tiles are quietly varied. Nothing looks airbrushed, vector-smooth, or procedurally speckled.

### 2.3 Lived-in Japanese specificity

The home is a small contemporary wooden house that preserves washitsu logic: genkan, tatami proportions, shoji/fusuma distinctions, tokonoma restraint, engawa transition, and garden-facing light. Contemporary books, chargers, stationery, a laptop, coffee tools, and storage keep it from reading as a period set.

### 2.4 Calm asymmetry

The composition uses `ma`—purposeful interval and breathing room. Large masses are balanced, not mirrored. One side can be visually heavier if the opposite side preserves open floor, light, or a view.

### 2.5 Tactile response

Every player action gets small, material-aware feedback:

- Furniture settles by 1 px and its contact shadow reforms.
- A sliding panel glides on its track instead of swinging.
- Tatami produces no dust puff; gravel, wood, soil, and paving each use different footstep particles.
- Tea, coffee, pages, watering, rain, and leaves use distinct micro-motion.

## 3. Originality and clean-room boundary

Commercial cozy decorators and classic handheld adventures are **quality references only**. They may establish abstract bars such as clarity, charm, animation economy, scene density, and interaction readability. They are not source art.

### Required originality rules

- Every character, room plan, prop, icon, palette, animation, location, sign, logo, and UI frame is original to `Komorebi House`.
- Do not trace, repaint, edit, or tile-sample screenshots from another game.
- Do not use a franchise name, studio name, or living artist name in asset-generation prompts.
- Do not reproduce another game’s character proportions, overworld tiles, roof shapes, grass marks, tree silhouettes, dialogue frames, menu topology, cursor, currency icon, item icon, or transition treatment.
- Do not build a “near match” and recolor it. Silhouette, internal structure, and surface language must all be independently designed.
- Reference boards should favor real architecture, gardens, furniture, ceramics, stationery, textiles, foliage, weather, and light photography. Game screenshots may appear only on a separate benchmark board for high-level critique.
- Generated art must arrive as isolated assets on transparent or controlled flat backgrounds. Never cut movable objects out of a generated furnished scene.
- No recognizable creature, ball, badge, trainer, battle, or collection iconography from an existing franchise.
- No faux-Japanese Latin type. Use a clean, licensed Latin pixel face and a legible, licensed Japanese bitmap or bitmap-compatible face.

### Similarity red flag

An asset must be redesigned if a reviewer can identify a specific commercial source from its silhouette, layout, internal pixel pattern, or UI structure without being told the source. “It is only homage” is not an exception.

## 4. Raster and camera contract

### 4.1 Native canvas

| Property | Contract |
|---|---|
| Virtual canvas | **480 × 270 px**, 16:9 |
| Art scale | Draw and export at **1× native resolution** |
| World tile | **16 × 16 px** |
| Placement sub-grid | **8 × 8 px** |
| Micro-detail unit | **1 px** |
| Scaling | Nearest-neighbor only |
| Camera | Orthographic, top-down 3/4 |
| Perspective | None; no distance scaling |
| Rotation | Authored facings, never runtime raster rotation |
| Base frame rate | 60 Hz simulation/render; sprite cels use lower authored cadence |

The camera sees 30 full tiles horizontally. Vertically, the canonical grid viewport is 480 × 256 px: 16 complete tile rows positioned at screen `y = 7…262`. The remaining 14 px are two 7 px world-rendered overscan strips at `y = 0…6` and `y = 263…269`. Overscan may continue architecture, sky, canopy, or ground, but never contains an interaction anchor, collision decision, or essential UI.

At a resting camera position:

```text
screenX = round(worldX - cameraX)
screenY = 7 + round(worldY - cameraY)
```

World origin is always the upper-left of the map, and world tile `(0, 0)` begins at world pixel `(0, 0)`. Placement coordinates are integer multiples of 8 world pixels. The camera may move by whole pixels; when it settles after travel, `cameraX` and `cameraY` return to multiples of 8 so furniture and architecture regain a stable screen-grid phase.

Critical subjects stay inside a 464 × 254 px action-safe rectangle, inset 8 px on every side. Dialogue portraits and large sheets use a separate UI-safe region.

### 4.2 Browser display

- Prefer integer display scales: 2× = 960 × 540, 3× = 1440 × 810, and 4× = 1920 × 1080.
- The backing surface accounts for device pixel ratio; the world remains 480 × 270 logical pixels.
- Set canvas/image sampling to nearest-neighbor at every stage.
- Never mix 1× world art with pre-scaled 2× or 3× assets.
- Fractional browser fitting may be used only as a last-resort outer presentation transform. It must not alter world coordinates, texture sampling, or source art.
- Letterbox with `#171B2D`, a low-contrast washi pattern, or responsive UI—not a stretched scene.

#### Sanctioned portrait mode

Portrait does not fractionally shrink the 480 × 270 world.

- The browser keeps the complete 480 × 270 nearest-neighbor render target.
- A 320 × 180 camera-safe crop is presented at exactly 320 × 180 CSS px in a centered `overflow: hidden` wrapper. Its initial source rect is `(80, 45, 320, 180)`.
- In portrait, the crop window may pan over the fixed 480 × 270 render target with integer source origins `cropX = 0…160` and `cropY = 0…90`. The house/café world cameras remain fixed; only this presentation window moves.
- The full canvas is translated by `(-cropX, -cropY)` inside the wrapper. One source pixel remains one CSS pixel; device pixel ratio expands each source pixel to an exact `DPR × DPR` physical block.
- On a 390 × 844 CSS viewport, the world crop begins at `x = 35`, leaving 35 px side margins. Responsive HTML/canvas UI occupies the area below it.
- The portrait crop follows the player or selected item only after it leaves the crop-local dead zone `x = 32…288`, `y = 18…162`. It moves by whole source pixels, clamps to the legal crop bounds, and settles to an 8 px phase.
- World overview and large placement operations may open a full-screen 320 × 180 planning view that pans the same map at native scale. It never scales the full 480 px scene down.
- If the viewport is narrower than 320 CSS px, gameplay requests landscape orientation; it does not blur or nonuniformly scale.

This crop is an alternate framing of the same world, not a second art resolution.

### 4.3 Projection grammar

This is **not true isometric art**.

- Floor tiles remain square.
- Vertical edges remain vertical.
- North-facing object tops show 3–8 px of their upper surface, based on height.
- Tall architecture can show a front/side plane, but parallel world lines do not converge.
- The player’s ground contact point—not the sprite center—controls draw order.
- North walls are typically 32–48 px high. Exterior façades may be 48–80 px high.
- A doorway is at least 16 px clear; primary traffic paths are 32 px clear.

This camera gives furniture enough visible top surface for customization while preserving the immediate navigation read of a classic top-down handheld game.

## 5. World scale and modules

One 16 px tile represents roughly **450 mm** of authored world space. Character proportions are intentionally chibi and do not use this conversion literally.

| Element | Native size or footprint |
|---|---|
| Full tatami module | 64 × 32 px / 4 × 2 tiles |
| Half tatami | 32 × 32 px / 2 × 2 tiles |
| Interior doorway | 16–32 px clear |
| Engawa depth | 32–48 px |
| Chair footprint | 16 × 16 px |
| Floor cushion footprint | 16 × 16 px |
| Low table footprint | 32 × 32 px |
| Study desk footprint | 32 × 16 or 48 × 16 px |
| Single futon footprint | 32 × 48 px |
| Bookcase footprint | 16 × 32 px; visual height up to 48 px |
| Small tree footprint | 32 × 32 px; canopy up to 64 × 64 px |
| Large park tree footprint | 32 × 32 px; canopy up to 80 × 80 px |

Visual size and collision footprint are separate. A canopy, lampshade, shelf, or blanket can overhang its footprint, but its contact anchor must remain explicit.

## 6. Master palette

The palette is warm-light/cool-shadow. Pure black and pure white are forbidden in world art. Deepest values are blue-violet rather than neutral black; highlights are cream rather than white.

Ramp values are listed darkest to lightest.

| Ramp | Hex values | Primary use |
|---|---|---|
| **Night Ink** | `#171B2D` `#242A3A` `#343B4B` `#4A5260` `#6E7480` | outlines, night, deepest occlusion |
| **Washi / Hinoki** | `#6E4939` `#A77A50` `#D3B280` `#F0D9AE` `#FFF4D6` | paper, pale wood, daylight |
| **Cedar / Walnut** | `#3B2624` `#5A3730` `#7C4D3A` `#A36A48` `#C99160` | beams, dark furniture, café |
| **Tatami** | `#465D48` `#77885B` `#AAB477` `#D8D59B` `#E9E2B1` | mat weave, dry grasses |
| **Leaf / Moss** | `#183F35` `#315844` `#4C755A` `#71956B` `#A5B97F` `#D0CF94` | foliage, moss, garden shade |
| **Indigo / Water** | `#1E2F52` `#263F65` `#376083` `#5285A1` `#80B1BD` `#B6D1CC` | fabric, water, rain, cool UI |
| **Stone / Metal** | `#3F4850` `#5B666B` `#78817F` `#A1A39A` `#C6C2AE` | paving, gravel, iron, appliances |
| **Clay / Leather** | `#6C3D35` `#965242` `#BD7054` `#D99A70` `#F0C697` | ceramics, brick, leather, skin support |
| **Vermilion accent** | `#A83F35` `#D65D48` `#F28D64` | selection, small décor accents |
| **Sakura accent** | `#A96E78` `#E9AAA7` `#F6D8D2` | petals, textiles, dawn |
| **Lamp light** | `#9A5B3A` `#D58B4C` `#FFC96B` `#FFE6A6` | bulbs, evening pools, steam rim |

Character skin uses three compatible foundation ramps rather than treating clay as one universal skin color:

| Skin family | Hex values, darkest to lightest |
|---|---|
| **Cool rose** | `#4B3033` `#75463F` `#A96C58` `#D79A79` `#F1C6A0` |
| **Warm olive** | `#44332D` `#71503E` `#9E7355` `#CCA079` `#E8C6A0` |
| **Deep umber** | `#29232B` `#473239` `#6E4943` `#976958` `#C08F70` |

These are foundations, not ethnicity labels. Choose the values that make a specific character read naturally in the location light, and preserve distinguishing undertones rather than palette-swapping one face ramp.

### Palette discipline

- A typical prop uses 5–9 colors plus shared outline colors.
- A character uses 12–18 colors total, including skin and outline.
- A location should show no more than roughly 48–64 materially meaningful colors at once.
- Scene balance target: **70% ground/neutral, 20% secondary family, 8% material accents, 2% high-chroma attention color**.
- Vermilion and sakura are accents, not global filters.
- Reuse ramps across locations. A café chair and a house shelf should share wood logic even when their local hue differs.
- Shadows shift toward `Night Ink` or `Indigo`; highlights shift toward `Washi / Hinoki` or `Lamp light`.
- Time-of-day changes use authored palette maps. Do not apply an arbitrary blue, orange, or multiply overlay to the finished scene.
- Important interactions must remain distinguishable under common red-green color-vision deficiencies. Selection is always shown through shape, outline, and motion as well as hue.

### Location color signatures

| Location | Dominant | Secondary | Accent |
|---|---|---|---|
| House / room | washi, hinoki, tatami | indigo | leaf green + tiny vermilion |
| Garden | leaf, moss, stone | water indigo | seasonal hero hue |
| Café | cedar, walnut, warm paper | deep indigo | copper + lamp amber |
| Park | leaf, open sky, stone | weathered wood | ginkgo gold or seasonal pink |

All locations retain Night Ink shadows, cream highlights, and one repeated indigo textile or sign element so they feel like the same world.

### 6.1 Indexed color and reproducible state LUTs

Each table row is an indexed ramp named `INK`, `WAS`, `CED`, `TAT`, `LEAF`, `IND`, `STONE`, `CLAY`, `VER`, `SAK`, or `LAMP`; indices increase from darkest (`0`) to lightest. Skin ramps are `SKIN_ROSE`, `SKIN_OLIVE`, and `SKIN_UMBER`. Source art stores these palette IDs, not unconstrained RGBA colors.

Time/weather LUTs are generated once at build time with this exact per-channel sRGB integer mix:

```text
mix(src, target, p) = round((src × (100 - p) + target × p) / 100)
```

Classify the first two values of a 5–6 color ramp as `shadow`, the last value as `highlight`, and all others as `mid`. In a 3 color accent ramp, use `shadow`, `mid`, `highlight` in order.

| State | Shadow mapping | Mid mapping | Highlight mapping |
|---|---|---|---|
| Day | identity | identity | identity |
| Dawn | mix with `IND2 #376083` at 25% | mix with `SAK1 #E9AAA7` at 10% | mix with `WAS4 #FFF4D6` at 10% |
| Golden | mix with `INK0 #171B2D` at 12% | mix with `CLAY3 #D99A70` at 12% | mix with `LAMP2 #FFC96B` at 25% |
| Night | mix with `INK0 #171B2D` at 45% | mix with `IND1 #263F65` at 45% | mix with `IND3 #5285A1` at 30% |
| Rain/overcast | mix with `INK1 #242A3A` at 20% | mix with `IND2 #376083` at 18% | mix with `IND4 #80B1BD` at 12% |

Exceptions:

- Skin ramps use half the listed percentage, rounded up, so identity and undertone survive.
- `LAMP` is identity inside an active emissive core at night; outside the light zone it uses the normal LUT.
- UI colors do not pass through world LUTs.
- Day rain uses the rain/overcast LUT, then the material wet rule below. Dawn, golden, or night rain uses that time-state LUT, then the same wet rule; it does not apply the rain LUT a second time. This ordering is fixed.

Wet rules apply after the selected rain-capable base LUT:

| Material | Body | Edge/specular |
|---|---|---|
| Pale/dark wood | mids mix with `INK1` 12% | one upper edge mixes with `IND4` 18% |
| Tatami/fabric | mids mix with `IND1` 8% | no hard glint |
| Stone/gravel | mids mix with `INK1` 18% | selected upper edges mix with `IND4` 25% |
| Soil | shadows/mids mix with `INK0` 25% | no hard glint |
| Foliage/moss | mids mix with `IND1` 12% | leaf tips mix with `IND4` 18% |
| Ceramic/metal/glass | body mixes with `IND1` 8% | authored glints mix with `WAS4` 25% |
| Water | rain LUT only | ripple crest uses `IND5 #B6D1CC` |

Alpha steps are fixed at `A1 = 64`, `A2 = 96`, `A3 = 128`, and `A4 = 160` on a 0–255 scale. Clear-day/golden cast shadows use `A3`; overcast/rain use `A1`; local night casts use `A2`. Contact shadows are opaque indexed clusters.

When binary dither replaces alpha, use this exact 4 × 4 Bayer threshold matrix:

```text
 0  8  2 10
12  4 14  6
 3 11  1  9
15  7 13  5
```

Lamp zones are authored stepped masks: outer zone mixes with `LAMP1` 12%, middle with `LAMP2` 25%, and core with `LAMP3` 40%. Zone edges may use the Bayer matrix; radial blur is forbidden.

The build exports a resolved RGBA LUT for every palette ID/state combination and a receipt hash. Separate artists and render paths must consume that same LUT; hand-tinted duplicates are not accepted.

## 7. Pixel grammar

### 7.1 Clusters

- Build forms from coherent 2–8 px clusters.
- Single pixels are reserved for eye marks, ceramic glints, dust, raindrop tips, distant lights, and short-lived sparkles.
- Remove accidental stair-stepping and “pixel confetti.”
- Large flat areas get structured seams, grain, weave, or value breaks—not random noise.
- Curves use intentional step rhythms such as `1-1-2-2-3`, then reverse cleanly.

### 7.2 Outlines

- Default outline is 1 px.
- Use colored outlines selected from the material’s shadow ramp.
- `#171B2D` is for deepest overlaps, undersides, night silhouettes, and critical readability; do not ring every object in it.
- Light-facing outer edges may lift one value or open entirely.
- Shared internal edges are usually one line, not a doubled border.
- A foreground occluder may receive a 1 px cool rim around the player reveal mask.

### 7.3 Anti-aliasing and transparency

- No automatic anti-aliasing.
- Manual anti-aliasing is limited to one neighboring palette value and one pixel of thickness.
- Sprite transparency is binary.
- Stepped alpha is permitted only for cast shadows, rain sheets, glass, light pools, placement ghosts, and atmospheric transitions.
- No soft Gaussian blur, bloom, glow brush, or semi-transparent fringe.

### 7.4 Texture density

At native scale, every 16 × 16 material tile needs:

1. a dominant value mass,
2. one directional or structural cue,
3. one restrained variation cluster,
4. clean edge continuity with neighboring tiles.

Texture never competes with an item silhouette. Under interactable furniture, floor contrast drops by one step.

## 8. Material language

| Material | Pixel cues | Highlight/shadow behavior | Do not |
|---|---|---|---|
| Hinoki / pale wood | long quiet grain every 12–24 px; occasional 2–4 px knot | warm upper-left edge, narrow cool seam | zebra stripes or random scratches |
| Cedar / dark wood | broad planks, rare orange grain, darker end grain | small amber rim, dense underside | outline every plank equally |
| Tatami | fine directional weave, alternating mat direction, distinct `heri` border where used | broad matte light; 1 px contact darkening | noisy crosshatch or green carpet |
| Washi | warm near-flat field, tiny fiber flecks only in close UI art | diffuse cream; no hard specular | pure white or dirty parchment noise |
| Shoji | washi field with regular wooden lattice | soft transmitted light, silhouettes only when meaningful | render as blue glass |
| Fusuma | opaque panel, pull inset, optional restrained field motif | matte, slightly deeper than shoji | make translucent |
| Ceramic | 3–5 value rounded cluster, dark lower lip, 1–2 px glint | small hard highlight, cool contact shadow | smooth vector gradient |
| Fabric | broad folds, 1 px seam, sparse weave accent | soft value steps, colored outline | per-pixel woven noise |
| Glass | colored edge, two diagonal highlight clusters, readable contents | stepped alpha, hard 1 px sparkle | gray transparent rectangle |
| Brushed metal | short aligned 1–3 px glints, cool middle | high contrast only at rim | chrome gradients |
| Stone | 2–4 irregular value clusters per tile, one dominant plane | cool shadow, dry pale edge | pebble confetti |
| Raked gravel | quiet base with broken parallel bands at 8–16 px cadence | low contrast except after rain | uniform stripes |
| Water | dark mass, two horizontal/diagonal highlight bands, edge reflection | animated band displacement; no blur | blue checkerboard |
| Foliage | overlapping three-size clusters with a dark canopy core | warm top-left tips, cool lower interior | identical circular leaf blobs |
| Soil | broad dark clumps, sparse pebbles, damp variant | low matte contrast | brown TV static |
| Paper / books | warm paper block, colored spine bands, 1 px page lines | bright top edge, dark stacked gap | readable microtext as noise |

### Repetition control

Every repeatable 16 × 16 surface has at least four compatible variants:

- `A`: neutral
- `B`: light variation
- `C`: dark or worn variation
- `D`: edge/detail variation

Variants must preserve boundary continuity. Scatter is seeded by map coordinates so save/reload and screenshots remain stable.

## 9. Japanese architectural rules

### 9.1 House identity

The house is a modest contemporary timber home, not a museum and not a fantasy inn. Its visual age comes from cared-for use: softened thresholds, a repaired cushion, a favorite mug, stacked study books, a plant turned toward light.

Required spatial cues:

- **Genkan:** a clearly lower hard-surface entry zone with a visible step up. Shoes remain on the lower side and point toward exit or storage.
- **Main room:** a 10–12 jō-inspired multifunction tatami composition with a contemporary study edge. This slightly generous main room is the house’s primary living, social, rest, and study space; the rest of the house stays compact.
- **Shoji:** translucent light-dividing panels with regular lattice.
- **Fusuma:** opaque sliding storage/room panels with recessed pulls.
- **Tokonoma:** a non-walkable alcove with one restrained seasonal arrangement; it is never a storage shelf.
- **Engawa:** a raised wooden transition facing the garden, at least 32 px deep, visually distinct from both tatami and outdoor paving.
- **Eaves:** exterior shadows visibly protect the engawa and wall.

Tatami modules use the 2:1 full-mat proportion. Adjacent mats rotate weave direction. Avoid a layout where four mat corners meet unless a specifically researched narrative context requires it. Borders are narrow and restrained.

### 9.2 Threshold truth

The setting gains credibility from correct thresholds:

- Outdoor shoes do not cross the genkan step.
- Garden sandals can wait at the engawa.
- Sliding panels occupy tracks and disappear behind or beside another panel.
- Raised wood, tatami, tile, gravel, and soil each change the character’s contact shadow and tiny footstep effect.
- Furniture cannot straddle the genkan step, a sliding-panel track, the tokonoma, or an exterior threshold.

### 9.3 Motif restraint

- Use shoji grids, joinery, indigo cloth, washi, ceramics, plants, and stationery as everyday identity.
- Temple, shrine, torii, ema, shimenawa, festival lanterns, family crests, and religious statuary are not generic decoration.
- A stone lantern may appear in a researched garden context, never as a repeated “Japanese” filler prop.
- Text on signs must be meaningful Japanese reviewed for context and register. Placeholder glyph soup is prohibited.

## 10. Scene composition

Every scene uses five visual bands:

1. **Ground and traversal**
2. **Architecture and major masses**
3. **Interactive objects and character**
4. **Foreground occluders**
5. **Light, weather, and UI**

Each scene needs one primary focal area, two supporting landmarks, one quiet negative-space area, and at least one clear exit. A player entering for the first time should understand the room in two seconds.

Primary paths are 32 px wide. Short intentional squeezes may narrow to 16 px, but never around a frequently used chair, doorway, or study interaction.

### 10.1 Canonical map blockouts and cameras

Tile rectangles below use inclusive start and exclusive end coordinates: `[x0,y0 → x1,y1]`. They are topology contracts, not final decoration plans.

| Location | Map | Camera | Canonical structural rectangles |
|---|---:|---|---|
| House | 32 × 18 tiles | Fixed at `(cameraX, cameraY) = (16, 16)` px | rear wall `[2,1 → 30,4]`; tokonoma `[3,4 → 7,8]`; 12-jō tatami field `[7,4 → 19,12]`; study wood `[19,4 → 29,12]`; engawa `[7,12 → 30,15]`; genkan `[2,12 → 7,17]`; garden exit `[26,15 → 29,18]`; street exit `[3,16 → 6,18]` |
| Garden | 36 × 22 tiles | Follow, clamped `x 0…96`, `y 0…96` px | house/eaves `[0,0 → 36,5]`; engawa landing `[11,4 → 25,7]`; open garden `[2,6 → 34,20]`; hero-tree reserve `[24,6 → 34,15]`; water reserve `[3,12 → 11,20]`; gate `[16,20 → 20,22]` |
| Café | 32 × 18 tiles | Fixed at `(16, 16)` px | rear wall `[1,1 → 31,4]`; window study `[2,4 → 13,9]`; counter `[14,4 → 30,7]`; service lane `[13,7 → 30,10]`; table pockets `[3,10 → 17,16]`; entry `[25,15 → 29,18]` |
| Park | 48 × 28 tiles | Follow, clamped `x 0…288`, `y 0…192` px | main path corridor `[0,10 → 48,18]` with authored bends; pond reserve `[31,2 → 48,13]`; hero-tree reserve `[3,2 → 15,14]`; bench/study bays `[17,5 → 30,11]` and `[20,18 → 34,24]`; west exit `[0,12 → 3,16]`; east exit `[45,13 → 48,17]` |

The house and café cameras remain fixed so customization reads as a composed diorama. The garden and park use a landscape dead zone of screen `x = 160…320`, `y = 87…183`; the camera moves only after the player leaves it, rounds sampling to whole pixels, and settles to an 8 px phase. Portrait mode uses the same maps with a tighter dead zone centered inside the 320 × 180 crop.

Map rectangles allocate negative space and traversal before props. Do not “solve” a sparse rectangle by enlarging furniture or changing the tile scale.

### 10.2 The house and customizable room

**Emotional read:** “I’m home; this can become mine.”

Composition:

- North wall occupies the upper 32–48 px with shoji light and shallow storage.
- The principal shoji/window and study desk occupy the upper-left third and establish the scene’s directional daylight.
- The tokonoma anchors the opposite upper corner with one seasonal vertical accent.
- The room center keeps enough negative space for a low table, cushions, or a deliberately sparse layout.
- The garden-facing engawa runs along the lower edge as a broad ambient threshold. It is bright but diffuse; the upper-left shoji/window remains the hard directional key.
- The genkan or house exit reads as a darker, lower hard-surface zone.
- A sliver of kitchenette or corridor can imply a larger house, but the main room remains the hero.

Default focal triangle:

1. warm study desk,
2. central player-customized comfort cluster,
3. garden light beyond the engawa.

Customization zones:

- **Study edge:** desk, lamp, shelves, stationery, chair/floor chair.
- **Rest edge:** futon, low bed, blanket chest, side light.
- **Social center:** low table, cushions, tea, game/books.
- **Display edge:** plants, record player, ceramics, wall pieces.
- **Threshold edge:** only small, low-profile items; never block travel.

The unfurnished room must still look intentional through architecture, tatami rhythm, light, and one tiny inherited object. A fully furnished room must preserve at least 30% visible floor and one uninterrupted primary path.

### 10.3 Garden

**Emotional read:** “The house exhales here.”

Composition:

- The engawa and eaves occupy the upper edge so the garden is visibly connected to home.
- A broken S-curve or offset stepping-stone path leads from engawa to the garden gate or study spot.
- One hero tree sits off-center and creates a canopy/frame, not a screen-wide ceiling.
- A low water element, basin, or tiny pond balances the tree mass.
- Moss/soil/gravel form large calm shapes; they do not alternate every tile.
- Open customization patches are visibly prepared but not outlined like farm plots.
- Foreground foliage frames at most 15% of the viewport.

Use asymmetry and seasonal focus:

- Spring: one flowering hero and sparse drifting petals.
- Summer: deep layered greens, cicada-light shimmer, stronger shade.
- Autumn: maple or ginkgo focus with restrained fallen leaves.
- Winter: branch silhouette, dry grasses, pale low sun, optional light snow.

Never display every seasonal symbol at once.

### 10.4 Local café

**Emotional read:** “A warm public room where concentration feels easy.”

Composition:

- Entry at a lower side leads to a visually obvious ordering counter.
- Counter and back bar create one strong horizontal mass in cedar/walnut.
- A window bar or compact study nook sits in the upper-left, brightest third of the scene.
- A small number of tables create pockets rather than a cafeteria grid.
- The pastry case, siphon/pour-over tools, ceramics, and handwritten menu are material-detail rewards.
- One indigo noren or cloth divider relates the café to the house palette.
- NPC movement lanes remain separate from seated study footprints.

The café should evoke a contemporary neighborhood kissaten through proportion, coffee equipment, dark wood, warm lamps, and quiet regulars—not through an accumulation of retro signs.

### 10.5 Park

**Emotional read:** “Open air, local routine, a little more sky.”

Composition:

- A diagonal or gently bending path crosses the view and clearly connects exits.
- One seasonal tree mass frames a side; a second, smaller mass balances it.
- Benches and a picnic/study patch face water, sky, or planted space rather than a blank wall.
- A pond or drainage stream may touch one edge; never center it like a stage.
- A low town edge—fence, rooftops, bicycle parking, or a vending machine—grounds the park in daily neighborhood life.
- Grass is a broad quiet plane with clustered edge detail, not evenly stamped blades.
- Canopy occlusion is broken into revealable clusters so the player never disappears for more than a moment.

The park uses more sky/water values and less amber than the café, while retaining the same outlines and material rules.

## 11. Character and NPC sprites

### 11.1 Base proportion

| Property | Contract |
|---|---|
| Sprite canvas | 36 × 48 px |
| Visible body | about 24–28 px wide, 43–46 px high |
| Head | about 21–24 px wide, 25–28 px high |
| Eye | 2 × 3 px cluster with a restrained 1 px highlight |
| Ground contact | centered 10–15 px foot band at anchor (18, 45) |
| Collision footprint | 18 × 12 source px, scaled independently in world space |
| Outline | 1–2 px chromatic contour, broken by material-light clusters |

The silhouette is compact and expressive, but not baby-like. Hands and feet are small clusters with readable gestures. Hair shape, outerwear, bag, apron, hat, and stance distinguish NPCs before facial detail does.

### 11.2 Facings

The core set uses four fully authored cardinal facings. Diagonal movement selects the dominant facing and uses cardinal art. Do not rotate or mirror asymmetrical sprites at runtime.

An eight-direction set may be introduced only if all player outfits, carried items, sit/study actions, and NPC rigs receive complete authored diagonals. A partial diagonal system is worse than a polished cardinal system.

### 11.3 Character values

- Faces use 3–5 skin values including shared outline.
- Eyes sit one value above the deepest outline unless a dramatic expression requires otherwise.
- Mouths are omitted in neutral overworld scale; a 1 px mouth appears only when the expression needs it.
- Hair has one dominant mass, one shadow mass, and 1–3 highlight clusters. No stripe-by-stripe strands.
- Clothing folds follow movement/contact, not decorative noise.
- Player outfits must remain readable against tatami, wood, foliage, and night.
- NPC skin, hair, age, body shape, posture, and clothing reflect a believable local community rather than one repeated base with palette swaps.

### 11.4 Interaction poses

Required authored poses:

- stand and breathe,
- walk,
- sit on chair,
- sit on floor cushion,
- kneel/low-table study,
- desk study/type/write,
- read book,
- drink,
- water plant,
- carry/place object,
- sleep/rest,
- umbrella walk.

Furniture and character poses share explicit seat, hand, desk-edge, and foot anchors. The character must never float beside a chair or clip through a tabletop.

## 12. Furniture, décor, and customization assets

### 12.1 Asset construction

Every placeable item ships with:

- transparent sprite or animation sheet,
- 1× source,
- width and height,
- placement-plane list and plane-specific anchor,
- 8 px placement footprint where the plane requires one,
- collision/support footprint,
- allowed zones and support rules,
- authored facing/rotation list,
- draw band and occlusion behavior,
- shadow sprite/mask contract,
- interaction anchors,
- palette family,
- animation tags,
- content hash.

Canvas dimensions are multiples of 8 px. Use 2 px transparent gutters between atlas frames and enough extrusion/padding to prevent sampling bleed.

### 12.2 Placement planes and supports

Every item declares one or more explicit placement planes:

| Plane | Uses | Rules |
|---|---|---|
| `floor-underlay` | rugs, floor mats | no collision; draws over floor and under all floor objects; may be occupied |
| `floor` | furniture, cushions, freestanding décor | owns ground anchor, footprint, collision, and contact shadow |
| `wall` | prints, clock, hanging scroll, small wall shelf | uses 8 px wall-local grid and wall-facing anchor; no ground footprint |
| `surface` | stationery, tea, books, small lamps, ceramics | requires a supporting object polygon or named socket |
| `ceiling` | pendant light, mobile | requires architecture socket; no floor collision; may declare foreground occluder |
| `soil` | planted flowers, shrubs, garden features | requires prepared soil polygon and root footprint |
| `water` | lilies, floating light, small water feature detail | requires water polygon; collision inherited from water body |

Support rules are transactional:

- A desk, table, shelf, sill, or ledge defines one or more integer-pixel support polygons plus optional 8 px sockets.
- A child item stores its coordinates relative to the supporting instance, not the room origin.
- Moving or rotating a parent moves its supported children atomically and revalidates them.
- Storing a parent with children either stores the whole group or fails with an explicit prompt; it never drops or duplicates children.
- `floor-underlay` may remain beneath furniture. Moving an occupied underlay requires group move or fails; objects never silently teleport off it.
- Wall coordinates originate at the upper-left interior corner of the specific wall segment. Wall art draws after the wall surface but before foreground furniture/characters.
- Ceiling objects use authored ceiling sockets; their cords and shades can occlude, but their interaction target remains at reachable floor level.
- Soil/water items inherit the containing zone’s wetness, season, and contact rules.

### 12.3 Anchor and art-metadata schema

All coordinates are integer native pixels measured from the upper-left of the current sprite cel. Positive `x` points right; positive `y` points down. No facing is derived by mirroring.

```ts
type Facing = "north" | "east" | "south" | "west" | "na";
type AnchorName =
  | "ground"
  | "seat"
  | "hand.left"
  | "hand.right"
  | "carry"
  | "desk.edge"
  | "surface.primary"
  | "interaction"
  | "emitter"
  | "shadow";

interface CelAnchor {
  x: number;
  y: number;
  facing: Facing;
  animation: string;
  frame: number;
}

interface ArtMeta {
  canvas: { width: number; height: number };
  facings: Facing[];
  placementPlanes: string[];
  placementAnchor: Partial<Record<Facing, { x: number; y: number }>>;
  footprint8?: Array<[number, number]>;
  collision8?: Array<[number, number]>;
  anchors: Partial<Record<AnchorName, CelAnchor[]>>;
  supports?: Array<{
    id: string;
    plane: "surface" | "wall" | "ceiling" | "soil" | "water";
    polygon: Array<[number, number]>;
    sockets8?: Array<[number, number]>;
    drawBand: number;
  }>;
  shadow: {
    mode: "none" | "contact" | "authored-cast" | "canopy";
    spriteOrMask?: string;
    anchor: { x: number; y: number };
    facings: Facing[];
    states: string[];
  };
  occlusion?: {
    regionMask: string;
    revealMask: string;
    revealPriority: number;
  };
}
```

Anchor coverage is frame-locked:

- Animated characters declare `ground` for every cel and all interaction anchors needed by that action.
- A sitting action aligns character `seat` to furniture `seat`; desk actions additionally align `desk.edge`, and carried items align `carry` to the correct hand anchor.
- A static cel may reuse its one anchor record. An animation frame may inherit an anchor only when its pixels at that contact are identical; inheritance is explicit in source metadata.
- Each declared facing has its own coordinates. Radially symmetric and architecture-bound assets declare `facings: ["na"]`; one- or two-facing assets declare only those authored keys. Runtime sign-flips or inferred offsets are forbidden.
- `placementAnchor`, shadow facings, and frame anchors must contain every declared facing and must not invent undeclared facings.
- Validation fails when any required `action × facing × frame × anchor` entry is missing, outside the canvas, or mismatched with its partner by more than 0 px.

### 12.4 Rotation

Furniture rotations are redrawn, not mechanically rotated. A north-facing desk shows a different top/front balance than an east-facing desk. Grain, handles, books, cables, and cast shadows follow the new orientation.

Items with visually identical rotations may declare two facings, but the footprint and anchor still rotate correctly.

### 12.5 Density ladder

Every scene must pass in three furnishing states:

1. **Sparse:** architecture and light carry the scene.
2. **Lived-in:** 8–14 major objects create a functional home.
3. **Collector-full:** many small items remain grouped, paths remain open, and no area becomes visual static.

Small props gather into authored “families”: tea family, stationery family, music family, plant family, textile family. Random isolated trinkets are discouraged.

### 12.6 Placement feedback

- Valid placement: 1 px cream rim + moss-green footprint corners.
- Invalid placement: vermilion corner ticks + crossed footprint; never a full red screen tint.
- Selected item: slow two-step value pulse or four moving corner marks.
- Placement ghost: 50% ordered dither or stepped alpha, snapped to 8 px.
- Drop: 1 px settle, two-frame contact compression, shadow restoration, tiny material-appropriate particle.
- Rotate: four-frame quarter-turn redraw or quick cut between authored facings with a 1 px lift. Never spin the raster diagonally.

## 13. Depth, occlusion, and shadows

### 13.1 Draw order

Use explicit render bands:

1. distant backdrop/sky,
2. ground,
3. ground decals,
4. rear architecture,
5. low objects,
6. characters and normal objects sorted by ground contact,
7. tall foreground objects,
8. canopy/eaves/foreground occluders,
9. weather and local atmosphere,
10. UI.

Raw sprite `y` alone is insufficient. Each asset’s ground-contact or placement-plane anchor and render band are authoritative.

### 13.2 Shadow types

| Shadow | Treatment |
|---|---|
| Contact | 1–2 px solid cool-dark cluster directly under contact |
| Low furniture cast | 1–3 px lower-right offset, stepped edge |
| Tall object cast | 2–6 px lower-right offset, simplified silhouette |
| Canopy shadow | broken 2–8 px clusters with large gaps |
| Eave shadow | broad horizontal band with 1 px broken light edge |
| Character | compact oval/foot clusters, never a blurry ellipse |
| Night local light | three stepped-value zones, no radial gradient |

Daylight is a screen-space art convention: location maps are oriented so their principal daylight opening or open sky is in the upper-left third. Day cast shadows travel lower-right.

| Location | Primary source | Clear-day cast offset | Architectural proof |
|---|---|---:|---|
| House | upper-left shoji/window | `(+3,+3)` px | shoji light and desk rim; engawa supplies diffuse fill only |
| Garden | open upper-left sky | `(+4,+3)` px | eave, hero tree, and stepping stones agree |
| Café | upper-left window study bay | `(+2,+2)` px | stools, sill, and counter equipment agree |
| Park | open upper-left sky | `(+4,+3)` px | tree trunks, bench legs, and sign agree |

Local lamps create a secondary shadow no longer than 2 px inside their authored light zone. They do not reverse the scene’s contact shadow. A location that needs a different primary vector must provide a complete relit asset/shadow set and an art-director-approved scene override; changing one prop is not sufficient.

Shadow opacity/value is based on weather:

- clear day: strongest, crisp 1 px edge,
- overcast: one value lighter and shorter,
- rain: softest through stepped dither, still pixel-sharp,
- golden hour: longer, warmer light-facing edge,
- night: local and lamp-specific.

### 13.3 Shadow and occlusion art assets

- `contact` shadows are small authored indexed sprites per footprint family.
- `authored-cast` shadows are separate 1-bit masks per facing and required animation state. The renderer places the mask at its declared `shadow` anchor, applies the scene offset table, then colors/dithers it with the active weather rule.
- Tall asymmetrical objects always use authored casts. A generic oval is allowed only for compact characters and radially simple pots/stools.
- Canopies and eaves provide a separate broken cast mask; the sprite’s visible leaf/roof alpha is never reused as the shadow.
- Every foreground occluder provides a 1-bit `regionMask` naming the pixels permitted to fade and an artist-made `revealMask` defining attractive holes/edges. The renderer intersects these with the player reveal radius.
- Facing and state coverage is exact. If a lamp arm, open door, umbrella, branch, or animated foliage cel changes silhouette, its shadow/reveal mask changes too.
- Baked ambient occlusion stays in the base sprite. Directional cast shadows remain separate. Do not double-darken the same contact pixels.
- Atlas validation compares source/mask dimensions, anchors, facing lists, and state lists. A missing or mismatched mask blocks export.

### 13.4 Player reveal

When the player walks behind a tall object or canopy:

- Fade only the specific occluding region, not the whole object.
- Use a dithered reveal mask with a 1 px cool rim.
- Preserve the object’s outer silhouette where possible.
- Fade in two or three discrete steps over 100–160 ms.
- Never leave the player fully hidden during navigation or placement.

## 14. Lighting and time of day

### Dawn

- Cool Night Ink shadows.
- Sakura/washi light near windows and horizon.
- Low contrast, small warm interior lamps still visible.
- Dew and water receive one-pixel bright glints.

### Day

- Neutral-warm washi light.
- Clear material identity and strongest customization readability.
- Komorebi is visible but sparse.
- This is the palette against which all base assets are authored.

### Golden hour

- Lamp-light rim on upper-left planes.
- Cast shadows extend 1.5–2× day length.
- Indigo and leaf shadows deepen rather than turning brown.
- Limit the state to a short, precious interval; do not make the whole game orange.

### Night

- Indigo/Night Ink ambient palette map.
- Lamps create compact pools with stepped boundaries.
- Windows show a few stable neighborhood lights.
- The player, interactables, exits, and floor boundaries retain readable value separation.
- Blacks never crush into one mass; deepest ink is reserved.

### Interior light logic

- Shoji creates broad, diffused rectangular light.
- Open windows/doors can create harder leaf-shadow clusters.
- Desk lamps light the work surface first, the character second, and nearby wall third.
- Paper, ceramic, and steam catch warm light; metal gets only tiny bright points.
- No light source illuminates through an opaque wall or closed fusuma.

## 15. Weather and seasons

### Rain

- 1 px-wide diagonal rain streaks in 2–4 lengths, 12 fps.
- Three depth bands move at different speeds.
- Roof and eave drip lines accumulate before releasing drops.
- Puddles use 4–6 frame rings with broken ellipses.
- Exterior materials shift to their authored wet variants: darker body, sharper highlight, richer wood.
- Interior scenes show softened window contrast and sparse glass streaks, never rain particles inside.
- Rain does not dim the scene so far that item colors collapse.

### Wind

- Foliage motion travels in delayed clusters, not a whole-screen sway.
- Curtains and noren lag behind leaves.
- Ground leaves move in short, discontinuous hops.
- Wind strength is readable from amplitude, not animation speed alone.

### Snow

- Sparse 1–2 px flakes on three depth bands.
- Ground accumulation uses authored edge masks, not a white overlay.
- Footprints appear as short cool indent clusters and fade slowly.
- Snow is optional for the first release; do not ship it until accumulation boundaries are coherent.

### Seasonal continuity

Seasonal swaps change:

- one hero tree,
- two supporting plant families,
- a restrained ground-detail set,
- one tokonoma/café detail,
- ambient light bias.

Architecture, navigation, and the master material language remain stable.

## 16. Animation cadence

The renderer may run at 60 Hz, but pixel cels update at deliberate handheld cadences. Motion interpolation must land on whole pixels.

| Motion | Frames | Cel rate / timing | Notes |
|---|---:|---:|---|
| Player walk | 6 per facing | 10 fps | two clear contact poses; 1 px body rise |
| Umbrella walk | 6 per facing | 10 fps | canopy lags body by one cel |
| Idle breathe | 4 | short 6 fps phrase every 1.6–2.4 s | mostly still; 1 px chest/hair change |
| Blink | 2–3 | 80–120 ms, every 3–7 s | seeded per character |
| Sit / stand | 6 | 10 fps | contact aligns exactly with seat |
| Write / type | 6 | 8 fps | pause after 2–4 cycles |
| Page turn | 8 | 10 fps | paper silhouette remains readable |
| Drink | 8 | 8 fps | hold at sip; small steam interruption |
| Place object | 5 | 12 fps | lift, settle, contact |
| Fusuma / shoji slide | 6 | 10 fps | track-aligned; no easing overshoot |
| Foliage idle | 4 | 4 fps | phase-offset by cluster |
| Strong foliage gust | 6 | 8 fps phrase | returns to original cel |
| Water surface | 6 | 6 fps | highlight bands, not whole-tile wobble |
| Steam | 8 | 8 fps | 1 px meander, then dissipate |
| Lamp/firefly flicker | 3–4 | 3–5 fps irregular | no rapid strobe |
| Rain | 4 | 12 fps | depth bands phase-offset |
| Puddle ripple | 6 | 8 fps | broken rings |
| UI cursor | 4 | 6 fps | one-pixel pulse |
| Pickup sparkle | 8 | 12 fps | short, rare, no screen bloom |

### Cadence rules

- Decorative loops start at seeded offsets. Nothing breathes, blinks, ripples, and sways in sync.
- Avoid constant motion. Stillness is part of the composition.
- A single idle prop should animate in each small visual cluster.
- Repeated loops include held cels and quiet intervals.
- Camera motion can interpolate smoothly, but final sprite positions and camera sampling are rounded consistently to whole native pixels.
- Screen shake is limited to 1 px and reserved for a truly weighty placement or environmental beat. Cozy interactions do not shake the camera by default.

## 17. UI art direction

### 17.1 Motifs

The UI combines contemporary Japanese stationery with quiet joinery:

- warm washi-like panels,
- indigo binding strips,
- 1 px dark-wood or ink borders,
- tiny brass/copper pins,
- squared label tabs,
- restrained stitch or grid marks,
- the original **Komorebi Lattice** mark: four warm window squares crossed by one diagonal leaf-shadow cluster.

The Komorebi Lattice may appear on loading, save confirmation, and empty states. It is not repeated on every button.

### 17.2 Panels

- 9-slice panel corners are 4–6 px.
- Outer border: 1 px Night Ink.
- Inner keyline: 1 px lighter material value.
- Panel fill is nearly flat; texture uses at most a few deliberate fiber clusters.
- Drop shadow is 1–2 px lower-right and fully pixel-sharp.
- Modal sheets dim the world with an authored dither/stepped overlay, not blur.

### 17.3 Type

- Japanese body text: 12 px native minimum.
- Latin body text: 8–10 px native minimum, depending on face.
- Price, count, and shortcut labels: never below a reliably readable 8 px face.
- Use licensed glyph sets with complete punctuation, kana, and required kanji.
- Do not horizontally stretch fonts.
- Do not simulate Japanese identity through brush fonts in utility UI.
- Use warm cream text on ink/indigo and dark ink on washi. Mid-gray on mid-brown is forbidden.
- Shipping text renders from committed bitmap atlases named `font-jp12` (12 × 12 glyph cell, 14 px line height), `font-latin8` (8 × 8 cell, 10 px line height), and `font-latin10` (10 × 10 cell, 12 px line height). Each atlas includes its source-font name, exact version, license, glyph manifest, rasterizer settings, and hash in the asset receipt.
- Glyphs are rasterized once at build time, placed at integer coordinates, and sampled nearest-neighbor. Browser/system fallback rendering is prohibited in the pixel UI. A missing glyph displays a visible missing-glyph box and fails localization QA.

### 17.4 Icons

- Standard inventory icon: 16 × 16 px.
- Hero/action icon: 24 × 24 px.
- Icons read first by silhouette, second by one material color, third by a 1–2 px detail.
- Keep a consistent upper-left highlight and lower-right contact shadow.
- Selected, unavailable, new, and owned states differ by frame/mark as well as color.
- Currency uses an original rounded wooden price token or plain `¥` label; no borrowed coin silhouette.

### 17.5 Inventory and customization

- Inventory is a washi catalog sheet with indigo category tabs—not a grid copied from another game.
- Item cards show sprite, name, footprint, price/ownership, color variant, and interaction marker.
- A compact quick tray may show 5–7 recently used objects.
- Placement mode minimizes UI so the room remains the focus.
- Undo/redo are always visible in placement mode.
- Touch targets are at least 44 CSS px even when their native visual icon is smaller.
- Focus rings and keyboard selection use the same four-corner mark as controller selection.

### 17.6 Dialogue

- Dialogue boxes occupy the bottom band without covering the speaker’s face or active interaction.
- Speaker label resembles a small bound stationery tab.
- Portraits, if used, are original 48 × 48 px busts with the same palette and cluster grammar as overworld art.
- Text reveal never outruns comfortable reading and can be completed instantly.
- Choice focus is visible through cursor, outline, and value shift—not color alone.

### 17.7 Normative UI layouts

All landscape coordinates below are native pixels on the 480 × 270 target.

| Surface | Rectangle | Internal contract |
|---|---:|---|
| Compact HUD | `(8,8,464,24)` | location left; time/weather center; currency/focus right; may collapse during quiet play |
| Dialogue | `(8,198,464,64)` | speaker tab `(16,190,112,14)`; portrait `(16,206,48,48)`; text `(72,205,390,44)` or `(16,205,446,44)` without portrait; max 3 Japanese lines |
| Inventory sheet | `(16,12,448,246)` | header 28 px; category rail `(24,44,40,202)`; item grid begins `(72,52)` |
| Inventory card | `92 × 58` | 4 columns × 3 rows, 4 px gutters; 32 px sprite; one 12 px name line; price/owned line; footprint, variant, and interaction use 8–12 px icons |
| Quick tray | `(120,230,240,32)` | 7 compact slots; selected slot may expand upward, never sideways |
| Placement top bar | `(8,8,464,28)` | item name/rotation/plane left; validity and room capacity right |
| Placement controls | `(108,230,264,32)` | undo, redo, rotate, store, confirm; keyboard/controller labels share slots |
| General modal | `(40,28,400,214)` | 24 px title; 12 px inner margin; up to 3 actions in bottom 32 px |

Landscape truncation:

- Item names are one line and end with the atlas ellipsis glyph.
- Dialogue wraps only at approved Japanese line-break opportunities.
- Prices and counts never truncate; the label yields space first.
- Focus highlight adds no layout size—it occupies the existing 1 px inner keyline.

Portrait uses CSS-pixel UI below the exact 320 × 180 world crop:

| Surface on 390 × 844 | Rectangle in CSS px |
|---|---:|
| World crop wrapper | `(35,16,320,180)` |
| Status/actions row | `(15,208,360,44)` |
| Quick tray | `(35,260,320,56)` |
| Inventory/modal sheet | `(15,208,360,620)` |
| Portrait item grid | inner width 336; 2 columns of 164 × 92 cards with 8 px gutter |
| Portrait dialogue | `(15,638,360,190)`; portrait 64 × 64; text uses 14 CSS px line height |

In portrait, inventory, dialogue, and large study sheets replace the lower control stack rather than layering over it. The world crop remains visible unless narrative privacy or text length requires a full sheet. Every interactive cell has a minimum 44 × 44 CSS px hit target; visual pixel icons remain centered at native size.

## 18. Location transitions and framing

- Interior-to-garden transitions use the physical threshold: panel opens, exterior light expands, short camera carry, then control returns.
- Scene cuts use a 6–10 frame Komorebi Lattice wipe or quick ink-to-washi stepped dissolve.
- Avoid imitation of familiar iris, creature, battle, or map-transition signatures from other games.
- Travel to café/park may use an original neighborhood notebook map. Routes are simple ink lines with tiny landmark silhouettes and moving sunlight, not a copied overworld map.
- Loading transitions must complete or loop gracefully; no fake progress bar unless progress is real.

## 19. Production rules

### 19.1 Asset naming

Use predictable names:

`<location>_<category>_<subject>_<material-or-variant>_<facing>_<state>_<size>.png`

Examples:

- `house_furniture_study-desk_hinoki_south_idle_48x40.png`
- `garden_foliage_maple_autumn_na_breeze_64x72.png`
- `cafe_prop_coffee-siphon_glass-east_idle_24x32.png`

### 19.2 Source and export

- Preserve layered source files and palette indices.
- Export PNG with exact dimensions and no color-profile conversion that changes hex values.
- Extrude atlas edges or preserve at least 2 px gutters.
- Disable texture filtering, mipmaps, and lossy compression.
- Do not resize exported pixel art with a smooth filter.
- Automated packing may reposition sprites but never trim away the declared anchor context.

### 19.3 Asset generation boundary

If generative tools are used:

1. Generate isolated subjects or controlled material studies.
2. Rebuild/clean at the native pixel grid.
3. Enforce the master palette or an approved extension.
4. Correct silhouette, anchor, perspective, and lighting by hand/tooling.
5. Inspect against both light and dark checker backgrounds.
6. Reject halos, semi-transparent fringe, floor contamination, and unplanned texture noise.
7. Bind approved art to metadata before scene placement.

Image generation never owns map topology, footprint, collision, anchor, depth, or final sprite-sheet coordinates.

### 19.4 Browser production budget

The visual target is 60 fps on an A13-class iOS device and a 4 GB mid-range Android device with WebGL2, plus the current and previous stable desktop Chrome, Safari, and Firefox releases.

| Budget | Mobile | Desktop |
|---|---:|---:|
| p95 total frame time | ≤ 16.7 ms | ≤ 16.7 ms |
| p99 frame time during rain/placement | ≤ 22 ms | ≤ 20 ms |
| CPU world + animation update | ≤ 4 ms | ≤ 3 ms |
| renderer submission | ≤ 8 ms | ≤ 6 ms |
| active GPU texture memory | ≤ 64 MiB | ≤ 128 MiB |
| atlas page | max 2048 × 2048 RGBA | max 2048 × 2048 RGBA |
| active atlas pages | 4 | 8 |
| scene draw calls after batching | ≤ 100 | ≤ 140 |
| simultaneously animated world sprites | ≤ 80 | ≤ 140 |
| weather/ambient particles | ≤ 320 | ≤ 640 |
| average full-screen alpha overdraw | ≤ 3× | ≤ 4× |
| backing-store DPR | cap at 3 | cap at 4 |

Additional gates:

- Initial playable art payload is at most 12 MiB compressed; location-specific atlases stream before transition.
- No single transparent atmosphere sheet covers the whole screen when sparse batched particles or tiled masks can express the same effect.
- Static furnishings share batched atlases and do not consume per-frame animation updates.
- Off-camera animation, particles, shadow masks, and interaction markers are culled.
- Canvas2D fallback keeps navigation/customization intact, halves weather particle count, removes the far atmosphere layer, and uses binary shadow dither. It does not blur or change the core palette.
- Dynamic fallback order is: reduce far weather → reduce ambient particles → freeze noninteractive foliage to a stable cel → reduce reveal-mask transition steps. Character, interaction, placement, and UI animation never downgrade first.
- Performance captures include sparse/full room, rain garden, crowded café, park canopy reveal, night lamps, placement ghost, landscape 4×, and portrait crop.

## 20. Scene acceptance gates

No scene is “art complete” until all gates pass.

### 20.1 Pixel integrity

- Inspect at 1×, 3×, and 6× nearest-neighbor.
- No unintended semi-transparent edge pixels.
- No mixed pixel scales.
- No filtered texture or subpixel crawl.
- Curves, outlines, and clusters survive 1× inspection.

### 20.2 Composition

- At 1×, the focal area, player, exit, study surface, and primary path are immediately readable.
- Grayscale retains depth separation.
- Squint/thumbnail view shows 3–5 large value masses, not confetti.
- Foreground framing does not consume more than 15% of the view.
- Sparse and full customization states both retain visual balance.

### 20.3 Material identity

Without labels, a reviewer can distinguish:

- tatami from grass,
- shoji from glass,
- fusuma from shoji,
- hinoki from dark café wood,
- gravel from stone paving,
- ceramic from metal,
- indoor light from outdoor sunlight.

### 20.4 Interaction

- Every placeable object has correct contact, shadow, footprint, rotation, and occlusion.
- Seats, desks, doors, panels, and study poses align at all supported facings.
- Valid/invalid placement is readable without relying on red/green alone.
- No interaction marker appears through a wall or under unreadable clutter.

### 20.5 Time and weather

- Day, golden hour, night, and rain each preserve navigation and object readability.
- Light direction remains coherent.
- Wet materials visibly change by material, not one global overlay.
- Decorative animation is asynchronous and never distracts from study UI.

### 20.6 Browser and viewport

- Verify 480 × 270 output at exact 2×, 3×, and 4× landscape scales.
- Verify the sanctioned 320 × 180 source crop at its initial `(80,45)` origin and all four legal extrema within `cropX 0…160`, `cropY 0…90`, inside a 390 × 844 portrait layout at DPR 2 and DPR 3.
- Pixel inspection confirms every source pixel occupies an exact `DPR × DPR` physical block in portrait; no full-scene fractional downscale is present.
- The player/selected object remains within the portrait crop’s 256 × 144 safe center as the crop window follows over fixed house/café cameras and normal garden/park cameras.
- The world composition remains understandable when UI reflows, and the planning view can reach every placement cell hidden outside the crop.
- Touch UI does not cover exits, the player, or the selected object.
- No shimmer appears when camera and character move one pixel at a time.
- The browser production budgets in §19.4 pass for the required stress scenes.

### 20.7 Cultural review

- Japanese text is meaningful and contextually correct.
- Architectural thresholds and object uses are plausible.
- Sacred or ceremonial motifs have a real location/story reason.
- The scene reads as daily life, not an inventory of stereotypes.

### 20.8 Originality review

- No asset is traceable to a specific commercial sprite, map, UI, or icon.
- Generation prompts and source notes contain no prohibited style imitation.
- Silhouette, palette use, internal texture, and composition are independently authored.
- Benchmark screenshots, if used for critique, are never included in shipping files or atlases.

## 21. Blind quality benchmark

Benchmarking tests polish, not similarity.

### 21.1 Panel and capture protocol

- Use at least **7 independent reviewers** who did not create the evaluated scene: at least 2 pixel-art/game-visual practitioners, 1 reviewer able to assess everyday Japanese cultural details, and 4 target players.
- Prepare matched pairs for room, garden, café, and park. Match visible play area, furnishing density, time/weather intent, UI presence, and capture duration.
- Display at the same physical size with nearest-neighbor sampling. Do not crop one image more favorably, add labels/logos, or reveal title/studio.
- Randomize left/right order, pair order, and anonymous IDs per reviewer.
- Use 8–12 second animation clips for motion questions and still captures for composition/material questions.
- Keep commercial benchmark media external to the project and use it only where review rights permit.

### 21.2 Two separate instruments

**A. Forced-choice comparison**

For each matched pair, reviewers choose left, right, or tie:

1. clearest focal hierarchy,
2. clearest material identity,
3. most inhabitable space,
4. best clarity when richly decorated,
5. easiest character tracking through occlusion,
6. most spatially credible lighting,
7. most alive but restrained animation,
8. fastest UI comprehension,
9. most culturally specific without cliché.

**B. Independent 1–5 rating**

Rate every anonymous image independently on clarity, cohesion, material identity, inhabitability, animation restraint, customization legibility, lighting coherence, and UI comprehension:

- `1` broken or unreadable,
- `2` materially weak,
- `3` competent but visibly unfinished,
- `4` release-polished,
- `5` exceptional and memorable.

### 21.3 Pass and originality rules

`Komorebi House` passes a location when:

- its median is at least 4 on every independent dimension,
- no dimension has more than one rating below 3,
- it is chosen or tied in at least half of forced-choice responses for clarity, material identity, inhabitability, and customization legibility,
- all concrete defects are ticketed with scene/state evidence,
- no substantiated derivative flag remains.

A derivative flag must name a specific source and matching silhouette, layout, pixel pattern, icon, or UI structure. Two independent matching flags—or one flag confirmed by the art director—block approval and require redesign.

A reviewer merely preferring a famous reference is not by itself a failure. A concrete problem such as muddy values, pasted-looking props, weak contacts, noisy grass, unclear interaction, or culturally implausible staging is a revision ticket.

Report per-question counts, medians, rating spread, reviewer-role mix, randomized capture IDs, furnishing density, time/weather state, and corrective actions. Never claim the project is “better than” a benchmark from one subjective vote.

## 22. Final art-director checklist

Before approving any asset or scene, answer yes to all:

- Is it unmistakably part of `Komorebi House`?
- Is the subject readable at native 1×?
- Does it obey the 16 px world scale and 8 px placement grid?
- Are silhouette, anchor, footprint, and draw band correct?
- Does its lighting come from upper-left or a visible local source?
- Are its outlines colored and its clusters intentional?
- Does the material read without a label?
- Does it share the master palette rather than inventing a private one?
- Does it remain clear on tatami, wood, foliage, and night?
- Is motion restrained, whole-pixel, and asynchronous?
- Is its Japanese context accurate and ordinary-life specific?
- Is it original in silhouette, structure, pixels, and presentation?
- Does it improve both a sparse and a fully customized room?
- Would removing it make the scene less meaningful, not merely less full?

If any answer is no, the asset is not ready.
