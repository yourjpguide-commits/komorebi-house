export const AUDIO_SCENES = ["room", "garden", "cafe", "park"] as const;

export type AudioScene = (typeof AUDIO_SCENES)[number];

export type TimeOfDay = "day" | "evening" | "night";

export type AudioBus = "master" | "music" | "ambience" | "sfx";

export type FootstepSurface = "tatami" | "wood" | "stone" | "grass";

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
}

export type UiAudioAction = "hover" | "confirm" | "back";

export type GameAudioEvent =
  | { type: "footstep"; surface?: FootstepSurface }
  | { type: "interact" }
  | { type: "place"; valid?: boolean }
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
   * Adds one-shot pointer/key listeners that call unlock from the gesture.
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
  playSfx(effect: SoundEffect): void;
  setVolume(bus: AudioBus, value: number): void;
  setMuted(muted: boolean): void;
  toggleMuted(): boolean;
  suspend(): Promise<void>;
  resume(): Promise<boolean>;
  dispose(): void;
}
