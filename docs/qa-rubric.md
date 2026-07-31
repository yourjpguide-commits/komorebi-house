# Komorebi House production acceptance rubric

Status: release gate, not a polish wish list
Primary viewport: desktop 1440×900
Required mobile viewport: 390×844, touch emulation enabled
Required browsers: Chromium, WebKit, and Firefox for functional smoke; Chromium for the full visual/performance pass

## Release rule

Komorebi House is shippable only when all of the following are true:

1. Every **P0 hard gate** in this document passes.
2. Every critical journey passes on desktop and 390×844 mobile.
3. The weighted score is at least **92/100**, with no section below its section minimum.
4. There are zero open Severity 0 or Severity 1 defects and no waived Severity 2 defect in placement, persistence, economy, focus rewards, input, or audio controls.
5. Two consecutive clean full runs are recorded from a fresh browser profile. A rerun that merely turns red tests green is not enough.
6. The visual review uses fresh captures from the candidate build. Concept art, editor screenshots, and generated source art do not count as runtime evidence.

“Implemented,” “the test hook says so,” and “looks good at one viewport” are not acceptance evidence. A feature passes only when its visible user path works and its resulting state survives the transitions claimed by the product.

## P0 hard gates

Failure of any item below is an automatic **DO NOT SHIP**, regardless of score.

- The game loads into an identifiable, controllable scene without a blank canvas, broken asset, blocking error, or dev-only instruction.
- Keyboard and touch users can move, travel, customize, buy, place, cancel, focus, mute, and return to play without refreshing.
- The player cannot leave walkable bounds, walk through solid furniture, become permanently trapped, or disappear behind the wrong render layer.
- Invalid placement cannot be committed. Valid placement cannot silently fail.
- Purchases, focus rewards, inventory changes, and placement moves are applied exactly once, including under double-click, rapid tap, reload, and interrupted transition.
- A saved furnished room and garden reload with the same items, transforms, inventory, coins, focus progress, and settings.
- Corrupt or old save data falls back safely. It must not strand the player on a blank screen or erase a valid save before a recoverable migration attempt.
- Muting is immediate, complete, keyboard/touch accessible, and persistent. No audio starts before a user gesture.
- There are zero uncaught exceptions, unhandled rejections, console errors, failed required requests, 4xx/5xx asset responses, or WebGL/context-loss errors during any release journey.
- At 390×844 there is no page-level horizontal overflow, inaccessible control, clipped dialog action, browser-zoom dependency, or touch target smaller than 44×44 CSS pixels.
- The candidate contains no visible placeholder, debug geometry, collision mask, missing-glyph box, stretched pixel art, accidental smoothing, sprite halo, transparent seam, or foreign visual style.

## Required testability contract

Production behavior remains authoritative. Test instrumentation may observe or accelerate state, but it must never be the only implementation of a user feature.

### Stable visible selectors

The browser suite expects these `data-testid` values:

| Surface | Required selectors |
| --- | --- |
| Shell | `game-root`, `game-canvas`, `start-game`, `loading-indicator`, `save-recovery-notice` |
| HUD | `hud-coins`, `location-label`, `toast-region`, `mute-button` |
| Movement | `mobile-dpad`, `dpad-up`, `dpad-down`, `dpad-left`, `dpad-right` |
| Customization | `customize-button`, `catalog-panel`, `catalog-item-{sku}`, `buy-{sku}`, `inventory-item-{sku}`, `placement-preview`, `placement-rotate`, `placement-confirm`, `placement-cancel`, `placement-error`, `selected-object-panel`, `move-selected`, `rotate-selected`, `remove-selected` |
| Travel | `travel-button`, `travel-sheet`, `travel-{location}` |
| Focus | `focus-button`, `focus-panel`, `focus-start`, `focus-pause`, `focus-resume`, `focus-complete`, `focus-timer` |

Interactive elements also need accessible names and correct roles. A `data-testid` does not excuse an unlabeled button.

### Test-only QA bridge

Development/test builds should expose `window.__KOMOREBI_QA__`:

```ts
type KomorebiQaBridge = {
  state(): {
    ready: boolean;
    world: { location: string; phase?: string };
    player: {
      tileX: number;
      tileY: number;
      screenX: number;
      screenY: number;
      depth: number;
      moving: boolean;
      occludedBy: string[];
    };
    economy: { coins: number };
    inventory: Record<string, number>;
    placements: Array<{
      id: string;
      sku: string;
      zone: string;
      tileX: number;
      tileY: number;
      rotation: number;
      depth: number;
      footprint: Array<{ x: number; y: number }>;
    }>;
    focus: {
      status: "idle" | "running" | "paused" | "complete";
      remainingMs: number;
      completedSessions: number;
      pendingReward: number;
    };
    audio: {
      contextState: "suspended" | "running" | "closed" | "unavailable";
      muted: boolean;
      masterGain: number;
      unlockedByGesture: boolean;
    };
    persistence: {
      schemaVersion: number;
      lastSavedAt: number | null;
      pending: boolean;
      lastError: string | null;
    };
    render: {
      fps: number;
      frameTimeP95Ms: number;
      smoothing: boolean;
      contextLost: boolean;
    };
  };
  command(
    name:
      | "reset"
      | "grantCoins"
      | "setPlayerTile"
      | "advanceClock"
      | "samplePerformance"
      | "setVisualPreset",
    payload?: unknown,
  ): unknown | Promise<unknown>;
  query(
    name:
      | "placementTargets"
      | "placementHitPoint"
      | "occlusionWaypoints"
      | "navigationAnchors"
      | "saveStorageKey",
    payload?: unknown,
  ): unknown | Promise<unknown>;
};
```

Catalog cards expose `data-sku`, integer `data-price`, and `data-rotatable`. Placement-target queries return viewport CSS-pixel coordinates, not canvas backing-store coordinates. A target includes `valid` and a machine-readable reason such as `occupied`, `out-of-bounds`, `wrong-zone`, or `blocks-route`. Occlusion waypoints identify the object and legal front/behind player tiles.

The bridge must call the same domain transactions used by normal play. It must not write storage behind the game’s back. It is acceptable for the bridge to be absent from a production bundle.

## Weighted acceptance score

P0 gates still override the numerical score.

| Section | Weight | Minimum |
| --- | ---: | ---: |
| 1. True playability and scene travel | 16 | 15 |
| 2. Visual craft and consistency | 20 | 18 |
| 3. Controls and responsive/mobile behavior | 12 | 11 |
| 4. Customization and placement integrity | 14 | 13 |
| 5. Occlusion, collision, and spatial readability | 8 | 7 |
| 6. Persistence and economy correctness | 10 | 9 |
| 7. Focus loop and audio behavior | 10 | 9 |
| 8. Runtime reliability and performance | 10 | 9 |
| **Total** | **100** | **92** |

Give partial credit only for a bounded cosmetic defect with no effect on interaction, state, readability, or style coherence. A broken critical journey scores zero for its entire section.

### 1. True playability and scene travel — 16 points

- Fresh start communicates what can be done without relying on documentation.
- The player responds within 100 ms of meaningful input and stops within one animation frame of release.
- Walking, interacting, opening/closing UI, and returning to movement form a continuous loop with no focus trap or stale input.
- Room, garden, café, and park are reachable through visible in-world or clearly labeled travel affordances.
- Every destination has a distinct study/hangout affordance, readable collision boundaries, and a reliable route back.
- Loading and transitions preserve control intent safely: held keys do not continue moving after a scene change.
- Repeated rapid travel cannot duplicate the player, stack overlays, or strand the camera.

### 2. Visual craft and consistency — 20 points

- Pixel grid, sprite scale, projection, palette, outline weight, lighting direction, shadow language, and material detail are consistent across shell, character, furniture, plants, particles, and UI.
- Nearest-neighbor rendering is used at every supported zoom. No sprite is positioned on a fractional physical pixel when that creates shimmer.
- Furniture has credible contact shadows and anchors. Nothing looks pasted on, floats, sinks, or carries a source-background fringe.
- Clutter is deliberate: major affordances remain legible at a glance in both sparse and maximally furnished states.
- Day/night or weather treatment changes the whole scene coherently; it is not a translucent color overlay that destroys contrast.
- Animation has anticipation, readable key poses, stable volume, and no single-frame pops. Ambient animation supports calm rather than visual noise.
- UI looks authored for the game and remains subordinate to the world. Typography has no missing glyphs and Japanese text uses intentional line breaking.
- Room, garden, café, and park clearly belong to the same original world while retaining distinct silhouettes and material stories.

#### Blind visual review

For each candidate, capture these exact runtime states at 1440×900 and 390×844:

1. Default room, idle.
2. Densely furnished room, player behind a tall object.
3. Garden at the most atmospheric available phase.
4. Café focus state.
5. Park focus state.
6. Customization UI with a valid preview.
7. Customization UI with an invalid preview.

Normalize only the presentation frame; do not retouch the captures. Randomize labels and compare against legally obtained, team-supplied reference captures from top-tier handheld pixel-art and cozy-customization games. Reviewers score 1–5 for:

- immediate charm;
- composition and focal hierarchy;
- material/pixel craft;
- depth and spatial credibility;
- animation-frame quality, when reviewing clips;
- interface legibility;
- world/style cohesion;
- desire to keep playing.

Pass requires a median of at least **4.2/5**, no category median below **4.0**, and Komorebi House rated tied or preferred in at least **70%** of comparisons. Reviewers must also flag recognizable copied assets, layouts, iconography, text, character designs, or franchise-specific trade dress. Benchmark quality; do not ship imitation.

### 3. Controls and responsive/mobile behavior — 12 points

- WASD and arrow keys work without scrolling the page. Opposing inputs resolve deterministically.
- Pointer, touch, and keyboard all support the critical journey. No hover-only instruction or action.
- Touch controls register one intentional action per tap and cancel safely when the finger leaves the control.
- Mobile D-pad does not overlap core world interaction, browser safe areas, dialogs, or placement controls.
- At 390×844, the world remains meaningfully visible while any bottom sheet is open.
- Rotation, placement, confirmation, cancellation, travel, focus, and mute are reachable with 44×44 minimum targets.
- Orientation resize, background/foreground, and browser chrome height changes do not corrupt coordinates or leave a stale hit area.

### 4. Customization and placement integrity — 14 points

- Catalog price, affordability, ownership, and inventory count update immediately and agree after reload.
- The placement preview shows the exact final footprint, anchor, rotation, and validity.
- Invalid zones, occupied cells, walk-blocking choke points, out-of-bounds cells, and incompatible surfaces reject placement visibly.
- Items may touch legal edges without clipping. Every rotation is validated independently because width and height may swap.
- Moving an owned item cannot charge again, duplicate it, lose it, or leave a phantom collision.
- Cancel from new placement refunds/reserves correctly. Cancel from move restores the exact prior transform and draw order.
- Rapid confirm, double click, and multi-touch create only one transaction.
- Maximal furnishing preserves a route between required entrances and interaction anchors.
- Hit testing selects the visually topmost eligible object and remains correct under camera scale and mobile coordinate transforms.

### 5. Occlusion, collision, and spatial readability — 8 points

- Draw order is derived from spatial state, not a fragile creation order.
- The player renders in front of an object when physically in front and behind it when physically behind.
- Tall foreground objects use intentional fade/cutaway behavior when they conceal the player or an interaction target.
- Shadows never render over the object/player that should cast or occlude them.
- Collision footprint, visual contact footprint, placement footprint, and navigation footprint agree.
- A path cannot route through occupied cells, corner-cut diagonally through solids, or trap the avatar after placement.

### 6. Persistence and economy correctness — 10 points

- Save/reload round-trip is exact for location policy, player state, coins, inventory, placements, rotation, garden state, focus state, audio state, and relevant preferences.
- Autosave is transactional. Reload during a write yields either the old valid save or the new valid save, never a hybrid.
- Save schema is versioned; migration is deterministic and idempotent.
- Corrupt state is quarantined with a recoverable fallback and an actionable message.
- Prices cannot go negative, balances cannot underflow, and insufficient-funds attempts make no mutation.
- A purchase deducts once; a focus completion rewards once; reload/back/duplicate events cannot replay either transaction.

### 7. Focus loop and audio behavior — 10 points

- Starting, pausing, resuming, cancelling, completing, and returning from a focus session are explicit and comprehensible.
- Timer behavior uses monotonic elapsed time while active and a documented visibility/background policy.
- Completion feedback is calm, unmistakable, and does not block returning to the world.
- Rewards are granted only after valid completion and exactly once.
- A focus session survives the supported reload/navigation policy without resetting or awarding early.
- Audio is silent before first gesture, unlocks from the gesture, and does not create duplicate contexts or overlapping music on scene changes.
- Mute sets effective master output to zero immediately, persists across reload, and remains visually/accessibly truthful.
- Loop points, transitions, and simultaneous ambience have no click, pop, obvious gap, clipping, or runaway stacking.

### 8. Runtime reliability and performance — 10 points

Measure a production build after a warm-up on an otherwise idle machine.

- Zero runtime/console/network errors across the full matrix.
- Desktop target: median 60 fps, 1% low at least 50 fps, p95 frame time no more than 25 ms.
- 390×844 mobile emulation target: median at least 55 fps, 1% low at least 45 fps, p95 frame time no more than 33 ms.
- A 10-minute route/customize/focus soak grows JS heap by no more than 20% after forced-GC comparison when GC instrumentation is available.
- No unbounded scene, listener, timer, AudioNode, texture, or particle growth after 20 room↔garden↔café↔park cycles.
- First controllable frame is within 3 seconds on the agreed release test machine with cache disabled; visible loading feedback appears within 500 ms.
- Cumulative layout shift after the game shell appears is below 0.05.
- The canvas survives resize and visibility restoration without context loss, black frames, smeared buffers, or displaced hit targets.

## Browser test matrix

Legend: **A** automated in `tests/e2e.spec.ts`; **M** manual; **V** visual capture/review; **P** performance trace.

| ID | Scenario | Desktop | 390×844 | Mode | Pass evidence |
| --- | --- | :---: | :---: | --- | --- |
| BOOT-01 | Cold load to controllable first frame | ✓ | ✓ | A/P | Ready state, visible canvas, input changes player position, timing trace |
| BOOT-02 | Required assets and runtime logs | ✓ | ✓ | A | No failed request/status, page error, console error, or context loss |
| PLAY-01 | Keyboard movement and stop-on-release | ✓ | — | A | Position changes correctly; no stuck motion |
| PLAY-02 | Touch D-pad movement and cancel | — | ✓ | A/M | One direction per press; release stops; no accidental page gesture |
| PLAY-03 | Room→garden→café→park→room circuit | ✓ | ✓ | A | Location and visible art update once at every transition |
| PLAY-04 | Rapid repeated transition/input during load | ✓ | ✓ | A | One player, one scene, no stacked overlay or stale movement |
| VIS-01 | Fixed-state visual suite | ✓ | ✓ | V | Approved runtime screenshots and blind score sheet |
| VIS-02 | Pixel-grid check at 100%, 125%, 200%, DPR 1/2 | ✓ | ✓ | M/V | No smoothing, shimmer, seams, or fractional-pixel artifacts |
| VIS-03 | Sparse and maximum-clutter readability | ✓ | ✓ | M/V | Player, exits, interactions, and placement validity remain readable |
| INPUT-01 | Keyboard-only critical journey | ✓ | ✓ | M | Visible focus, no trap, all actions available |
| INPUT-02 | Mobile safe areas and 44×44 targets | — | ✓ | A/M | Bounding-box report and screenshots |
| INPUT-03 | Resize/orientation/background restoration | ✓ | ✓ | A/M | Correct canvas/hit coordinates and resumed input/audio policy |
| PLACE-01 | Buy and place one room item | ✓ | ✓ | A | One deduction, one inventory mutation, one valid placement |
| PLACE-02 | Invalid zone/occupied/out-of-bounds | ✓ | ✓ | A/M | Preview invalid; confirm blocked; state unchanged |
| PLACE-03 | Legal boundary at every rotation | ✓ | ✓ | A/M | No clipping; rotated footprint is correct |
| PLACE-04 | Move, cancel, confirm, rapid double-confirm | ✓ | ✓ | A | No charge, loss, duplication, or phantom collision |
| PLACE-05 | Maximum furnishing and route preservation | ✓ | ✓ | A/M | Required navigation anchors remain connected |
| DEPTH-01 | Walk behind/in front of tall object | ✓ | ✓ | A/V | Depth relation flips correctly in state and screenshot |
| DEPTH-02 | Foreground concealment/fade behavior | ✓ | ✓ | M/V | Player and target stay readable without layering pop |
| SAVE-01 | Furnish room/garden then reload | ✓ | ✓ | A | Deep-equivalent placements, counts, balance, settings |
| SAVE-02 | Reload during autosave | ✓ | ✓ | A/M | Old or new valid transaction only |
| SAVE-03 | Old/corrupt/unknown save payload | ✓ | ✓ | A | Migration or recoverable fallback; game remains playable |
| ECON-01 | Buy, insufficient funds, tap spam | ✓ | ✓ | A | Exact-once deduction; rejected attempt has zero mutation |
| ECON-02 | Focus completion/reload replay | ✓ | ✓ | A | Exact-once reward |
| FOCUS-01 | Start/pause/resume/complete | ✓ | ✓ | A/M | Timer and status transitions; clear completion; return to play |
| FOCUS-02 | Visibility/reload/travel policy | ✓ | ✓ | A/M | Elapsed-time behavior matches policy; no early reward |
| AUDIO-01 | Pre-gesture silence and first-gesture unlock | ✓ | ✓ | A/M | Suspended/silent before gesture; one running context after |
| AUDIO-02 | Mute/unmute, reload, scene circuit | ✓ | ✓ | A/M | Effective gain, button state, persistence, no duplicate layers |
| PERF-01 | Five-minute normal-play capture | ✓ | ✓ | P | FPS/frame-time/long-task trace meets targets |
| PERF-02 | Twenty-scene-cycle resource soak | ✓ | ✓ | A/P | Stable listeners, timers, contexts, textures, and heap |

## Critical manual scripts

### Max-clutter trap challenge

1. Start from a fresh save and grant only the funds needed through the normal QA transaction.
2. Place the largest legal item at each room edge and beside every doorway.
3. Fill remaining legal cells with mixed 1×1 and rotated multi-cell items.
4. Walk from spawn to every room interaction and exit using keyboard, click/tap pathing if offered, and D-pad.
5. Move one doorway-adjacent item, cancel, reload, and repeat the route.

Pass: no required anchor is disconnected; cancel restores the exact prior state; no avatar/object clipping, teleport, or depth inversion is observed.

### Occlusion gauntlet

For every tall/foreground object, capture the player at the back-left, back-right, front-left, front-right, and directly concealed positions. Repeat while the object is selected and after reload.

Pass: front/behind relation is spatially correct in all positions; any fade/cutaway is stable; selection outlines do not leak through impossible layers; the player never becomes unfindable.

### Audio soak

With headphones at a safe level: enter each scene, spend 30 seconds there, start/pause/resume/complete a short focus session, mute/unmute during each transition, background/foreground the tab twice, and repeat the circuit three times.

Pass: no pop, click, loop gap, phasing duplicate, volume jump, clipped transient, stale ambience, or false mute state.

## Severity and defect-loop policy

| Severity | Definition | Examples | Release treatment |
| --- | --- | --- | --- |
| S0 | Data loss, unrecoverable corruption, security/privacy failure, browser/device crash | Save destroyed, runaway audio resource crash | Stop the run; do not ship |
| S1 | Critical journey broken or state/exploit failure | Cannot move/place/travel; duplicate coins; trapped avatar; wrong persistence | Do not ship |
| S2 | Major quality/readability/control failure with a workaround | Severe occlusion, clipped mobile dialog, frequent frame hitch | Fix before release unless explicitly removed from scope |
| S3 | Bounded cosmetic issue | One-pixel artifact in a noninteractive frame | Track; counts against visual score |

Every repair must include:

1. the smallest reliable reproduction;
2. a failing automated test where deterministically possible;
3. root-cause evidence, not only a screenshot;
4. targeted retest;
5. adjacent-system retest;
6. fresh runtime capture for any visual/depth/input change.

Do not close a placement defect after testing a different item. Do not close an occlusion defect from a static state-only assertion. Do not close a persistence defect without a real reload. Do not close an audio defect without observing both effective output state and the user-visible control.

## Release evidence packet

The release candidate folder or CI artifact must contain:

- commit SHA and production build identifier;
- browser/OS/device/DPR matrix;
- two full-run reports;
- runtime issue log showing zero errors;
- visual captures listed above, with no retouching;
- blind review score sheet and reviewer count;
- performance traces and summarized thresholds;
- saved-state round-trip diff;
- known-defect list with severity and disposition;
- one-page verdict: **SHIP** or **DO NOT SHIP**, with each P0 gate explicitly checked.
