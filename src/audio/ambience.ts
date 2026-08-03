import {
  applyEnvelope,
  choose,
  createNoiseBuffer,
  createSeededRandom,
  randomBetween,
  safeDisconnect,
  safeStop,
  type RandomSource,
} from "./primitives";
import type { AmbienceOptions, AudioScene } from "./types";

const SCENE_SEEDS: Record<AudioScene, number> = {
  room: 0x726f6f6d,
  garden: 0x67617264,
  cafe: 0x63616665,
  park: 0x7061726b,
};

const CROSSFADE_SECONDS = 1.35;
const CROSSFADE_SAMPLES = 64;

export class ProceduralAmbience {
  private readonly context: AudioContext;
  private readonly destination: AudioNode;
  private layer: AmbienceLayer | null = null;
  private layerKey: string | null = null;
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.destination = destination;
  }

  set(scene: AudioScene, options: AmbienceOptions): void {
    if (this.disposed) return;
    const nextKey = `${scene}:${options.rain ? "rain" : "dry"}:${options.timeOfDay}`;
    if (nextKey === this.layerKey) return;
    const next = new AmbienceLayer(
      this.context,
      this.destination,
      scene,
      options,
    );
    next.start();
    const previous = this.layer;
    this.layer = next;
    this.layerKey = nextKey;
    previous?.dispose(CROSSFADE_SECONDS);
  }

  dispose(fadeSeconds = 0.15): void {
    if (this.disposed) return;
    this.disposed = true;
    this.layer?.dispose(fadeSeconds);
    this.layer = null;
    this.layerKey = null;
  }
}

class AmbienceLayer {
  private readonly context: AudioContext;
  private readonly output: GainNode;
  private readonly scene: AudioScene;
  private readonly options: AmbienceOptions;
  private readonly random: RandomSource;
  private readonly noiseBuffer: AudioBuffer;
  private readonly nodes = new Set<AudioNode>();
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(
    context: AudioContext,
    destination: AudioNode,
    scene: AudioScene,
    options: AmbienceOptions,
  ) {
    this.context = context;
    this.scene = scene;
    this.options = options;
    const optionSeed =
      (options.rain ? 0x13579bdf : 0) ^
      (options.timeOfDay === "night"
        ? 0x2468ace0
        : options.timeOfDay === "evening"
          ? 0x10293847
          : 0);
    this.random = createSeededRandom(SCENE_SEEDS[scene] ^ optionSeed);
    this.noiseBuffer = createNoiseBuffer(context, 3.25, this.random);
    this.output = context.createGain();
    this.output.gain.value = 0.0001;
    this.output.connect(destination);
    this.nodes.add(this.output);
  }

  start(): void {
    if (this.disposed) return;

    switch (this.scene) {
      case "room":
        this.startRoom();
        break;
      case "garden":
        this.startGarden();
        break;
      case "cafe":
        this.startCafe();
        break;
      case "park":
        this.startPark();
        break;
    }

    if (this.options.rain) this.startRain();
    if (this.options.timeOfDay === "night") {
      this.startNight();
    } else if (this.options.timeOfDay === "evening") {
      this.startEvening();
    }

    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueCurveAtTime(
      createEqualPowerCurve("in"),
      now,
      CROSSFADE_SECONDS,
    );
  }

  dispose(fadeSeconds: number): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();

    if (fadeSeconds <= 0) {
      this.cleanup();
      return;
    }

    const now = this.context.currentTime;
    const currentLevel = Math.max(0, this.output.gain.value);
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueCurveAtTime(
      createEqualPowerCurve("out", currentLevel),
      now,
      fadeSeconds,
    );

    const cleanupTimer = setTimeout(() => {
      this.cleanup();
    }, Math.ceil((fadeSeconds + 0.08) * 1_000));
    this.timers.add(cleanupTimer);
  }

  private cleanup(): void {
    for (const source of this.sources) safeStop(source);
    this.sources.clear();
    for (const node of this.nodes) safeDisconnect(node);
    this.nodes.clear();
  }

  private startRoom(): void {
    this.addNoiseBed("lowpass", 740, 0.55, 0.0065, 0.065, 0.002);
    this.addHum(57, 0.0045, 0.03);
    this.addHum(114, 0.0017, 0.05);
    this.scheduleRecurring(3.8, 7.4, () => this.playWoodTick());
  }

  private startGarden(): void {
    this.addNoiseBed("bandpass", 610, 0.48, 0.022, 0.083, 0.012);
    this.addNoiseBed("highpass", 3_200, 0.3, 0.005, 0.19, 0.002);
    this.scheduleRecurring(
      this.options.rain ? 9 : 4.5,
      this.options.rain ? 21 : 11.5,
      () => this.playBird(),
    );
    this.scheduleRecurring(
      this.options.rain ? 12 : 8,
      this.options.rain ? 24 : 17,
      () => this.playBambooKnock(),
    );
  }

  private startCafe(): void {
    this.addNoiseBed("bandpass", 360, 0.7, 0.013, 0.037, 0.004);
    this.addNoiseBed("bandpass", 820, 0.6, 0.0085, 0.061, 0.003);
    this.addHum(49, 0.003, 0.027);
    this.scheduleRecurring(3.8, 9.5, () => this.playCupClink());
    this.scheduleRecurring(7.5, 16, () => this.playSteam());
  }

  private startPark(): void {
    this.addNoiseBed("bandpass", 760, 0.42, 0.019, 0.072, 0.011);
    this.addNoiseBed("highpass", 2_850, 0.28, 0.004, 0.14, 0.002);
    this.scheduleRecurring(
      this.options.rain ? 8 : 3.5,
      this.options.rain ? 19 : 9.5,
      () => this.playBird(),
    );
    this.scheduleRecurring(
      this.options.rain ? 13 : 9,
      this.options.rain ? 27 : 20,
      () => this.playLeafScatter(),
    );
  }

  private startRain(): void {
    // Two complementary bands read as rain without using a recording: the
    // lower band is the roof/window wash, the upper band is individual drops.
    this.addNoiseBed("bandpass", 1_100, 0.42, 0.038, 0.055, 0.009);
    this.addNoiseBed("highpass", 4_800, 0.22, 0.018, 0.11, 0.004);
    this.scheduleRecurring(0.75, 2.25, () => this.playRainDrop());
  }

  private startNight(): void {
    this.addNoiseBed("highpass", 5_600, 0.25, 0.0027, 0.21, 0.001);
    this.scheduleRecurring(1.4, 4.1, () => this.playCricket());
  }

  private startEvening(): void {
    if (this.scene === "garden" || this.scene === "park") {
      this.scheduleRecurring(4.5, 9, () => this.playEveningInsect());
    }
  }

  private addNoiseBed(
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
    level: number,
    movementRate: number,
    movementDepth: number,
  ): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const depth = this.context.createGain();

    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.value = level;
    lfo.type = "sine";
    lfo.frequency.value = movementRate;
    depth.gain.value = Math.min(level * 0.75, movementDepth);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    lfo.connect(depth);
    depth.connect(gain.gain);

    source.start(0, randomBetween(this.random, 0, 2.8));
    lfo.start();
    this.sources.add(source);
    this.sources.add(lfo);
    this.nodes.add(filter);
    this.nodes.add(gain);
    this.nodes.add(depth);
  }

  private addHum(frequency: number, level: number, movementRate: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const depth = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = level;
    lfo.type = "sine";
    lfo.frequency.value = movementRate;
    depth.gain.value = level * 0.34;
    oscillator.connect(gain);
    gain.connect(this.output);
    lfo.connect(depth);
    depth.connect(gain.gain);
    oscillator.start();
    lfo.start();
    this.sources.add(oscillator);
    this.sources.add(lfo);
    this.nodes.add(gain);
    this.nodes.add(depth);
  }

  private scheduleRecurring(
    minimumSeconds: number,
    maximumSeconds: number,
    callback: () => void,
  ): void {
    if (this.disposed) return;
    const delay = randomBetween(this.random, minimumSeconds, maximumSeconds);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.disposed) return;
      if (this.context.state === "running") callback();
      this.scheduleRecurring(minimumSeconds, maximumSeconds, callback);
    }, delay * 1_000);
    this.timers.add(timer);
  }

  private playBird(): void {
    const base = choose(this.random, [1_120, 1_270, 1_430, 1_610]);
    const at = this.context.currentTime + 0.01;
    const notes = this.random() > 0.45 ? 3 : 2;
    for (let index = 0; index < notes; index += 1) {
      const offset = index * randomBetween(this.random, 0.075, 0.115);
      const frequency = base * choose(this.random, [1, 1.125, 1.25]);
      this.playChirp(
        at + offset,
        frequency,
        frequency * randomBetween(this.random, 1.08, 1.22),
        0.09,
        0.009,
        randomBetween(this.random, -0.7, 0.7),
      );
    }
  }

  private playCricket(): void {
    const at = this.context.currentTime + 0.01;
    const base = randomBetween(this.random, 3_600, 4_900);
    const chirps = 3 + Math.floor(this.random() * 4);
    for (let index = 0; index < chirps; index += 1) {
      this.playChirp(
        at + index * 0.082,
        base,
        base * 1.015,
        0.045,
        0.0045,
        randomBetween(this.random, -0.72, 0.72),
        "square",
      );
    }
  }

  private playEveningInsect(): void {
    const base = randomBetween(this.random, 2_400, 3_300);
    this.playChirp(
      this.context.currentTime + 0.01,
      base,
      base * 0.94,
      0.34,
      0.0032,
      randomBetween(this.random, -0.8, 0.8),
      "triangle",
    );
  }

  private playChirp(
    at: number,
    from: number,
    to: number,
    duration: number,
    peak: number,
    panPosition: number,
    type: OscillatorType = "sine",
  ): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
    pan.pan.value = panPosition;
    applyEnvelope(gain.gain, at, duration, peak, 0.009, duration * 0.44);
    oscillator.connect(gain);
    gain.connect(pan);
    pan.connect(this.output);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    this.trackTransient(oscillator, [gain, pan]);
  }

  private playWoodTick(): void {
    const at = this.context.currentTime + 0.01;
    this.playPercussiveTone(
      at,
      randomBetween(this.random, 620, 760),
      0.035,
      0.008,
      "triangle",
      randomBetween(this.random, -0.4, 0.4),
    );
    this.playPercussiveTone(
      at + 0.044,
      randomBetween(this.random, 410, 510),
      0.028,
      0.0045,
      "sine",
      randomBetween(this.random, -0.4, 0.4),
    );
  }

  private playBambooKnock(): void {
    const at = this.context.currentTime + 0.01;
    this.playPercussiveTone(
      at,
      268,
      0.13,
      0.013,
      "triangle",
      randomBetween(this.random, -0.65, 0.65),
    );
    this.playPercussiveTone(
      at + 0.018,
      536,
      0.07,
      0.004,
      "sine",
      randomBetween(this.random, -0.65, 0.65),
    );
  }

  private playCupClink(): void {
    const at = this.context.currentTime + 0.01;
    const pan = randomBetween(this.random, -0.72, 0.72);
    this.playPercussiveTone(at, 1_680, 0.12, 0.0075, "sine", pan);
    this.playPercussiveTone(at + 0.012, 2_310, 0.09, 0.0048, "sine", pan);
  }

  private playSteam(): void {
    const at = this.context.currentTime + 0.01;
    this.playNoiseTransient(
      at,
      randomBetween(this.random, 0.35, 0.85),
      0.008,
      "highpass",
      4_500,
      randomBetween(this.random, -0.65, 0.65),
    );
  }

  private playLeafScatter(): void {
    const at = this.context.currentTime + 0.01;
    const pan = randomBetween(this.random, -0.75, 0.75);
    for (let index = 0; index < 4; index += 1) {
      this.playNoiseTransient(
        at + index * 0.065,
        0.09,
        0.004,
        "bandpass",
        randomBetween(this.random, 1_200, 2_400),
        pan + index * 0.08,
      );
    }
  }

  private playRainDrop(): void {
    const at = this.context.currentTime + 0.01;
    const pan = randomBetween(this.random, -0.85, 0.85);
    const frequency = randomBetween(this.random, 1_150, 2_850);
    this.playPercussiveTone(
      at,
      frequency,
      randomBetween(this.random, 0.045, 0.11),
      randomBetween(this.random, 0.002, 0.006),
      "sine",
      pan,
    );
  }

  private playPercussiveTone(
    at: number,
    frequency: number,
    duration: number,
    peak: number,
    type: OscillatorType,
    panPosition: number,
  ): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequency * 0.83),
      at + duration,
    );
    pan.pan.value = Math.max(-1, Math.min(1, panPosition));
    applyEnvelope(gain.gain, at, duration, peak, 0.0025, duration * 0.78);
    oscillator.connect(gain);
    gain.connect(pan);
    pan.connect(this.output);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    this.trackTransient(oscillator, [gain, pan]);
  }

  private playNoiseTransient(
    at: number,
    duration: number,
    peak: number,
    filterType: BiquadFilterType,
    frequency: number,
    panPosition: number,
  ): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.72;
    pan.pan.value = Math.max(-1, Math.min(1, panPosition));
    applyEnvelope(gain.gain, at, duration, peak, 0.008, duration * 0.64);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.output);
    source.start(at, randomBetween(this.random, 0, 2.6), duration + 0.02);
    source.stop(at + duration + 0.025);
    this.trackTransient(source, [filter, gain, pan]);
  }

  private trackTransient(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
  ): void {
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

function createEqualPowerCurve(
  direction: "in" | "out",
  level = 1,
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(CROSSFADE_SAMPLES);
  for (let index = 0; index < curve.length; index += 1) {
    const progress = index / (curve.length - 1);
    const gain =
      direction === "in"
        ? Math.sin(progress * Math.PI * 0.5)
        : Math.cos(progress * Math.PI * 0.5);
    curve[index] = gain * level;
  }
  return curve;
}
