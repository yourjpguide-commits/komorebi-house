import {
  applyEnvelope,
  createNoiseBuffer,
  createSeededRandom,
  midiToHz,
  randomBetween,
  safeDisconnect,
  type RandomSource,
} from "./primitives";
import type { SoundEffect } from "./types";

const THROTTLE_MS: Partial<Record<SoundEffect, number>> = {
  "ui-hover": 45,
  "footstep-tatami": 105,
  "footstep-wood": 105,
  "footstep-stone": 105,
  "footstep-grass": 105,
  rotate: 65,
};

interface ToneOptions {
  at?: number;
  duration?: number;
  peak?: number;
  type?: OscillatorType;
  toFrequency?: number;
  pan?: number;
  filterFrequency?: number;
}

interface NoiseOptions {
  at?: number;
  duration?: number;
  peak?: number;
  filterType?: BiquadFilterType;
  frequency?: number;
  q?: number;
  pan?: number;
}

export class ProceduralSfx {
  private readonly context: AudioContext;
  private readonly destination: AudioNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly random: RandomSource;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private readonly lastPlayed = new Map<SoundEffect, number>();
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.destination = destination;
    this.random = createSeededRandom(0x53465821);
    this.noiseBuffer = createNoiseBuffer(context, 1.4, this.random);
  }

  play(effect: SoundEffect): void {
    if (this.disposed || this.context.state !== "running") return;
    const wallTime = Date.now();
    const throttle = THROTTLE_MS[effect] ?? 0;
    if (wallTime - (this.lastPlayed.get(effect) ?? 0) < throttle) return;
    this.lastPlayed.set(effect, wallTime);

    const at = this.context.currentTime + 0.008;
    switch (effect) {
      case "ui-hover":
        this.tone(880, {
          at,
          duration: 0.036,
          peak: 0.018,
          type: "sine",
          toFrequency: 970,
          filterFrequency: 2_400,
        });
        break;
      case "ui-confirm":
        this.tone(midiToHz(74), {
          at,
          duration: 0.09,
          peak: 0.045,
          type: "triangle",
        });
        this.tone(midiToHz(81), {
          at: at + 0.062,
          duration: 0.13,
          peak: 0.034,
          type: "sine",
        });
        break;
      case "ui-back":
        this.tone(570, {
          at,
          duration: 0.075,
          peak: 0.035,
          type: "triangle",
          toFrequency: 390,
        });
        break;
      case "interact":
        this.tone(494, {
          at,
          duration: 0.075,
          peak: 0.035,
          type: "triangle",
          toFrequency: 587,
        });
        this.noise({
          at,
          duration: 0.045,
          peak: 0.018,
          filterType: "bandpass",
          frequency: 1_800,
        });
        break;
      case "rotate":
        this.tone(410, {
          at,
          duration: 0.045,
          peak: 0.034,
          type: "square",
          toFrequency: 520,
          filterFrequency: 1_100,
        });
        break;
      case "travel":
        this.noise({
          at,
          duration: 0.32,
          peak: 0.055,
          filterType: "bandpass",
          frequency: 980,
          q: 0.45,
        });
        this.tone(196, {
          at,
          duration: 0.28,
          peak: 0.038,
          type: "sine",
          toFrequency: 294,
        });
        break;
      case "place-pickup":
        this.noise({
          at,
          duration: 0.065,
          peak: 0.052,
          filterType: "bandpass",
          frequency: 760,
          q: 0.7,
        });
        this.tone(230, {
          at,
          duration: 0.08,
          peak: 0.05,
          type: "triangle",
          toFrequency: 310,
          filterFrequency: 950,
        });
        break;
      case "place-drop":
        this.noise({
          at,
          duration: 0.1,
          peak: 0.072,
          filterType: "lowpass",
          frequency: 1_100,
        });
        this.tone(155, {
          at,
          duration: 0.13,
          peak: 0.072,
          type: "triangle",
          toFrequency: 92,
          filterFrequency: 620,
        });
        this.tone(312, {
          at: at + 0.012,
          duration: 0.07,
          peak: 0.022,
          type: "sine",
        });
        break;
      case "place-invalid":
        this.tone(156, {
          at,
          duration: 0.14,
          peak: 0.046,
          type: "square",
          toFrequency: 142,
          filterFrequency: 590,
        });
        this.tone(164, {
          at,
          duration: 0.14,
          peak: 0.025,
          type: "sawtooth",
          toFrequency: 150,
          filterFrequency: 520,
        });
        break;
      case "coin":
        this.coin(at, 1);
        break;
      case "purchase":
        this.coin(at, 0.85);
        [74, 78, 83].forEach((note, index) => {
          this.tone(midiToHz(note), {
            at: at + 0.045 + index * 0.072,
            duration: 0.16,
            peak: 0.028 - index * 0.003,
            type: index === 2 ? "sine" : "triangle",
            pan: -0.16 + index * 0.16,
          });
        });
        break;
      case "study-start":
        this.softChime([69, 74, 76], at, 0.09, 0.028);
        break;
      case "study-complete":
        this.softChime([74, 78, 81, 85], at, 0.082, 0.034);
        this.tone(midiToHz(69), {
          at,
          duration: 0.62,
          peak: 0.018,
          type: "sine",
          pan: -0.28,
        });
        break;
      case "page-turn":
        for (let index = 0; index < 3; index += 1) {
          this.noise({
            at: at + index * 0.032,
            duration: 0.11,
            peak: 0.025 - index * 0.004,
            filterType: "bandpass",
            frequency: 1_500 + index * 390,
            q: 0.55,
            pan: -0.35 + index * 0.3,
          });
        }
        break;
      case "door-open":
        this.noise({
          at,
          duration: 0.36,
          peak: 0.04,
          filterType: "bandpass",
          frequency: 460,
          q: 0.8,
          pan: 0.2,
        });
        this.tone(118, {
          at: at + 0.24,
          duration: 0.12,
          peak: 0.045,
          type: "triangle",
          toFrequency: 84,
          filterFrequency: 520,
          pan: 0.2,
        });
        break;
      case "footstep-tatami":
        this.footstep(at, "tatami");
        break;
      case "footstep-wood":
        this.footstep(at, "wood");
        break;
      case "footstep-stone":
        this.footstep(at, "stone");
        break;
      case "footstep-grass":
        this.footstep(at, "grass");
        break;
      case "notification":
        this.tone(midiToHz(78), {
          at,
          duration: 0.18,
          peak: 0.034,
          type: "sine",
          pan: -0.2,
        });
        this.tone(midiToHz(83), {
          at: at + 0.105,
          duration: 0.25,
          peak: 0.029,
          type: "sine",
          pan: 0.2,
        });
        break;
    }
  }

  dispose(fadeSeconds = 0): void {
    if (this.disposed) return;
    this.disposed = true;
    const stopAt = this.context.currentTime + Math.max(0, fadeSeconds);
    for (const source of this.sources) {
      try {
        source.stop(stopAt);
      } catch {
        // Already stopped.
      }
      if (fadeSeconds === 0) safeDisconnect(source);
    }
    if (fadeSeconds === 0) this.sources.clear();
    this.lastPlayed.clear();
  }

  private footstep(
    at: number,
    surface: "tatami" | "wood" | "stone" | "grass",
  ): void {
    const pan = randomBetween(this.random, -0.16, 0.16);
    if (surface === "tatami") {
      this.noise({
        at,
        duration: 0.09,
        peak: 0.042,
        filterType: "lowpass",
        frequency: 880,
        q: 0.55,
        pan,
      });
      this.tone(115, {
        at,
        duration: 0.075,
        peak: 0.022,
        type: "sine",
        toFrequency: 86,
        pan,
      });
      return;
    }

    if (surface === "wood") {
      this.tone(randomBetween(this.random, 175, 225), {
        at,
        duration: 0.075,
        peak: 0.054,
        type: "triangle",
        toFrequency: 105,
        filterFrequency: 790,
        pan,
      });
      this.noise({
        at,
        duration: 0.035,
        peak: 0.031,
        filterType: "bandpass",
        frequency: 1_420,
        q: 1.2,
        pan,
      });
      return;
    }

    if (surface === "stone") {
      this.noise({
        at,
        duration: 0.072,
        peak: 0.05,
        filterType: "bandpass",
        frequency: 1_950,
        q: 0.75,
        pan,
      });
      this.tone(randomBetween(this.random, 310, 390), {
        at,
        duration: 0.048,
        peak: 0.028,
        type: "triangle",
        toFrequency: 220,
        pan,
      });
      return;
    }

    for (let index = 0; index < 3; index += 1) {
      this.noise({
        at: at + index * 0.018,
        duration: 0.06,
        peak: 0.027 - index * 0.003,
        filterType: "bandpass",
        frequency: 1_050 + index * 360,
        q: 0.45,
        pan: pan + index * 0.04,
      });
    }
  }

  private coin(at: number, level: number): void {
    this.tone(1_720, {
      at,
      duration: 0.15,
      peak: 0.042 * level,
      type: "sine",
      toFrequency: 1_610,
      pan: -0.12,
    });
    this.tone(2_420, {
      at: at + 0.014,
      duration: 0.12,
      peak: 0.028 * level,
      type: "sine",
      toFrequency: 2_180,
      pan: 0.12,
    });
  }

  private softChime(
    notes: readonly number[],
    at: number,
    spacing: number,
    peak: number,
  ): void {
    notes.forEach((note, index) => {
      this.tone(midiToHz(note), {
        at: at + index * spacing,
        duration: 0.28 + index * 0.035,
        peak: peak * (1 - index * 0.08),
        type: index % 2 === 0 ? "triangle" : "sine",
        pan: -0.28 + (0.56 * index) / Math.max(1, notes.length - 1),
        filterFrequency: 2_800,
      });
    });
  }

  private tone(frequency: number, options: ToneOptions): void {
    const at = options.at ?? this.context.currentTime + 0.008;
    const duration = options.duration ?? 0.1;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), at);
    const destinationFrequency = options.toFrequency ?? frequency;
    if (destinationFrequency !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, destinationFrequency),
        at + duration,
      );
    }
    filter.type = "lowpass";
    filter.frequency.value = options.filterFrequency ?? 4_800;
    filter.Q.value = 0.45;
    pan.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
    applyEnvelope(
      gain.gain,
      at,
      duration,
      options.peak ?? 0.04,
      Math.min(0.008, duration * 0.2),
      duration * 0.66,
    );
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.025);
    this.track(oscillator, [filter, gain, pan]);
  }

  private noise(options: NoiseOptions): void {
    const at = options.at ?? this.context.currentTime + 0.008;
    const duration = options.duration ?? 0.09;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    source.buffer = this.noiseBuffer;
    filter.type = options.filterType ?? "bandpass";
    filter.frequency.value = options.frequency ?? 1_200;
    filter.Q.value = options.q ?? 0.6;
    pan.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
    applyEnvelope(
      gain.gain,
      at,
      duration,
      options.peak ?? 0.04,
      Math.min(0.008, duration * 0.15),
      duration * 0.7,
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.destination);
    source.start(
      at,
      randomBetween(this.random, 0, 1.1),
      duration + 0.018,
    );
    source.stop(at + duration + 0.022);
    this.track(source, [filter, gain, pan]);
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.sources.add(source);
    source.addEventListener(
      "ended",
      () => {
        this.sources.delete(source);
        safeDisconnect(source);
        for (const node of nodes) safeDisconnect(node);
      },
      { once: true },
    );
  }
}
