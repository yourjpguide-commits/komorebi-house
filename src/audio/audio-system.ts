import { ProceduralAmbience } from "./ambience";
import { GenerativeMusic } from "./music";
import {
  clamp01,
  createImpulseResponse,
  createSeededRandom,
  safeDisconnect,
  setParam,
} from "./primitives";
import { ProceduralSfx } from "./sfx";
import type {
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
} from "./types";

export const KOMOREBI_AUDIO_EVENT = "komorebi:audio";

const DEFAULT_VOLUMES: AudioVolumes = {
  master: 0.8,
  music: 0.58,
  ambience: 0.72,
  sfx: 0.82,
};

const DEFAULT_AMBIENCE: AmbienceOptions = {
  rain: false,
  timeOfDay: "day",
};

const DEFAULT_STORAGE_KEY = "komorebi-house.audio.v1";

interface PersistedSettings {
  muted?: boolean;
  volumes?: Partial<AudioVolumes>;
}

type AudioContextConstructor = new (
  contextOptions?: AudioContextOptions,
) => AudioContext;

type WebkitAudioGlobal = typeof globalThis & {
  webkitAudioContext?: AudioContextConstructor;
};

export class KomorebiAudioSystem implements AudioSystem {
  readonly supported: boolean;

  private status: AudioStatus;
  private muted: boolean;
  private volumes: AudioVolumes;
  private scene: AudioScene;
  private ambienceOptions: AmbienceOptions;
  private studyActive = false;
  private readonly storageKey: string | null;
  private readonly listeners = new Set<AudioListener>();
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private musicReverbSend: GainNode | null = null;
  private ambienceReverbSend: GainNode | null = null;
  private sfxReverbSend: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbFilter: BiquadFilterNode | null = null;
  private reverbReturn: GainNode | null = null;
  private music: GenerativeMusic | null = null;
  private ambience: ProceduralAmbience | null = null;
  private sfx: ProceduralSfx | null = null;
  private unlockPromise: Promise<boolean> | null = null;
  private readonly unbinders = new Set<() => void>();

  constructor(options: AudioSystemOptions = {}) {
    this.supported = getAudioContextConstructor() !== null;
    this.status = this.supported ? "locked" : "unavailable";
    this.storageKey =
      options.storageKey === undefined
        ? DEFAULT_STORAGE_KEY
        : options.storageKey;

    const persisted = this.readPersistedSettings();
    this.volumes = normalizeVolumes({
      ...DEFAULT_VOLUMES,
      ...persisted?.volumes,
      ...options.initialVolumes,
    });
    this.muted = options.muted ?? persisted?.muted ?? false;
    this.scene = options.initialScene ?? "room";
    this.ambienceOptions = {
      ...DEFAULT_AMBIENCE,
      ...options.initialAmbience,
    };
  }

  getSnapshot(): AudioSnapshot {
    return {
      supported: this.supported,
      status: this.status,
      muted: this.muted,
      volumes: { ...this.volumes },
      scene: this.scene,
      ambience: { ...this.ambienceOptions },
      studyActive: this.studyActive,
    };
  }

  subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  unlock(): Promise<boolean> {
    if (!this.supported || this.status === "disposed") {
      return Promise.resolve(false);
    }
    if (this.unlockPromise) return this.unlockPromise;

    this.unlockPromise = this.performUnlock().finally(() => {
      this.unlockPromise = null;
    });
    return this.unlockPromise;
  }

  bindUserGesture(target: EventTarget | undefined = defaultEventTarget()): () => void {
    if (!target || this.status === "disposed") return () => undefined;
    let active = true;

    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener("pointerdown", unlockFromGesture);
      target.removeEventListener("keydown", unlockFromGesture);
      this.unbinders.delete(cleanup);
    };
    const unlockFromGesture = () => {
      cleanup();
      void this.unlock();
    };

    target.addEventListener("pointerdown", unlockFromGesture, {
      once: true,
      passive: true,
    });
    target.addEventListener("keydown", unlockFromGesture, { once: true });
    this.unbinders.add(cleanup);
    return cleanup;
  }

  bindGameEvents(target: EventTarget | undefined = defaultEventTarget()): () => void {
    if (!target || this.status === "disposed") return () => undefined;
    let active = true;
    const onAudioEvent: EventListener = (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isGameAudioEvent(detail)) this.handleGameEvent(detail);
    };
    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener(KOMOREBI_AUDIO_EVENT, onAudioEvent);
      this.unbinders.delete(cleanup);
    };

    target.addEventListener(KOMOREBI_AUDIO_EVENT, onAudioEvent);
    this.unbinders.add(cleanup);
    return cleanup;
  }

  handleGameEvent(event: GameAudioEvent): void {
    switch (event.type) {
      case "footstep":
        this.playSfx(`footstep-${event.surface ?? "tatami"}`);
        break;
      case "interact":
        this.playSfx("interact");
        break;
      case "place":
        this.playSfx(event.valid === false ? "place-invalid" : "place-drop");
        break;
      case "rotate":
        this.playSfx("rotate");
        break;
      case "travel":
        this.playSfx("travel");
        break;
      case "ui":
        this.playSfx(`ui-${event.action ?? "confirm"}`);
        break;
    }
  }

  setScene(
    scene: AudioScene,
    options: Partial<AmbienceOptions> = {},
  ): void {
    if (this.status === "disposed") return;
    const nextOptions = { ...this.ambienceOptions, ...options };
    const changed =
      scene !== this.scene ||
      nextOptions.rain !== this.ambienceOptions.rain ||
      nextOptions.timeOfDay !== this.ambienceOptions.timeOfDay;
    this.scene = scene;
    this.ambienceOptions = nextOptions;
    if (changed) {
      this.ambience?.set(this.scene, this.ambienceOptions);
      this.emit();
    }
  }

  setAmbience(options: Partial<AmbienceOptions>): void {
    this.setScene(this.scene, options);
  }

  setStudyActive(active: boolean): void {
    if (this.status === "disposed" || active === this.studyActive) return;
    this.studyActive = active;
    this.music?.setStudyActive(active);
    if (active) this.sfx?.play("study-start");
    this.emit();
  }

  playSfx(effect: SoundEffect): void {
    if (this.status === "disposed" || this.muted) return;
    this.sfx?.play(effect);
  }

  setVolume(bus: AudioBus, value: number): void {
    if (this.status === "disposed") return;
    const normalized = clamp01(value);
    if (this.volumes[bus] === normalized) return;
    this.volumes = { ...this.volumes, [bus]: normalized };
    this.applyMix();
    this.persistSettings();
    this.emit();
  }

  setMuted(muted: boolean): void {
    if (this.status === "disposed" || this.muted === muted) return;
    this.muted = muted;
    this.applyMix();
    this.persistSettings();
    this.emit();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async suspend(): Promise<void> {
    if (!this.context || this.status === "disposed") return;
    try {
      await this.context.suspend();
      this.syncContextState();
    } catch {
      // Suspending audio is an optimization; failure is harmless.
    }
  }

  resume(): Promise<boolean> {
    return this.unlock();
  }

  dispose(): void {
    if (this.status === "disposed") return;

    for (const unbind of [...this.unbinders]) unbind();
    this.unbinders.clear();
    this.music?.dispose(0.08);
    this.ambience?.dispose();
    this.sfx?.dispose(0.14);
    this.music = null;
    this.ambience = null;
    this.sfx = null;

    const context = this.context;
    if (context) {
      context.removeEventListener("statechange", this.onContextStateChange);
    }
    const nodes: Array<AudioNode | null> = [
      this.musicGain,
      this.ambienceGain,
      this.sfxGain,
      this.masterGain,
      this.limiter,
      this.musicReverbSend,
      this.ambienceReverbSend,
      this.sfxReverbSend,
      this.reverb,
      this.reverbFilter,
      this.reverbReturn,
    ];
    const fadeSeconds = 0.14;
    if (this.masterGain && context && context.state !== "closed") {
      const now = context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(
        Math.max(0.0001, this.masterGain.gain.value),
        now,
      );
      this.masterGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + fadeSeconds,
      );
    }
    this.musicGain = null;
    this.ambienceGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.limiter = null;
    this.musicReverbSend = null;
    this.ambienceReverbSend = null;
    this.sfxReverbSend = null;
    this.reverb = null;
    this.reverbFilter = null;
    this.reverbReturn = null;
    this.context = null;
    this.status = "disposed";
    this.emit();
    this.listeners.clear();

    setTimeout(() => {
      for (const node of nodes) safeDisconnect(node);
      if (context && context.state !== "closed") {
        void context.close().catch(() => undefined);
      }
    }, Math.ceil((fadeSeconds + 0.04) * 1_000));
  }

  private async performUnlock(): Promise<boolean> {
    this.status = "starting";
    this.emit();

    try {
      if (!this.context) this.initializeGraph();
      const context = this.context;
      if (!context) {
        this.status = "unavailable";
        this.emit();
        return false;
      }

      if (context.state !== "running") await context.resume();
      this.warmUpOutput(context);
      this.startGenerators();
      this.syncContextState();
      return context.state === "running";
    } catch {
      // A resume can be rejected when unlock was not called directly inside a
      // user gesture. Keep the system retryable instead of breaking the game.
      this.status =
        this.context?.state === "closed"
          ? "unavailable"
          : this.context
            ? "suspended"
            : "locked";
      this.emit();
      return false;
    }
  }

  private initializeGraph(): void {
    const Constructor = getAudioContextConstructor();
    if (!Constructor) return;

    let context: AudioContext;
    try {
      context = new Constructor({ latencyHint: "interactive" });
    } catch {
      context = new Constructor();
    }

    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const ambienceGain = context.createGain();
    const sfxGain = context.createGain();
    const limiter = context.createDynamicsCompressor();
    const musicReverbSend = context.createGain();
    const ambienceReverbSend = context.createGain();
    const sfxReverbSend = context.createGain();
    const reverb = context.createConvolver();
    const reverbFilter = context.createBiquadFilter();
    const reverbReturn = context.createGain();

    limiter.threshold.value = -7;
    limiter.knee.value = 10;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    musicReverbSend.gain.value = 0.14;
    ambienceReverbSend.gain.value = 0.08;
    sfxReverbSend.gain.value = 0.16;
    reverb.buffer = createImpulseResponse(
      context,
      1.35,
      3.6,
      createSeededRandom(0x726f6f6d),
    );
    reverbFilter.type = "lowpass";
    reverbFilter.frequency.value = 4_300;
    reverbFilter.Q.value = 0.28;
    reverbReturn.gain.value = 0.38;

    musicGain.connect(masterGain);
    ambienceGain.connect(masterGain);
    sfxGain.connect(masterGain);
    musicGain.connect(musicReverbSend);
    ambienceGain.connect(ambienceReverbSend);
    sfxGain.connect(sfxReverbSend);
    musicReverbSend.connect(reverb);
    ambienceReverbSend.connect(reverb);
    sfxReverbSend.connect(reverb);
    reverb.connect(reverbFilter);
    reverbFilter.connect(reverbReturn);
    reverbReturn.connect(masterGain);
    masterGain.connect(limiter);
    limiter.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.musicGain = musicGain;
    this.ambienceGain = ambienceGain;
    this.sfxGain = sfxGain;
    this.limiter = limiter;
    this.musicReverbSend = musicReverbSend;
    this.ambienceReverbSend = ambienceReverbSend;
    this.sfxReverbSend = sfxReverbSend;
    this.reverb = reverb;
    this.reverbFilter = reverbFilter;
    this.reverbReturn = reverbReturn;
    context.addEventListener("statechange", this.onContextStateChange);
    this.applyMix(true);
  }

  private startGenerators(): void {
    const context = this.context;
    if (!context || !this.musicGain || !this.ambienceGain || !this.sfxGain) {
      return;
    }

    if (!this.music) {
      this.music = new GenerativeMusic(context, this.musicGain);
      this.music.setStudyActive(this.studyActive);
      this.music.start();
    }
    if (!this.ambience) {
      this.ambience = new ProceduralAmbience(context, this.ambienceGain);
      this.ambience.set(this.scene, this.ambienceOptions);
    }
    if (!this.sfx) {
      this.sfx = new ProceduralSfx(context, this.sfxGain);
    }
  }

  private warmUpOutput(context: AudioContext): void {
    const buffer = context.createBuffer(1, 1, context.sampleRate);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    source.addEventListener(
      "ended",
      () => safeDisconnect(source),
      { once: true },
    );
  }

  private applyMix(immediate = false): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    const apply = (node: GainNode | null, value: number) => {
      if (!node) return;
      const gain = volumeCurve(value);
      if (immediate) {
        node.gain.cancelScheduledValues(now);
        node.gain.setValueAtTime(gain, now);
      } else {
        setParam(node.gain, gain, now);
      }
    };

    apply(this.masterGain, this.muted ? 0 : this.volumes.master);
    apply(this.musicGain, this.volumes.music);
    apply(this.ambienceGain, this.volumes.ambience);
    apply(this.sfxGain, this.volumes.sfx);
  }

  private readonly onContextStateChange = (): void => {
    this.syncContextState();
  };

  private syncContextState(): void {
    if (this.status === "disposed" || !this.context) return;
    if (this.context.state === "running") {
      this.status = "running";
    } else if (this.context.state === "suspended" || this.context.state === "interrupted") {
      this.status = "suspended";
    } else {
      this.status = "unavailable";
    }
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private readPersistedSettings(): PersistedSettings | null {
    if (!this.storageKey) return null;
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as unknown;
      if (!value || typeof value !== "object") return null;
      const candidate = value as PersistedSettings;
      return {
        muted:
          typeof candidate.muted === "boolean" ? candidate.muted : undefined,
        volumes: candidate.volumes
          ? normalizePartialVolumes(candidate.volumes)
          : undefined,
      };
    } catch {
      return null;
    }
  }

  private persistSettings(): void {
    if (!this.storageKey) return;
    try {
      const value: PersistedSettings = {
        muted: this.muted,
        volumes: this.volumes,
      };
      globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(value));
    } catch {
      // Storage can be blocked in privacy modes; audio still works in-memory.
    }
  }
}

export function createAudioSystem(
  options: AudioSystemOptions = {},
): AudioSystem {
  return new KomorebiAudioSystem(options);
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  const globals = globalThis as WebkitAudioGlobal;
  return globals.AudioContext ?? globals.webkitAudioContext ?? null;
}

function defaultEventTarget(): EventTarget | undefined {
  return typeof window === "undefined" ? undefined : window;
}

function volumeCurve(value: number): number {
  const normalized = clamp01(value);
  return normalized * normalized;
}

function normalizeVolumes(volumes: AudioVolumes): AudioVolumes {
  return {
    master: clamp01(volumes.master),
    music: clamp01(volumes.music),
    ambience: clamp01(volumes.ambience),
    sfx: clamp01(volumes.sfx),
  };
}

function normalizePartialVolumes(
  volumes: Partial<AudioVolumes>,
): Partial<AudioVolumes> {
  const result: Partial<AudioVolumes> = {};
  for (const bus of ["master", "music", "ambience", "sfx"] as const) {
    const value = volumes[bus];
    if (typeof value === "number") result[bus] = clamp01(value);
  }
  return result;
}

function isGameAudioEvent(value: unknown): value is GameAudioEvent {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const candidate = value as {
    type?: unknown;
    surface?: unknown;
    valid?: unknown;
    action?: unknown;
  };

  switch (candidate.type) {
    case "footstep":
      return (
        candidate.surface === undefined ||
        isFootstepSurface(candidate.surface)
      );
    case "interact":
    case "rotate":
    case "travel":
      return true;
    case "place":
      return (
        candidate.valid === undefined || typeof candidate.valid === "boolean"
      );
    case "ui":
      return (
        candidate.action === undefined ||
        candidate.action === "hover" ||
        candidate.action === "confirm" ||
        candidate.action === "back"
      );
    default:
      return false;
  }
}

function isFootstepSurface(value: unknown): value is FootstepSurface {
  return (
    value === "tatami" ||
    value === "wood" ||
    value === "stone" ||
    value === "grass"
  );
}
