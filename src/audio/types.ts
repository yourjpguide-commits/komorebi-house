export const AUDIO_SCENES = ["room", "garden", "cafe", "park"] as const;

export type AudioScene = (typeof AUDIO_SCENES)[number];

export type TimeOfDay = "day" | "evening" | "night";

export type AudioBus = "master" | "music" | "ambience" | "sfx";

export type FootstepSurface = "tatami" | "wood" | "stone" | "grass";

export type PlacementPhase = "pickup" | "drop";

export type PlacementWeight = "light" | "medium" | "heavy";

export const SOUND_EFFECTS = [
  "ui-hover",
  "ui-confirm",
  "ui-back",
  "interact",
  "rotate",
  "travel",
  "place-pickup",
  "place-drop",
  "place-invalid",
  "purchase",
  "coin",
  "study-start",
  "study-complete",
  "page-turn",
  "door-open",
  "footstep-tatami",
  "footstep-wood",
  "footstep-stone",
  "footstep-grass",
  "notification",
] as const;

export type SoundEffect = (typeof SOUND_EFFECTS)[number];

export interface AudioVolumes {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
}

export interface AmbienceOptions {
  rain: boolean;
  timeOfDay: TimeOfDay;
}

export type AudioStatus =
  | "locked"
  | "starting"
  | "running"
  | "suspended"
  | "unavailable"
  | "disposed";

export interface AudioSnapshot {
  supported: boolean;
  status: AudioStatus;
  muted: boolean;
  volumes: AudioVolumes;
  scene: AudioScene;
  ambience: AmbienceOptions;
  studyActive: boolean;
  /** True only when the lifecycle controller, rather than the player, paused audio. */
  visibilityPaused: boolean;
}

export type UiAudioAction = "hover" | "confirm" | "back";

export interface FootstepCue {
  surface?: FootstepSurface;
  /** Normalized physical force, not character speed. */
  intensity?: number;
  /** Normalized screen position from -1 (left) to 1 (right). */
  pan?: number;
}

export interface PlacementCue {
  phase?: PlacementPhase;
  valid?: boolean;
  weight?: PlacementWeight;
  pan?: number;
}

export type GameAudioEvent =
  | ({ type: "footstep" } & FootstepCue)
  | { type: "interact" }
  | ({ type: "place" } & PlacementCue)
  | { type: "rotate" }
  | { type: "travel" }
  | { type: "ui"; action?: UiAudioAction };

export interface AudioSystemOptions {
  initialScene?: AudioScene;
  initialAmbience?: Partial<AmbienceOptions>;
  initialVolumes?: Partial<AudioVolumes>;
  muted?: boolean;
  /**
   * Volume/mute settings are persisted by default. Pass `null` to opt out.
   */
  storageKey?: string | null;
}

export type AudioListener = (snapshot: AudioSnapshot) => void;

export interface AudioSystem {
  readonly supported: boolean;
  getSnapshot(): AudioSnapshot;
  subscribe(listener: AudioListener): () => void;
  /**
   * Must be called directly from a pointer or keyboard handler. Resolves to
   * false when WebAudio is unavailable or the browser rejects the unlock.
   */
  unlock(): Promise<boolean>;
  /**
   * Adds low-cost pointer/key recovery plus visibility lifecycle listeners.
   * The returned cleanup owns all of those listeners.
   */
  bindUserGesture(target?: EventTarget): () => void;
  /**
   * Maps `komorebi:audio` CustomEvents from the world renderer to procedural
   * sound effects.
   */
  bindGameEvents(target?: EventTarget): () => void;
  handleGameEvent(event: GameAudioEvent): void;
  setScene(scene: AudioScene, options?: Partial<AmbienceOptions>): void;
  setAmbience(options: Partial<AmbienceOptions>): void;
  setStudyActive(active: boolean): void;
  /** Play exactly once from an animation foot-contact callback. */
  playFootstep(cue?: FootstepCue): void;
  /** Play exactly once when placement state commits, never on pointer move. */
  playPlacementCue(cue?: PlacementCue): void;
  playSfx(effect: SoundEffect): void;
  setVolume(bus: AudioBus, value: number): void;
  setMuted(muted: boolean): void;
  toggleMuted(): boolean;
  suspend(): Promise<void>;
  resume(): Promise<boolean>;
  /**
   * Immediately stops owned generators, removes bindings, and initiates
   * context close. A later app-level bind starts a fresh lifecycle.
   */
  dispose(): void;
}
