import { createAudioSystem } from "./audio-system";
import type { AudioSystem } from "./types";

const singletonKey = "__KOMOREBI_HOUSE_AUDIO_SYSTEM__";
const globals = globalThis as typeof globalThis & {
  [singletonKey]?: AudioSystem;
};

/**
 * App-wide lazy audio engine. Importing this singleton does not allocate an
 * AudioContext; call `audio.unlock()` inside a user gesture.
 *
 * The global slot prevents Vite hot reloads from leaving orphaned schedulers.
 */
export const audio: AudioSystem =
  globals[singletonKey] ??
  (globals[singletonKey] = createAudioSystem());

export {
  createAudioSystem,
  KomorebiAudioSystem,
  KOMOREBI_AUDIO_EVENT,
} from "./audio-system";
export { AUDIO_SCENES, SOUND_EFFECTS } from "./types";
export type {
  AmbienceOptions,
  AudioBus,
  AudioListener,
  AudioScene,
  AudioSnapshot,
  AudioStatus,
  AudioSystem,
  AudioSystemOptions,
  AudioVolumes,
  FootstepSurface,
  GameAudioEvent,
  SoundEffect,
  TimeOfDay,
  UiAudioAction,
} from "./types";
