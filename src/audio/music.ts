import {
  applyEnvelope,
  choose,
  createNoiseBuffer,
  createSeededRandom,
  midiToHz,
  randomBetween,
  safeDisconnect,
  safeStop,
  type RandomSource,
} from "./primitives";
import type { AudioScene } from "./types";

const TEMPO = 72;
const EIGHTH_NOTE_SECONDS = 60 / TEMPO / 2;
const SCHEDULE_AHEAD_SECONDS = 0.22;
const SCHEDULER_INTERVAL_MS = 32;
const LOCATION_TRANSITION_SECONDS = 1.35;

const LOCATION_MIX: Record<
  AudioScene,
  { gain: number; cutoff: number; flutter: number }
> = {
  room: { gain: 0.84, cutoff: 4_200, flutter: 0.00042 },
  garden: { gain: 0.73, cutoff: 4_900, flutter: 0.00024 },
  cafe: { gain: 0.81, cutoff: 3_550, flutter: 0.00054 },
  park: { gain: 0.7, cutoff: 5_200, flutter: 0.0002 },
};

interface Chord {
  bass: number;
  voices: readonly number[];
}

/**
 * An original eight-bar progression. It intentionally has no fixed lead
 * melody: the small upper notes are chosen by a seeded generative rule.
 */
const CHORDS: readonly Chord[] = [
  { bass: 50, voices: [62, 66, 69, 73, 76] }, // Dmaj9
  { bass: 49, voices: [61, 66, 68, 71, 76] }, // C#7sus(add9)
  { bass: 47, voices: [59, 62, 66, 69, 73] }, // Bm9
  { bass: 45, voices: [57, 61, 64, 66, 69] }, // F#m7/A
  { bass: 43, voices: [59, 62, 66, 69, 71] }, // Gmaj9
  { bass: 43, voices: [58, 62, 64, 69, 74] }, // Gm6/9
  { bass: 45, voices: [61, 62, 64, 66, 69] }, // Dmaj9/A
  { bass: 45, voices: [57, 62, 66, 67, 71] }, // A13sus
] as const;

const UPPER_NOTES = [74, 76, 78, 81, 83, 85, 88] as const;

export class GenerativeMusic {
  private readonly context: AudioContext;
  private readonly output: GainNode;
  private readonly toneFilter: BiquadFilterNode;
  private readonly flutterDelay: DelayNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly random: RandomSource;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private bedSource: AudioBufferSourceNode | null = null;
  private flutterSource: OscillatorNode | null = null;
  private flutterDepth: GainNode | null = null;
  private nextStepAt = 0;
  private step = 0;
  private scene: AudioScene = "room";
  private studyActive = false;
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = 0.84;

    this.toneFilter = context.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.frequency.value = 4_200;
    this.toneFilter.Q.value = 0.35;

    const softClip = context.createDynamicsCompressor();
    softClip.threshold.value = -22;
    softClip.knee.value = 18;
    softClip.ratio.value = 3;
    softClip.attack.value = 0.018;
    softClip.release.value = 0.24;

    this.flutterDelay = context.createDelay(0.03);
    this.flutterDelay.delayTime.value = 0.008;
    this.toneFilter.connect(this.flutterDelay);
    this.flutterDelay.connect(softClip);
    softClip.connect(this.output);
    this.output.connect(destination);

    this.random = createSeededRandom(0x4b4f4d4f);
    this.noiseBuffer = createNoiseBuffer(
      context,
      2.5,
      createSeededRandom(0x54415045),
    );
  }

  start(): void {
    if (this.disposed || this.schedulerTimer !== null) return;

    this.startLofiBed();
    this.nextStepAt = this.context.currentTime + 0.055;
    this.step = 0;
    this.schedule();
    this.schedulerTimer = setInterval(
      () => this.schedule(),
      SCHEDULER_INTERVAL_MS,
    );
  }

  setStudyActive(active: boolean): void {
    this.studyActive = active;
    this.applyLocationMix(0.6);
  }

  /**
   * Morph the single original music bed to the current place. Keeping one
   * scheduler avoids doubled notes during travel while ambience performs the
   * audible equal-power crossfade around it.
   */
  setScene(
    scene: AudioScene,
    transitionSeconds = LOCATION_TRANSITION_SECONDS,
  ): void {
    if (this.disposed || scene === this.scene) return;
    this.scene = scene;
    this.applyLocationMix(transitionSeconds);
  }

  private applyLocationMix(transitionSeconds: number): void {
    if (this.disposed) return;
    const now = this.context.currentTime;
    const seconds = Math.max(0, transitionSeconds);
    const profile = LOCATION_MIX[this.scene];
    const focusScale = this.studyActive ? 0.86 : 1;

    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(this.output.gain.value, now);
    this.toneFilter.frequency.cancelScheduledValues(now);
    this.toneFilter.frequency.setValueAtTime(
      Math.max(20, this.toneFilter.frequency.value),
      now,
    );
    if (seconds === 0) {
      this.output.gain.setValueAtTime(profile.gain * focusScale, now);
      this.toneFilter.frequency.setValueAtTime(profile.cutoff, now);
    } else {
      this.output.gain.linearRampToValueAtTime(
        profile.gain * focusScale,
        now + seconds,
      );
      this.toneFilter.frequency.exponentialRampToValueAtTime(
        profile.cutoff,
        now + seconds,
      );
    }

    if (this.flutterDepth) {
      this.flutterDepth.gain.cancelScheduledValues(now);
      this.flutterDepth.gain.setValueAtTime(
        Math.max(0.00001, this.flutterDepth.gain.value),
        now,
      );
      if (seconds === 0) {
        this.flutterDepth.gain.setValueAtTime(profile.flutter, now);
      } else {
        this.flutterDepth.gain.exponentialRampToValueAtTime(
          profile.flutter,
          now + seconds,
        );
      }
    }
  }

  dispose(fadeSeconds = 0.18): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    if (fadeSeconds <= 0) {
      this.output.gain.setValueAtTime(0.0001, now);
    } else {
      this.output.gain.setValueAtTime(this.output.gain.value, now);
      this.output.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
    }

    const stopAt = now + Math.max(0, fadeSeconds);
    for (const source of this.sources) {
      safeStop(source, stopAt);
    }
    this.sources.clear();
    safeStop(this.bedSource, stopAt);
    safeStop(this.flutterSource, stopAt);

    const cleanup = () => {
      safeDisconnect(this.bedSource);
      safeDisconnect(this.flutterSource);
      safeDisconnect(this.flutterDepth);
      safeDisconnect(this.toneFilter);
      safeDisconnect(this.flutterDelay);
      safeDisconnect(this.output);
      this.bedSource = null;
      this.flutterSource = null;
      this.flutterDepth = null;
    };
    if (fadeSeconds <= 0) cleanup();
    else setTimeout(cleanup, Math.ceil((fadeSeconds + 0.1) * 1_000));
  }

  private schedule(): void {
    if (this.disposed) return;

    const now = this.context.currentTime;
    if (this.nextStepAt < now - 0.5) {
      // A backgrounded tab may throttle timers. Skip missed notes instead of
      // dumping a whole bar into the graph at once.
      this.nextStepAt = now + 0.04;
    }

    while (this.nextStepAt < now + SCHEDULE_AHEAD_SECONDS) {
      const stepInBar = this.step % 8;
      const bar = Math.floor(this.step / 8);
      const chord = CHORDS[bar % CHORDS.length] as Chord;
      const swing = stepInBar % 2 === 1 ? 0.026 : 0;
      const at = this.nextStepAt + swing;

      if (stepInBar === 0) {
        this.scheduleChord(chord, at);
        this.scheduleBass(chord.bass, at, EIGHTH_NOTE_SECONDS * 3.2);
        this.scheduleKick(at, this.studyActive ? 0.055 : 0.075);
      } else if (stepInBar === 4) {
        this.scheduleKick(at, this.studyActive ? 0.035 : 0.055);
      }

      if (stepInBar === 2 || stepInBar === 6) {
        this.scheduleBrush(at, this.studyActive ? 0.024 : 0.038);
      }

      if (!this.studyActive || stepInBar % 2 === 0) {
        this.scheduleHat(at, stepInBar === 0 ? 0.022 : 0.013);
      }

      if (stepInBar === 5) {
        this.scheduleBass(
          chord.bass + (this.random() > 0.56 ? 7 : 12),
          at,
          EIGHTH_NOTE_SECONDS * 1.45,
          0.034,
        );
      }

      const upperChance = this.studyActive ? 0.14 : 0.25;
      if (
        stepInBar > 0 &&
        stepInBar % 2 === 1 &&
        this.random() < upperChance
      ) {
        const chordTones = chord.voices.map((note) => note + 12);
        const palette = [...chordTones, ...UPPER_NOTES];
        this.scheduleUpperNote(choose(this.random, palette), at);
      }

      if (this.random() < 0.1) {
        this.scheduleCrackle(at + randomBetween(this.random, 0.03, 0.24));
      }

      this.nextStepAt += EIGHTH_NOTE_SECONDS;
      this.step += 1;
    }
  }

  private startLofiBed(): void {
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this.noiseBuffer;
    source.loop = true;
    highpass.type = "highpass";
    highpass.frequency.value = 1_900;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 6_400;
    gain.gain.value = 0.006;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.toneFilter);
    source.start();
    this.bedSource = source;

    const flutter = this.context.createOscillator();
    const depth = this.context.createGain();
    flutter.type = "sine";
    flutter.frequency.value = 0.23;
    depth.gain.value = LOCATION_MIX[this.scene].flutter;
    flutter.connect(depth);
    // Modulating a short delay creates real, subtle pitch drift (tape wow)
    // without detuning every scheduled oscillator independently.
    depth.connect(this.flutterDelay.delayTime);
    flutter.start();
    this.flutterSource = flutter;
    this.flutterDepth = depth;
  }

  private scheduleChord(chord: Chord, at: number): void {
    const duration = EIGHTH_NOTE_SECONDS * 7.55;
    const chordGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const pan = this.context.createStereoPanner();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(
      randomBetween(this.random, 1_650, 2_050),
      at,
    );
    filter.frequency.exponentialRampToValueAtTime(1_050, at + duration);
    filter.Q.value = 0.65;
    pan.pan.value = randomBetween(this.random, -0.22, 0.22);
    applyEnvelope(chordGain.gain, at, duration, 0.052, 0.11, 0.62);

    chordGain.connect(filter);
    filter.connect(pan);
    pan.connect(this.toneFilter);

    chord.voices.forEach((note, index) => {
      const oscillator = this.context.createOscillator();
      const voiceGain = this.context.createGain();
      oscillator.type = index % 3 === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(midiToHz(note), at);
      oscillator.detune.value =
        (index - chord.voices.length / 2) * 1.7 +
        randomBetween(this.random, -1.1, 1.1);
      voiceGain.gain.value = index === 0 ? 0.7 : 0.48;
      oscillator.connect(voiceGain);
      voiceGain.connect(chordGain);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.04);
      this.trackSource(oscillator, () => safeDisconnect(voiceGain));

      if (index === chord.voices.length - 1) {
        oscillator.addEventListener(
          "ended",
          () => {
            safeDisconnect(chordGain);
            safeDisconnect(filter);
            safeDisconnect(pan);
          },
          { once: true },
        );
      }
    });
  }

  private scheduleBass(
    note: number,
    at: number,
    duration: number,
    peak = 0.055,
  ): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(midiToHz(note), at);
    oscillator.detune.value = randomBetween(this.random, -2.5, 2.5);
    filter.type = "lowpass";
    filter.frequency.value = 430;
    filter.Q.value = 0.4;
    applyEnvelope(gain.gain, at, duration, peak, 0.018, 0.16);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.toneFilter);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.025);
    this.trackSource(oscillator, () => {
      safeDisconnect(filter);
      safeDisconnect(gain);
    });
  }

  private scheduleUpperNote(note: number, at: number): void {
    const duration = EIGHTH_NOTE_SECONDS * 1.55;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const pan = this.context.createStereoPanner();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(midiToHz(note), at);
    oscillator.detune.value = randomBetween(this.random, -4, 4);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2_100, at);
    filter.frequency.exponentialRampToValueAtTime(780, at + duration);
    pan.pan.value = randomBetween(this.random, -0.58, 0.58);
    applyEnvelope(gain.gain, at, duration, 0.018, 0.008, 0.2);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.toneFilter);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
    this.trackSource(oscillator, () => {
      safeDisconnect(filter);
      safeDisconnect(gain);
      safeDisconnect(pan);
    });
  }

  private scheduleKick(at: number, peak: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(92, at);
    oscillator.frequency.exponentialRampToValueAtTime(43, at + 0.14);
    applyEnvelope(gain.gain, at, 0.19, peak, 0.004, 0.12);
    oscillator.connect(gain);
    gain.connect(this.toneFilter);
    oscillator.start(at);
    oscillator.stop(at + 0.21);
    this.trackSource(oscillator, () => safeDisconnect(gain));
  }

  private scheduleBrush(at: number, peak: number): void {
    this.scheduleNoiseBurst(at, 0.17, peak, "bandpass", 1_350, 0.72);
  }

  private scheduleHat(at: number, peak: number): void {
    this.scheduleNoiseBurst(at, 0.052, peak, "highpass", 5_200, 0.25);
  }

  private scheduleCrackle(at: number): void {
    this.scheduleNoiseBurst(
      at,
      randomBetween(this.random, 0.008, 0.022),
      randomBetween(this.random, 0.007, 0.015),
      "bandpass",
      randomBetween(this.random, 2_600, 5_800),
      1.4,
    );
  }

  private scheduleNoiseBurst(
    at: number,
    duration: number,
    peak: number,
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
  ): void {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    applyEnvelope(
      gain.gain,
      at,
      duration,
      peak,
      Math.min(0.006, duration * 0.2),
      duration * 0.68,
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.toneFilter);
    source.start(at, randomBetween(this.random, 0, 1.8), duration + 0.02);
    source.stop(at + duration + 0.025);
    this.trackSource(source, () => {
      safeDisconnect(filter);
      safeDisconnect(gain);
    });
  }

  private trackSource(
    source: AudioScheduledSourceNode,
    cleanup?: () => void,
  ): void {
    this.sources.add(source);
    source.addEventListener(
      "ended",
      () => {
        this.sources.delete(source);
        safeDisconnect(source);
        cleanup?.();
      },
      { once: true },
    );
  }
}
