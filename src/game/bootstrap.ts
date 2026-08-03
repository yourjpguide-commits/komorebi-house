import Phaser from 'phaser';
import { audio } from '../audio';
import {
  createGameUI,
  type GameUIHandle,
  type GameUIIntent,
} from '../ui';
import { sceneDecorById } from './catalogAdapter';
import { createGameConfig } from './config';
import { placementLayerForDecor } from './corePlacementAdapter';
import {
  DEFAULT_SAVE_KEY,
  DEPTH,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  SCENE_KEYS,
  WORLD_GRID,
} from './constants';
import { systemRuntime } from './systemRuntime';
import type {
  LocationId,
  PlacedDecor,
  WorldSnapshot,
} from './types';
import type { WorldSceneQaHandle } from '../scenes/WorldScene';

export interface GameBootstrapHandle {
  start(): Promise<void>;
  destroy(): void;
  getGame(): Phaser.Game | null;
  getUI(): GameUIHandle | null;
}

type PerformanceSample = {
  fps: number;
  frameTimeP95Ms: number;
};

function worldSceneHandle(): WorldSceneQaHandle | null {
  if (typeof window === 'undefined') return null;
  const globals = window as typeof window & {
    __KOMOREBI_WORLD_SCENE__?: WorldSceneQaHandle;
  };
  return globals.__KOMOREBI_WORLD_SCENE__ ?? null;
}

function initialShell(root: HTMLElement, recoveredSave: boolean): {
  canvasHost: HTMLDivElement;
  uiHost: HTMLDivElement;
  startScreen: HTMLElement;
  startButton: HTMLButtonElement;
} {
  root.innerHTML = `
    <style data-komorebi-runtime>
      .kh-app-shell canvas {
        display: block;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        outline: none;
      }
      .kh-title-screen {
        transition: opacity 280ms ease;
      }
      .kh-title-vignette {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 50% 36%, transparent 0 28%, rgb(7 17 15 / 24%) 70%),
          linear-gradient(180deg, rgb(255 224 164 / 8%), rgb(8 21 18 / 34%));
        pointer-events: none;
      }
      .kh-title-card {
        position: relative;
        width: min(88vw, 32rem);
        padding: clamp(1.25rem, 4vw, 2.4rem);
        border: 1px solid rgb(245 220 164 / 42%);
        border-radius: 1.25rem;
        background: linear-gradient(180deg, rgb(25 47 40 / 78%), rgb(13 30 27 / 91%));
        box-shadow: 0 1.8rem 6rem rgb(0 0 0 / 48%), inset 0 1px rgb(255 255 255 / 8%);
        text-align: center;
        backdrop-filter: blur(12px);
      }
      .kh-title-card h1 {
        margin: 0;
        color: #fff3d1;
        font-family: ui-rounded, "Hiragino Maru Gothic ProN", system-ui, sans-serif;
        font-size: clamp(2rem, 7vw, 4.1rem);
        font-weight: 800;
        letter-spacing: -.045em;
        line-height: .95;
        text-shadow: 0 3px #31483f, 0 7px 20px rgb(0 0 0 / 32%);
      }
      .kh-title-kicker,
      .kh-title-hint {
        margin: 0;
        color: #ddcea8;
        font-size: .72rem;
        letter-spacing: .13em;
        text-transform: uppercase;
      }
      .kh-title-japanese {
        margin: .55rem 0 1.2rem;
        color: #f0c886;
        font-size: 1rem;
        letter-spacing: .22em;
      }
      .kh-title-card button {
        display: inline-flex;
        min-width: 12.5rem;
        min-height: 3.4rem;
        align-items: center;
        justify-content: center;
        gap: .75rem;
        padding: .7rem 1.35rem;
        border: 1px solid #f4d28d;
        border-radius: 999px;
        color: #243c37;
        background: linear-gradient(180deg, #ffe2a4, #dca761);
        box-shadow: 0 4px 0 #865b3f, 0 12px 28px rgb(0 0 0 / 28%);
        cursor: pointer;
        font-weight: 800;
        transition: transform 120ms ease, filter 120ms ease;
      }
      .kh-title-card button:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }
      .kh-title-card button:active {
        box-shadow: 0 2px 0 #865b3f;
        transform: translateY(2px);
      }
      .kh-title-card button small {
        padding-left: .75rem;
        border-left: 1px solid rgb(69 77 53 / 28%);
        font-size: .72rem;
      }
      .kh-title-hint {
        margin-top: 1.25rem;
        letter-spacing: .04em;
        text-transform: none;
      }
      .kh-save-recovery {
        position: absolute;
        z-index: 50;
        right: 1rem;
        bottom: 1rem;
        max-width: 22rem;
        padding: .75rem 1rem;
        border: 1px solid rgb(247 213 148 / 42%);
        border-radius: .75rem;
        color: #f9e8c0;
        background: rgb(42 58 50 / 92%);
        box-shadow: 0 .75rem 2.5rem rgb(0 0 0 / 30%);
        font-size: .8rem;
      }
      @media (max-width: 520px) {
        .kh-title-card {
          width: calc(100vw - 1.5rem);
          padding: 1.3rem 1rem;
        }
        .kh-title-hint {
          display: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .kh-title-screen,
        .kh-title-card button {
          transition: none;
        }
      }
    </style>
    <main class="kh-app-shell" data-testid="game-root">
      <div class="kh-stage-shell">
        <div class="kh-canvas-host" data-testid="game-stage"></div>
        <div class="kh-ui-host" data-testid="ui-layer"></div>
        <section class="kh-title-screen" data-testid="title-screen" aria-labelledby="kh-title">
          <div class="kh-title-vignette" aria-hidden="true"></div>
          <div class="kh-title-card">
            <p class="kh-title-kicker">A little home for quiet days</p>
            <h1 id="kh-title">Komorebi House</h1>
            <p class="kh-title-japanese">木漏れ日の家</p>
            <button type="button" data-testid="start-game">
              <span>Open the shoji</span><small>はじめる</small>
            </button>
            <p class="kh-title-hint">Move with WASD or the arrow keys · Interact with E</p>
          </div>
        </section>
        ${
          recoveredSave
            ? `<div class="kh-save-recovery" data-testid="save-recovery-notice" role="status">
                The old save could not be read, so a fresh room was prepared safely.
              </div>`
            : ''
        }
      </div>
    </main>
  `;

  const shell = root.querySelector<HTMLElement>('.kh-app-shell');
  const stage = root.querySelector<HTMLElement>('.kh-stage-shell');
  const canvasHost = root.querySelector<HTMLDivElement>('.kh-canvas-host');
  const uiHost = root.querySelector<HTMLDivElement>('.kh-ui-host');
  const startScreen = root.querySelector<HTMLElement>('.kh-title-screen');
  const startButton = root.querySelector<HTMLButtonElement>(
    '[data-testid="start-game"]',
  );
  if (!shell || !stage || !canvasHost || !uiHost || !startScreen || !startButton) {
    throw new Error('Failed to construct the Komorebi House game shell.');
  }

  Object.assign(shell.style, {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#13211f',
  });
  Object.assign(stage.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    background: '#263f40',
  });
  Object.assign(canvasHost.style, {
    position: 'absolute',
    inset: '0',
    display: 'grid',
    placeItems: 'center',
  });
  Object.assign(uiHost.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '10',
    pointerEvents: 'none',
  });
  Object.assign(startScreen.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '30',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    color: '#f8efd3',
    background:
      `linear-gradient(180deg, rgba(18,35,31,.08), rgba(12,25,23,.78)), url("${import.meta.env.BASE_URL}assets/komorebi-title-plate-morning-clean.png") center / cover`,
  });

  return { canvasHost, uiHost, startScreen, startButton };
}

function footprintCells(placement: PlacedDecor): Array<{ x: number; y: number }> {
  const definition = sceneDecorById(placement.itemId);
  if (!definition) {
    return [
      {
        x: Math.round(placement.x / WORLD_GRID),
        y: Math.round(placement.y / WORLD_GRID),
      },
    ];
  }
  const rotated = placement.rotation === 90 || placement.rotation === 270;
  const widthPixels = rotated
    ? definition.footprint.height
    : definition.footprint.width;
  const heightPixels = rotated
    ? definition.footprint.width
    : definition.footprint.height;
  const width = Math.max(1, Math.ceil(widthPixels / WORLD_GRID));
  const height = Math.max(1, Math.ceil(heightPixels / WORLD_GRID));
  const anchorX = Math.round(placement.x / WORLD_GRID);
  const anchorY = Math.round(placement.y / WORLD_GRID);
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = -(height - 1); y <= 0; y += 1) {
    for (let x = -Math.floor(width / 2); x < -Math.floor(width / 2) + width; x += 1) {
      cells.push({ x: anchorX + x, y: anchorY + y });
    }
  }
  return cells;
}

export function bootstrapGame(root: HTMLElement): GameBootstrapHandle {
  const authorityLoad = systemRuntime.initialize();
  const recoveredSave = authorityLoad.recovered;
  const { canvasHost, uiHost, startScreen, startButton } = initialShell(
    root,
    recoveredSave,
  );
  let game: Phaser.Game | null = null;
  let ui: GameUIHandle | null = null;
  let starting: Promise<void> | null = null;
  let destroyed = false;
  let unbindAudioEvents: (() => void) | null = audio.bindGameEvents(window);
  let unbindAudioGesture: (() => void) | null = audio.bindUserGesture(window);
  let cleanupAuthorityListener: (() => void) | null = null;
  let performanceSample: PerformanceSample = {
    fps: 60,
    frameTimeP95Ms: 16.7,
  };
  let contextLost = false;

  const updateInventoryFromWorld = (snapshot: WorldSnapshot): void => {
    if (!ui) return;
    const current = ui.getState();
    const placedCounts = new Map<string, number>();
    snapshot.placedDecor.forEach((item) => {
      placedCounts.set(item.itemId, (placedCounts.get(item.itemId) ?? 0) + 1);
    });
    const inventoryById = new Map(
      current.inventory.map((item) => [item.id, item]),
    );
    ui.update({
      catalog: current.catalog.map((item) => ({
        ...item,
        owned: snapshot.ownedItems[item.id] ?? item.owned ?? 0,
      })),
      inventory: current.catalog
        .filter((item) => (snapshot.ownedItems[item.id] ?? 0) > 0)
        .map((item) => {
          const prior = inventoryById.get(item.id);
          const owned = snapshot.ownedItems[item.id] ?? 0;
          return {
            ...item,
            ...prior,
            quantity: owned,
            owned,
            placed: placedCounts.get(item.id) ?? 0,
          };
        }),
    });
  };

  const onWorldState = (event: Event): void => {
    const snapshot = (event as CustomEvent<WorldSnapshot>).detail;
    if (snapshot) updateInventoryFromWorld(snapshot);
  };
  window.addEventListener('komorebi:state', onWorldState);

  const start = async (): Promise<void> => {
    if (destroyed || game) return;
    if (starting) return starting;
    starting = (async () => {
      // Start WebAudio inside the click gesture, but never make the visual
      // world depend on a browser-controlled resume promise settling.
      void audio.unlock().catch(() => false);
      const initialWorld = systemRuntime.getWorldState();
      const restoredFocus = systemRuntime.getState().study.activeSession;
      ui = createGameUI(uiHost, {
        connectWindowEvents: true,
        initialState: {
          coins: initialWorld.coins,
          currentLocation: initialWorld.location,
          ...(restoredFocus
            ? {
                focus: {
                  phase: restoredFocus.status,
                  activity: restoredFocus.activity,
                  durationSeconds: restoredFocus.plannedDurationMs / 1_000,
                  remainingSeconds:
                    (restoredFocus.plannedDurationMs -
                      restoredFocus.accumulatedActiveMs) /
                    1_000,
                  streak:
                    systemRuntime.getState().study.completedSessions,
                  sessionLabel: 'Your quiet session is ready to continue.',
                },
                activePanel: 'focus' as const,
              }
            : {}),
        },
        onIntent: (intent) => {
          if (intent.type === 'focus-start') {
            const result = systemRuntime.dispatch(
              {
                type: 'study.start',
                activity: intent.activity,
                durationMinutes: intent.durationMinutes,
              },
              'focus.start',
            );
            if (result.ok) {
              audio.setStudyActive(true);
            } else {
              ui?.update({
                focus: {
                  phase: 'idle',
                  remainingSeconds: intent.durationMinutes * 60,
                },
                activePanel: null,
              });
              ui?.showToast({
                message: result.error.message,
                tone: 'warning',
              });
            }
          } else if (intent.type === 'focus-pause') {
            const active = systemRuntime.getState().study.activeSession;
            if (active) {
              const pending = Math.min(
                active.plannedDurationMs - active.accumulatedActiveMs,
                Math.max(0, Date.now() - active.lastCheckpointAtUtcMs),
              );
              if (pending > 0) {
                systemRuntime.dispatch(
                  {
                    type: 'study.checkpoint',
                    sessionId: active.id,
                    activeElapsedMs: pending,
                  },
                  'focus.checkpoint',
                );
              }
              const checkpointed =
                systemRuntime.getState().study.activeSession;
              if (checkpointed) {
                const paused = systemRuntime.dispatch(
                  { type: 'study.pause', sessionId: checkpointed.id },
                  'focus.pause',
                );
                if (!paused.ok) {
                  ui?.showToast({
                    message: paused.error.message,
                    tone: 'warning',
                  });
                }
              }
            }
            audio.setStudyActive(false);
          } else if (intent.type === 'focus-resume') {
            const active = systemRuntime.getState().study.activeSession;
            if (active) {
              const resumed = systemRuntime.dispatch(
                { type: 'study.resume', sessionId: active.id },
                'focus.resume',
              );
              if (resumed.ok) audio.setStudyActive(true);
              else {
                ui?.showToast({
                  message: resumed.error.message,
                  tone: 'warning',
                });
              }
            }
          } else if (intent.type === 'focus-complete') {
            const active = systemRuntime.getState().study.activeSession;
            if (active) {
              const remaining =
                active.plannedDurationMs - active.accumulatedActiveMs;
              const checkpoint =
                remaining > 0
                  ? systemRuntime.dispatch(
                      {
                        type: 'study.checkpoint',
                        sessionId: active.id,
                        activeElapsedMs: remaining,
                      },
                      'focus.final-checkpoint',
                    )
                  : null;
              if (!checkpoint || checkpoint.ok) {
                const completed = systemRuntime.dispatch(
                  { type: 'study.complete', sessionId: active.id },
                  'focus.complete',
                );
                if (!completed.ok) {
                  ui?.showToast({
                    message: completed.error.message,
                    tone: 'warning',
                  });
                }
              } else {
                ui?.showToast({
                  message: checkpoint.error.message,
                  tone: 'warning',
                });
              }
            }
            audio.setStudyActive(false);
          } else if (intent.type === 'focus-cancel') {
            const active = systemRuntime.getState().study.activeSession;
            if (active) {
              const cancelled = systemRuntime.dispatch(
                { type: 'study.cancel', sessionId: active.id },
                'focus.cancel',
              );
              if (!cancelled.ok) {
                ui?.showToast({
                  message: cancelled.error.message,
                  tone: 'warning',
                });
              }
            }
            audio.setStudyActive(false);
          } else if (intent.type === 'focus-dismiss') {
            audio.setStudyActive(false);
          } else if (intent.type === 'settings-change') {
            audio.setVolume('music', intent.settings.music);
            audio.setVolume('ambience', intent.settings.ambience);
            audio.setVolume('sfx', intent.settings.effects);
          }
        },
      });
      cleanupAuthorityListener = systemRuntime.subscribe((state) => {
        if (!ui) return;
        const active = state.study.activeSession;
        if (active) {
          ui.update({
            focus: {
              phase: active.status,
              activity: active.activity,
              durationSeconds: active.plannedDurationMs / 1_000,
              remainingSeconds:
                (active.plannedDurationMs - active.accumulatedActiveMs) /
                1_000,
              streak: state.study.completedSessions,
            },
          });
        } else {
          const phase = ui.getState().focus.phase;
          if (phase === 'running' || phase === 'paused') {
            ui.update({
              focus: {
                phase: 'idle',
                remainingSeconds: ui.getState().focus.durationSeconds,
                streak: state.study.completedSessions,
              },
            });
          }
        }
      });
      game = new Phaser.Game(createGameConfig(canvasHost));
      const globals = window as typeof window & {
        __KOMOREBI_GAME__?: Phaser.Game;
      };
      globals.__KOMOREBI_GAME__ = game;
      game.events.once(Phaser.Core.Events.READY, () => {
        const canvas = game?.canvas;
        if (!canvas) return;
        canvas.addEventListener('webglcontextlost', () => {
          contextLost = true;
        });
      });
      startScreen.style.opacity = '0';
      startScreen.style.pointerEvents = 'none';
      startScreen.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => startScreen.remove(), 320);
    })().finally(() => {
      starting = null;
    });
    return starting;
  };

  startButton.addEventListener('click', () => {
    void start();
  });

  const worldToPage = (x: number, y: number): { screenX: number; screenY: number } => {
    const canvas = game?.canvas;
    const scene = game?.scene.getScene(SCENE_KEYS.world);
    if (!canvas || !scene) return { screenX: x, screenY: y };
    const camera = scene.cameras.main;
    const bounds = canvas.getBoundingClientRect();
    return {
      screenX:
        bounds.left +
        (((x - camera.worldView.x) * camera.zoom + camera.x) / RENDER_WIDTH) *
          bounds.width,
      screenY:
        bounds.top +
        (((y - camera.worldView.y) * camera.zoom + camera.y) / RENDER_HEIGHT) *
          bounds.height,
    };
  };

  const qaBridge = {
    state: () => {
      const world = worldSceneHandle();
      const snapshot = world?.getState();
      const player = world?.getPlayer() ?? {
        x: 0,
        y: 0,
        direction: 'down' as const,
        moving: false,
      };
      const placements = snapshot?.placedDecor ?? [];
      const occludedBy = placements
        .filter((placement) => {
          const definition = sceneDecorById(placement.itemId);
          if (!definition) return false;
          return (
            Math.abs(player.x - placement.x) <
              definition.footprint.width / 2 + 6 &&
            player.y < placement.y &&
            player.y > placement.y - Math.max(32, definition.footprint.height * 2)
          );
        })
        .map((placement) => placement.instanceId);
      const uiState = ui?.getState();
      const audioState = audio.getSnapshot();
      const currentFps = game?.loop.actualFps;
      return {
        ready: Boolean(game && world),
        world: {
          location: snapshot?.location ?? 'room',
          phase: snapshot?.mode ?? 'boot',
        },
        player: {
          tileX: Math.round(player.x / WORLD_GRID),
          tileY: Math.round(player.y / WORLD_GRID),
          screenX: player.x,
          screenY: player.y,
          depth: DEPTH.actor + player.y,
          moving: player.moving,
          occludedBy,
        },
        economy: {
          coins: snapshot?.coins ?? 1_260,
        },
        inventory: snapshot?.ownedItems ?? {},
        placements: placements.map((placement) => ({
          placementLayer: placement.support
            ? `tabletop:${placement.support.parentInstanceId}:${placement.support.socket}`
            : placementLayerForDecor(sceneDecorById(placement.itemId)),
          id: placement.instanceId,
          sku: placement.itemId,
          zone: placement.location,
          x: placement.x,
          y: placement.y,
          support: placement.support ?? null,
          tileX: Math.round(placement.x / WORLD_GRID),
          tileY: Math.round(placement.y / WORLD_GRID),
          rotation: placement.rotation,
          depth: DEPTH.worldObject +
            (placement.support
              ? (placements.find((candidate) => candidate.instanceId === placement.support?.parentInstanceId)?.y ?? placement.y) + 0.3
              : placement.y + 0.1),
          footprint: footprintCells(placement),
        })),
        focus: {
          status: uiState?.focus.phase ?? 'idle',
          remainingMs: (uiState?.focus.remainingSeconds ?? 0) * 1_000,
          completedSessions:
            systemRuntime.getState().study.completedSessions,
          pendingReward: systemRuntime.getPendingFocusReward(),
        },
        audio: {
          contextState:
            audioState.status === 'running'
              ? 'running'
              : audioState.status === 'unavailable'
                ? 'unavailable'
                : audioState.status === 'disposed'
                  ? 'closed'
                  : 'suspended',
          muted: audioState.muted,
          masterGain: audioState.muted ? 0 : audioState.volumes.master,
          unlockedByGesture:
            audioState.status !== 'locked' &&
            audioState.status !== 'unavailable',
        },
        persistence: {
          schemaVersion: systemRuntime.getState().meta.schemaVersion,
          lastSavedAt: systemRuntime.getLastPersistedAt(),
          pending: false,
          lastError: systemRuntime.getPersistenceError(),
        },
        render: {
          fps:
            Number.isFinite(currentFps) && (currentFps ?? 0) > 0
              ? currentFps
              : performanceSample.fps,
          frameTimeP95Ms: performanceSample.frameTimeP95Ms,
          smoothing: false,
          contextLost,
        },
      };
    },
    command: async (name: string, payload?: unknown): Promise<unknown> => {
      const world = worldSceneHandle();
      switch (name) {
        case 'reset':
          systemRuntime.reset();
          if (game?.scene.isActive(SCENE_KEYS.world)) {
            game.scene.stop(SCENE_KEYS.world);
            game.scene.start(SCENE_KEYS.world);
          }
          return true;
        case 'grantCoins': {
          const amount =
            payload &&
            typeof payload === 'object' &&
            'amount' in payload &&
            typeof payload.amount === 'number'
              ? payload.amount
              : 0;
          world?.grantCoins(amount);
          return true;
        }
        case 'purchase': {
          const itemId = payload && typeof payload === 'object' &&
            'itemId' in payload && typeof payload.itemId === 'string'
            ? payload.itemId
            : '';
          return systemRuntime.purchase(itemId);
        }
        case 'commitPlacement': {
          if (!payload || typeof payload !== 'object') return { ok: false };
          const candidate = payload as {
            itemId?: string; location?: LocationId; x?: number; y?: number;
            rotation?: 0 | 90 | 180 | 270;
          };
          if (!candidate.itemId || !candidate.location ||
            typeof candidate.x !== 'number' || typeof candidate.y !== 'number') return { ok: false };
          return systemRuntime.commitPlacement({
            itemId: candidate.itemId,
            location: candidate.location,
            x: candidate.x,
            y: candidate.y,
            rotation: candidate.rotation ?? 0,
          });
        }
        case 'seedLegacyTabletopFixture':
          return systemRuntime.seedLegacyTabletopFixtureForQa();
        case 'setPlayerTile': {
          if (!world || !payload || typeof payload !== 'object') return false;
          const candidate = payload as {
            location?: LocationId;
            tileX?: number;
            tileY?: number;
          };
          if (
            typeof candidate.tileX === 'number' &&
            typeof candidate.tileY === 'number'
          ) {
            world.setPlayerWorld(
              candidate.tileX * WORLD_GRID,
              candidate.tileY * WORLD_GRID,
            );
          }
          return true;
        }
        case 'samplePerformance': {
          const durationMs =
            payload &&
            typeof payload === 'object' &&
            'durationMs' in payload &&
            typeof payload.durationMs === 'number'
              ? Phaser.Math.Clamp(payload.durationMs, 250, 5_000)
              : 1_000;
          const frameTimes: number[] = [];
          let prior = performance.now();
          const until = prior + durationMs;
          await new Promise<void>((resolve) => {
            const sample = (now: number) => {
              frameTimes.push(now - prior);
              prior = now;
              if (now >= until) resolve();
              else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          });
          frameTimes.sort((a, b) => a - b);
          const p95 =
            frameTimes[Math.floor(frameTimes.length * 0.95)] ?? 16.7;
          const average =
            frameTimes.reduce((sum, value) => sum + value, 0) /
            Math.max(1, frameTimes.length);
          performanceSample = {
            fps: Math.round(1_000 / Math.max(1, average)),
            frameTimeP95Ms: p95,
          };
          return performanceSample;
        }
        case 'setVisualPreset': {
          const preset =
            payload &&
            typeof payload === 'object' &&
            'preset' in payload &&
            typeof payload.preset === 'string'
              ? payload.preset
              : '';
          if (preset.startsWith('room') && world?.getState().location !== 'room') {
            world?.travel('room');
          }
          return true;
        }
        case 'advanceClock': {
          const milliseconds =
            payload &&
            typeof payload === 'object' &&
            'milliseconds' in payload &&
            typeof payload.milliseconds === 'number'
              ? Math.max(0, Math.floor(payload.milliseconds))
              : 0;
          if (!systemRuntime.advanceClock(milliseconds)) return false;
          const active = systemRuntime.getState().study.activeSession;
          if (active) {
            const remaining = Math.max(
              0,
              active.plannedDurationMs - active.accumulatedActiveMs,
            );
            ui?.update({
              focus: {
                remainingSeconds: remaining / 1_000,
                phase:
                  active.status === 'paused'
                    ? 'paused'
                    : remaining === 0
                      ? 'complete'
                      : 'running',
              },
            });
            if (remaining === 0) {
              systemRuntime.dispatch(
                { type: 'study.complete', sessionId: active.id },
                'focus.qa-complete',
              );
              ui?.update({
                focus: {
                  phase: 'complete',
                  remainingSeconds: 0,
                  streak: systemRuntime.getState().study.completedSessions,
                },
              });
              audio.setStudyActive(false);
            }
          }
          return true;
        }
        default:
          return false;
      }
    },
    query: (name: string, payload?: unknown): unknown => {
      const world = worldSceneHandle();
      switch (name) {
        case 'saveStorageKey':
          return DEFAULT_SAVE_KEY;
        case 'placementTargets': {
          if (!world || !payload || typeof payload !== 'object') return [];
          const candidate = payload as { sku?: string };
          if (!candidate.sku) return [];
          return world.getPlacementTargets(candidate.sku).map((target) => ({
            ...worldToPage(target.x, target.y),
            tileX: Math.round(target.x / WORLD_GRID),
            tileY: Math.round(target.y / WORLD_GRID),
            zone: world.getState().location,
            valid: target.valid,
            reason: target.reason,
          }));
        }
        case 'placementHitPoint': {
          if (!world || !payload || typeof payload !== 'object') return null;
          const id =
            'id' in payload && typeof payload.id === 'string'
              ? payload.id
              : '';
          const placement = world
            .getPlacedDecor()
            .find((item) => item.instanceId === id);
          return placement ? worldToPage(placement.x, placement.y) : null;
        }
        case 'occlusionWaypoints': {
          if (!world) return [];
          const placement =
            world
              .getPlacedDecor()
              .find((item) =>
                ['bookshelf', 'monstera', 'maple-sapling'].includes(item.itemId),
              ) ?? world.getPlacedDecor()[0];
          if (!placement) return [];
          return [
            {
              objectId: placement.instanceId,
              behind: {
                location: placement.location,
                tileX: Math.round(placement.x / WORLD_GRID),
                tileY: Math.round((placement.y - 14) / WORLD_GRID),
              },
              front: {
                location: placement.location,
                tileX: Math.round(placement.x / WORLD_GRID),
                tileY: Math.round((placement.y + 14) / WORLD_GRID),
              },
            },
          ];
        }
        case 'navigationAnchors':
          return world?.getNavigationAnchors() ?? {};
        default:
          return null;
      }
    },
  };

  const qaGlobals = window as typeof window & {
    __KOMOREBI_QA__?: unknown;
  };
  qaGlobals.__KOMOREBI_QA__ = qaBridge;

  return {
    start,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('komorebi:state', onWorldState);
      unbindAudioEvents?.();
      unbindAudioEvents = null;
      unbindAudioGesture?.();
      unbindAudioGesture = null;
      cleanupAuthorityListener?.();
      cleanupAuthorityListener = null;
      ui?.destroy();
      ui = null;
      game?.destroy(true);
      game = null;
      audio.dispose();
      if (qaGlobals.__KOMOREBI_QA__ === qaBridge) {
        delete qaGlobals.__KOMOREBI_QA__;
      }
      const gameGlobals = window as typeof window & {
        __KOMOREBI_GAME__?: Phaser.Game;
      };
      delete gameGlobals.__KOMOREBI_GAME__;
    },
    getGame: () => game,
    getUI: () => ui,
  };
}
