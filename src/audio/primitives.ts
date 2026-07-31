const TAU = Math.PI * 2;

export type RandomSource = () => number;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createNoiseBuffer(
  context: BaseAudioContext,
  seconds = 2,
  random: RandomSource = Math.random,
): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;

  // Slightly correlated noise is less brittle than raw white noise.
  for (let index = 0; index < length; index += 1) {
    const white = random() * 2 - 1;
    previous = previous * 0.16 + white * 0.84;
    channel[index] = previous;
  }

  return buffer;
}

export function createImpulseResponse(
  context: BaseAudioContext,
  seconds = 1.35,
  decay = 3.6,
  random: RandomSource = Math.random,
): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);
    let smoothed = 0;
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      const envelope = (1 - progress) ** decay;
      smoothed = smoothed * 0.12 + (random() * 2 - 1) * 0.88;
      channel[index] = smoothed * envelope;
    }
  }

  return buffer;
}

export function setParam(
  param: AudioParam,
  value: number,
  at: number,
): void {
  param.cancelScheduledValues(at);
  param.setValueAtTime(param.value, at);
  param.linearRampToValueAtTime(value, at + 0.035);
}

export function applyEnvelope(
  gain: AudioParam,
  start: number,
  duration: number,
  peak: number,
  attack = 0.008,
  release = 0.08,
): void {
  const safeDuration = Math.max(attack + release, duration);
  const releaseStart = Math.max(start + attack, start + safeDuration - release);
  gain.cancelScheduledValues(start);
  gain.setValueAtTime(0.0001, start);
  gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack);
  gain.setValueAtTime(Math.max(0.0001, peak * 0.82), releaseStart);
  gain.exponentialRampToValueAtTime(0.0001, start + safeDuration);
}

export function safeDisconnect(node: AudioNode | null | undefined): void {
  if (!node) return;
  try {
    node.disconnect();
  } catch {
    // Already disconnected.
  }
}

export function safeStop(
  source: AudioScheduledSourceNode | null | undefined,
  when = 0,
): void {
  if (!source) return;
  try {
    source.stop(when);
  } catch {
    // Already stopped, or never started.
  }
}

export function equalPowerPan(position: number): [number, number] {
  const normalized = clamp01((position + 1) / 2);
  return [
    Math.cos(normalized * TAU * 0.25),
    Math.sin(normalized * TAU * 0.25),
  ];
}

export function randomBetween(
  random: RandomSource,
  minimum: number,
  maximum: number,
): number {
  return minimum + (maximum - minimum) * random();
}

export function choose<T>(random: RandomSource, values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("choose() requires at least one value");
  }
  return values[Math.floor(random() * values.length)] as T;
}
