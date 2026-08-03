# Audio implementation v2

## What the engine now owns

The existing `audio.bindUserGesture(window)` binding is the single browser
lifecycle owner. It remains cheap after unlock so a rejected first gesture or
later browser interruption can recover. It also suspends an already-running
context when the page is hidden and attempts to resume it when visible. If a
browser requires another gesture, the same binding retries. Manual
`audio.suspend()` is never auto-resumed; only `audio.resume()` clears that
explicit pause.

Audio failure must never block world creation, saving, travel, or study state.
The bootstrap calls `unlock()` synchronously inside the Start-button gesture,
but deliberately does not await it before creating the UI and Phaser world.
Rejection is contained and the persistent gesture binding can retry.

`setScene()` owns a coordinated location transition:

- ambience replaces its procedural layer with a 1.35 second equal-power
  crossfade;
- repeated identical scene/weather/time requests are ignored, preventing
  duplicate loop graphs;
- the one original music scheduler stays alive and smoothly changes level,
  tone, and tape movement for room, garden, cafe, or park. Travel does not
  create a second music loop.

App bootstrap teardown calls `audio.dispose()` after destroying its UI and
Phaser game. Disposal immediately stops the music scheduler, ambience loops,
transient sources, and bindings, disconnects the graph, and initiates context
close. A later bootstrap bind revives the same singleton as a clean locked
lifecycle; it does not reuse the disposed graph.

## Required scene integration

The engine exposes physical event APIs, but only the scene/animation layer
knows when contact actually happened.

### Foot contact

The current scene calls once from each planted-foot animation callback, and
only when collision resolution produced real displacement:

```ts
audio.playFootstep({
  surface: "tatami",
});
```

Do not call footsteps from held input, intended velocity, or every update.
`intensity` and `pan` remain optional API metadata. The current path uses the
actual-displacement/contact-frame edge itself as the single source of truth.

### Furniture placement

Call once at the state transition, never during drag movement:

```ts
audio.playPlacementCue({
  phase: "pickup", // then "drop" on commit
  valid: true,
  weight: "medium",
  pan: screenX * 2 - 1,
});
```

An invalid commit uses `{ phase: "drop", valid: false }`. Weight changes the
physical impact while the effect remains restrained by the shared limiter.
The current direct scene path supplies phase, validity, derived physical
weight, and camera-relative pan at singular transaction boundaries.

The event bridge supports the same fields via `komorebi:audio` custom events.
Choose direct calls or the bridge for a given producer, never both.

## Remaining acceptance checks

After scene integration, verify only the load-bearing experience:

1. cold start reaches the world even if audio is unavailable or suspended;
2. one actual foot plant produces one surface-correct cue, while pushing into
   a blocked collider produces none;
3. one pickup and one committed drop produce exactly two physical cues;
4. room/garden/cafe/park travel has no hard cut or doubled music;
5. backgrounding silences the context and returning recovers automatically or
   on the next gesture;
6. final teardown leaves no scheduler, ambience loop, event binding, or open
   context owned by the disposed system.
