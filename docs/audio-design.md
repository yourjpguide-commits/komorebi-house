# Komorebi House audio design

The audio system is fully procedural WebAudio. It downloads no samples, uses
no third-party music, and contains no copied melody. Its musical identity comes
from an original eight-bar warm-jazz chord bed, a deterministic generative
upper voice, softly swung percussion, and filtered noise used as tape texture.

## Player experience

The intended mix is calm enough for a real study session:

- Music is a 72 BPM lo-fi bed with long voicings, restrained bass, brush-like
  percussion, delay-modulated tape wow, a generated warm-room reverb, and
  sparse non-repeating upper notes.
- The active place is audible at low volume without becoming a soundscape demo.
  Room hum and wood ticks, garden wind and birds, café murmur and cups, and park
  leaves and open-air birds each have their own procedural layer.
- Rain and time of day are independent modifiers. Rain adds roof/window wash
  and spatial droplets. Evening adds insects outdoors; night adds sparse
  crickets in every suitable place.
- UI, furniture, purchases, studying, doors, pages, travel, and four footstep
  surfaces use short synthesized transients. They are intentionally tactile,
  quiet, and pitch-different enough to communicate the action without visual
  confirmation.

All four buses are gain-staged into a master limiter. Slider values use a
squared response so the lower half has useful fine control.

## Integration

Importing the singleton is safe during SSR and does not allocate an
`AudioContext`.

```ts
import { audio } from "./audio";

const removeUnlock = audio.bindUserGesture(window);
const removeWorldEvents = audio.bindGameEvents(window);

// Keep these bindings for the app lifetime.
// On final app teardown:
removeUnlock();
removeWorldEvents();
```

`bindUserGesture` listens once for `pointerdown` or `keydown` and performs the
browser-required unlock directly within that gesture. A UI can instead call
`await audio.unlock()` from its own Start/Enter button. If WebAudio is missing
or a browser rejects the gesture, `unlock()` resolves to `false`; every other
method remains a safe no-op.

The world state should drive ambience, not the renderer:

```ts
audio.setScene("garden", { rain: true, timeOfDay: "evening" });
audio.setAmbience({ rain: false });
audio.setStudyActive(true); // soft start chime and a calmer music mix
audio.playSfx("study-complete");
```

The available places are `room`, `garden`, `cafe`, and `park`. Scene transitions
use a matched 1.35-second equal-power crossfade so travel neither hard-cuts nor
drops the sound bed.

The world renderer may avoid importing the singleton by emitting events:

```ts
window.dispatchEvent(
  new CustomEvent("komorebi:audio", {
    detail: { type: "footstep", surface: "tatami" },
  }),
);

window.dispatchEvent(
  new CustomEvent("komorebi:audio", {
    detail: { type: "place", valid: true },
  }),
);
```

Supported event details:

| `type` | Extra fields | Sound |
| --- | --- | --- |
| `footstep` | `surface`: `tatami`, `wood`, `stone`, or `grass` | Surface-specific step |
| `interact` | — | Gentle interaction chirp |
| `place` | `valid?: boolean` | Furniture landing or invalid buzz |
| `rotate` | — | Short mechanical rotation |
| `travel` | — | Filtered transition sweep |
| `ui` | `action?: hover \| confirm \| back` | Matching UI response |

For direct calls, `SoundEffect` also includes `place-pickup`, `purchase`,
`coin`, `study-start`, `study-complete`, `page-turn`, `door-open`, and
`notification`.

## Settings controls

```ts
audio.setVolume("master", 0.8);
audio.setVolume("music", 0.55);
audio.setVolume("ambience", 0.7);
audio.setVolume("sfx", 0.85);
audio.setMuted(true);
audio.toggleMuted();
```

Values are clamped to `0…1`. Mute and all bus volumes persist to
`localStorage` under `komorebi-house.audio.v1`. Construct an isolated engine
with `{ storageKey: null }` to disable persistence.

Settings UI can subscribe without depending on React:

```ts
const unsubscribe = audio.subscribe((snapshot) => {
  // snapshot.status: locked | starting | running | suspended | unavailable
  // snapshot also includes mute, volumes, scene, weather/time, and study state
});
```

Expose mute plus separate Music, Ambience, and Effects sliders. Keep a visible
"Enable sound" affordance while status is `locked` or `suspended`; never imply
that audio is broken before the user gesture.

## Lifecycle and failure behavior

- `suspend()` is suitable when the user explicitly pauses audio.
- `resume()` has the same gesture requirement as `unlock()`.
- Normal React component remounts should remove their event bindings but should
  not dispose the app-wide singleton.
- `dispose()` is final: it clears schedulers and random-event timers, fades and
  stops active sources, disconnects nodes, closes the context, and makes all
  later calls no-ops. Use it only when the whole game is permanently torn down.
- Background-tab scheduler throttling skips missed musical steps rather than
  playing a burst on return.
- All storage, context-resume, suspend, and close failures are contained. Visual
  gameplay never depends on audio success.

## Source map

- `audio-system.ts`: gesture gate, buses, persistence, public API, event bridge,
  context lifecycle, and graceful fallback.
- `music.ts`: original deterministic lo-fi composition and scheduler.
- `ambience.ts`: crossfaded place, weather, and time-of-day sound layers.
- `sfx.ts`: procedural UI, furnishing, economy, study, and traversal sounds.
- `primitives.ts`: envelopes, seeded randomness, noise, pitch, and safe cleanup.
- `types.ts`: the stable consumer contract.
