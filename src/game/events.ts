import type { GameAudioEvent, SceneCommand, WorldSnapshot } from './types';

export const GAME_EVENTS = {
  state: 'komorebi:state',
  toast: 'komorebi:toast',
  interaction: 'komorebi:interaction',
  openShop: 'komorebi:open-shop',
  study: 'komorebi:study',
  audio: 'komorebi:audio',
  command: 'komorebi:command',
} as const;

export type ToastTone = 'quiet' | 'success' | 'warning';

function browserTarget(): EventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

export function dispatchGameEvent<T>(
  eventName: string,
  detail: T,
  target: EventTarget | null = browserTarget(),
): void {
  if (!target || typeof CustomEvent === 'undefined') return;
  target.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
}

export function emitWorldState(snapshot: WorldSnapshot): void {
  dispatchGameEvent(GAME_EVENTS.state, snapshot);
}

export function emitToast(message: string, tone: ToastTone = 'quiet'): void {
  dispatchGameEvent(GAME_EVENTS.toast, { message, tone });
}

export function emitAudio(detail: GameAudioEvent): void {
  dispatchGameEvent(GAME_EVENTS.audio, detail);
}

export function listenForSceneCommands(
  listener: (command: SceneCommand) => void,
  target: EventTarget | null = browserTarget(),
): () => void {
  if (!target) return () => undefined;
  const handler = (event: Event) => {
    const command = (event as CustomEvent<SceneCommand>).detail;
    if (command?.type) listener(command);
  };
  target.addEventListener(GAME_EVENTS.command, handler);
  return () => target.removeEventListener(GAME_EVENTS.command, handler);
}
