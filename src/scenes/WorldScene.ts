import Phaser from 'phaser';
import {
  AVATAR_FRAME_COUNTS,
  AVATAR_MOBILE_WORLD_SCALE,
  AVATAR_WORLD_SCALE,
  avatarTextureKey,
  furnitureSupportedRotations,
  furnitureTextureKey,
  type FurnitureRotation,
} from '../art';
import { audio } from '../audio';
import { placementMountFits, type PlacementSupportContext } from '../data';
import { sceneDecorById, resolveDecorTextureKey } from '../game/catalogAdapter';
import {
  DEPTH,
  INTERACTION_RADIUS,
  PLAYER_RUN_MULTIPLIER,
  PLAYER_SPEED,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  SCENE_KEYS,
  WORLD_GRID,
  WORLD_RENDER_SCALE,
} from '../game/constants';
import {
  tabletopSupportAt,
  validateScenePlacement,
} from '../game/corePlacementAdapter';
import {
  dispatchGameEvent,
  emitAudio,
  emitToast,
  emitWorldState,
  GAME_EVENTS,
  listenForSceneCommands,
} from '../game/events';
import {
  renderLocationEnvironment,
  snapWorldCoordinate,
  type LocationRenderResult,
} from '../game/locationRenderer';
import { getLocationBlueprint } from '../game/locations';
import { ART_KEYS } from '../game/pixelTextures';
import { systemRuntime } from '../game/systemRuntime';
import type {
  DecorDefinition,
  Direction,
  InteractionDefinition,
  LocationBlueprint,
  LocationId,
  PlacedDecor,
  Point,
  SavedWorldState,
  SceneCommand,
  WorldSnapshot,
} from '../game/types';

interface KeyBindings {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  place: Phaser.Input.Keyboard.Key;
  rotate: Phaser.Input.Keyboard.Key;
  cancel: Phaser.Input.Keyboard.Key;
  run: Phaser.Input.Keyboard.Key;
  decorate: Phaser.Input.Keyboard.Key;
}

interface PlacementSession {
  definition: DecorDefinition;
  preview: Phaser.GameObjects.Image;
  footprint: Phaser.GameObjects.Graphics;
  cursor: Phaser.GameObjects.Image;
  rotation: FurnitureRotation;
  existingInstanceId?: string;
  x: number;
  y: number;
  valid: boolean;
  pointerDrag: boolean;
}

interface AmbientMote {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  originX: number;
  originY: number;
  velocityX: number;
  velocityY: number;
  phase: number;
  kind: LocationBlueprint['ambience'];
}

const MOVEMENT_EPSILON = 0.05;
const PHYSICS_STEP_GRACE_MS = 50;
const WALK_FRAME_DISTANCE = 10;
const FOOT_CONTACT_FRAMES = new Set([1, 3]);

export interface WorldSceneQaHandle {
  getState(): WorldSnapshot;
  command(command: SceneCommand): void;
  travel(location: LocationId, spawnId?: string): void;
  grantCoins(amount: number): void;
  setPlayerWorld(x: number, y: number): void;
  getPlayer(): { x: number; y: number; direction: Direction; moving: boolean };
  getPlacedDecor(): PlacedDecor[];
  getPlacementTargets(itemId: string): Array<{
    x: number;
    y: number;
    valid: boolean;
    reason?: string;
  }>;
  getNavigationAnchors(): Record<string, Point>;
}

const pointInRect = (
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
): boolean =>
  point.x >= rect.x &&
  point.y >= rect.y &&
  point.x <= rect.x + rect.width &&
  point.y <= rect.y + rect.height;

function normalizeVector(x: number, y: number): Point {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function directionVector(direction: Direction): Point {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

export class WorldScene extends Phaser.Scene {
  private blueprint!: LocationBlueprint;
  private savedState!: SavedWorldState;
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerVisual!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private playerGroundContact!: Phaser.GameObjects.Graphics;
  private playerDirection: Direction = 'down';
  private playerMoving = false;
  private playerMovementRequested = false;
  private playerLastPhysicsPosition: Point = { x: 0, y: 0 };
  private playerWalkDistance = 0;
  private playerWalkFrame = 0;
  private playerAnimationStartedAt = 0;
  private playerLastMovedAt = 0;
  private keys!: KeyBindings;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touchDirections = new Set<Direction>();
  private directMove = { x: 0, y: 0, running: false };
  private clickTarget: Point | null = null;
  private lastClickDistance = Number.POSITIVE_INFINITY;
  private clickStallAt = 0;
  private transitionActive = false;
  private explorationWasSuspended = false;
  private resumeRequiresNeutralInput = false;
  private portalCooldownUntil = 0;
  private placementSerial = 0;
  private placement: PlacementSession | null = null;
  private nearestInteraction: InteractionDefinition | null = null;
  private interactionMarker!: Phaser.GameObjects.Image;
  private environment: LocationRenderResult | null = null;
  private locationObjects: Phaser.GameObjects.GameObject[] = [];
  private decorObjects: Phaser.GameObjects.GameObject[] = [];
  private decorSprites = new Map<string, Phaser.GameObjects.Image>();
  private collisionZones: Phaser.GameObjects.Zone[] = [];
  private collisionHandles: Phaser.Physics.Arcade.Collider[] = [];
  private ambientMotes: AmbientMote[] = [];
  private cleanupCommandListener: (() => void) | null = null;
  private cleanupAuthorityListener: (() => void) | null = null;
  private lastSnapshotSignature = '';
  private lastPointerWorld: Point | null = null;
  private qaHandle: WorldSceneQaHandle | null = null;
  private lastPurchase: { itemId: string; at: number } | null = null;

  constructor() {
    super(SCENE_KEYS.world);
  }

  create(): void {
    this.savedState = this.readWorldState();
    this.setupKeyboard();
    this.setupPointer();
    this.cleanupCommandListener = listenForSceneCommands((command) =>
      this.handleCommand(command),
    );
    this.cleanupAuthorityListener = systemRuntime.subscribe(() =>
      this.syncFromAuthority(),
    );

    this.buildLocation(this.savedState.location, undefined, true);
    this.installQaHandle();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupScene, this);
  }

  update(time: number, delta: number): void {
    if (!this.player?.active) return;

    const explorationSuspended = this.isExplorationInputSuspended();
    if (explorationSuspended) {
      this.clearExplorationMotionIntent();
      this.resumeRequiresNeutralInput = true;
    } else if (this.explorationWasSuspended) {
      this.resumeRequiresNeutralInput = this.hasRawKeyboardMovement();
    }
    this.explorationWasSuspended = explorationSuspended;

    if (
      this.resumeRequiresNeutralInput &&
      !explorationSuspended &&
      !this.hasRawKeyboardMovement()
    ) {
      this.resumeRequiresNeutralInput = false;
    }

    this.handleHotkeys(explorationSuspended);

    if (this.transitionActive) {
      this.stopPlayer(time);
    } else if (this.placement) {
      this.stopPlayer(time);
      this.updatePlacementFromPointer();
    } else if (explorationSuspended || this.resumeRequiresNeutralInput) {
      this.stopPlayer(time);
    } else {
      this.updatePlayerMovement(time);
      this.updateNearestInteraction();
      this.checkPortals(time);
    }

    this.updateActorVisuals(time);
    this.updateAmbient(time, delta);
    this.publishState();
  }

  getSnapshot(): WorldSnapshot {
    const interaction = this.nearestInteraction
      ? {
          id: this.nearestInteraction.id,
          label: this.nearestInteraction.label,
          labelJa: this.nearestInteraction.labelJa,
          kind: this.nearestInteraction.kind,
        }
      : null;
    const mode = this.transitionActive
      ? 'transition'
      : this.placement
        ? 'placement'
        : 'explore';
    const prompt = this.placement
      ? this.placement.valid
        ? 'Place here · R to rotate · Esc to cancel'
        : 'That spot needs a little more room'
      : this.nearestInteraction?.label ?? '';

    return {
      location: this.blueprint.id,
      locationName: this.blueprint.name,
      locationNameJa: this.blueprint.nameJa,
      coins: this.savedState.coins,
      mode,
      selectedItem: this.placement?.definition.id ?? null,
      editingExisting: Boolean(this.placement?.existingInstanceId),
      rotation: this.placement?.rotation ?? 0,
      placementValid: this.placement?.valid ?? false,
      prompt,
      interaction,
      ownedItems: { ...this.savedState.ownedItems },
      placedDecor: this.savedState.placedDecor.map((item) => ({ ...item })),
    };
  }

  handleCommand(command: SceneCommand): void {
    switch (command.type) {
      case 'travel':
        this.travelTo(command.payload.location, command.payload.spawnId);
        break;
      case 'toggle-placement': {
        if (command.payload?.active === false) {
          this.cancelPlacement();
          break;
        }
        const itemId =
          command.payload?.itemId ??
          this.placement?.definition.id ??
          this.firstAvailableItem();
        if (itemId) this.beginPlacement(itemId);
        break;
      }
      case 'select-item':
        this.beginPlacement(command.payload.itemId);
        break;
      case 'purchase':
        this.purchaseItem(command.payload.itemId);
        break;
      case 'rotate':
        this.rotatePlacement();
        break;
      case 'place':
        this.confirmPlacement();
        break;
      case 'cancel':
        if (
          command.payload?.action === 'store' &&
          this.placement?.existingInstanceId
        ) {
          this.storeCurrentPlacement();
        } else {
          this.cancelPlacement();
        }
        break;
      case 'interact':
        this.performInteraction();
        break;
      case 'move':
        this.applyMoveCommand(command.payload);
        break;
      case 'move-stop':
        this.touchDirections.clear();
        this.directMove = { x: 0, y: 0, running: false };
        break;
    }
  }

  travelTo(location: LocationId, spawnId?: string): void {
    if (this.transitionActive) return;
    if (location === this.blueprint.id) {
      const spawn =
        this.blueprint.spawns[spawnId ?? this.blueprint.defaultSpawn] ??
        this.blueprint.spawns[this.blueprint.defaultSpawn];
      if (spawn) {
        this.player.setPosition(spawn.x, spawn.y);
        this.stopPlayer();
      }
      return;
    }
    const authorityResult = systemRuntime.travel(location);
    if (!authorityResult.ok) {
      audio.playSfx('place-invalid');
      emitToast(authorityResult.error.message, 'warning');
      return;
    }

    this.cancelPlacement(false);
    this.transitionActive = true;
    this.clickTarget = null;
    this.stopPlayer();
    emitAudio({ type: 'travel', location });
    audio.playSfx('door-open');
    this.publishState(true);

    const camera = this.cameras.main;
    camera.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.savedState = this.readWorldState();
        this.buildLocation(location, spawnId, false);
        camera.fadeIn(280, 37, 55, 53);
        this.time.delayedCall(90, () => {
          this.transitionActive = false;
          this.portalCooldownUntil = this.time.now + 700;
          this.publishState(true);
        });
      },
    );
    camera.fadeOut(230, 37, 55, 53);
  }

  private setupKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Komorebi House requires Phaser keyboard input support.');
    }
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      interact: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      place: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      rotate: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      cancel: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      run: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      decorate: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G),
    };
    this.cursorKeys = keyboard.createCursorKeys();
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
  }

  private setupPointer(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (pointer: Phaser.Input.Pointer) => {
        this.lastPointerWorld = { x: pointer.worldX, y: pointer.worldY };
        if (this.placement) this.updatePlacement(pointer.worldX, pointer.worldY);
      },
    );
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer) => {
        void audio.unlock();
        this.lastPointerWorld = { x: pointer.worldX, y: pointer.worldY };
        if (pointer.rightButtonDown()) {
          if (this.placement) this.rotatePlacement();
          return;
        }
        if (this.transitionActive) return;
        if (this.placement) {
          this.updatePlacement(pointer.worldX, pointer.worldY);
          // Click/tap chooses a tile; the persistent tray owns the explicit
          // commit action. Only a true direct-manipulation drag commits on
          // pointer-up below.
          this.publishState(true);
          return;
        }
        if (this.isWorldUiBlocking()) return;
        this.clickTarget = {
          x: Phaser.Math.Clamp(
            pointer.worldX,
            this.blueprint.bounds.x + 8,
            this.blueprint.bounds.x + this.blueprint.bounds.width - 8,
          ),
          y: Phaser.Math.Clamp(
            pointer.worldY,
            this.blueprint.bounds.y + 8,
            this.blueprint.bounds.y + this.blueprint.bounds.height - 8,
          ),
        };
        this.lastClickDistance = Number.POSITIVE_INFINITY;
        this.clickStallAt = this.time.now;
      },
    );
    this.input.on(
      Phaser.Input.Events.POINTER_UP,
      () => {
        if (this.placement?.pointerDrag) this.confirmPlacement();
      },
    );
  }

  private handleHotkeys(explorationSuspended: boolean): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.cancel)) {
      if (this.placement) this.cancelPlacement();
      else if (!explorationSuspended) this.clickTarget = null;
    }
    if (this.placement && Phaser.Input.Keyboard.JustDown(this.keys.rotate)) {
      this.rotatePlacement();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.place)) {
      if (this.placement) this.confirmPlacement();
      else if (!explorationSuspended) this.performInteraction();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      if (this.placement || !explorationSuspended) this.performInteraction();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.decorate)) {
      if (this.placement) this.cancelPlacement();
      else if (!explorationSuspended) {
        const item = this.firstAvailableItem();
        if (item) this.beginPlacement(item);
      }
    }
  }

  private buildLocation(
    location: LocationId,
    spawnId?: string,
    fadeIn = false,
  ): void {
    this.destroyLocation();
    this.blueprint = getLocationBlueprint(location);
    this.environment = renderLocationEnvironment(this, this.blueprint);
    this.locationObjects.push(...this.environment.displayObjects);

    const spawn =
      this.blueprint.spawns[spawnId ?? this.blueprint.defaultSpawn] ??
      this.blueprint.spawns[this.blueprint.defaultSpawn] ??
      { x: this.blueprint.bounds.width / 2, y: this.blueprint.bounds.height / 2 };
    this.createOrMovePlayer(spawn);
    this.renderPlacedDecor();
    this.rebuildCollisionBodies();
    this.createAmbient();
    this.createInteractionMarker();

    this.physics.world.setBounds(
      this.blueprint.bounds.x,
      this.blueprint.bounds.y,
      this.blueprint.bounds.width,
      this.blueprint.bounds.height,
      true,
      true,
      true,
      true,
    );
    this.player.setCollideWorldBounds(true);

    const camera = this.cameras.main;
    camera.stopFollow();
    camera.setViewport(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
    camera.setZoom(WORLD_RENDER_SCALE);
    camera.setBounds(
      this.blueprint.bounds.x,
      this.blueprint.bounds.y,
      this.blueprint.bounds.width,
      this.blueprint.bounds.height,
    );
    camera.roundPixels = true;
    camera.setScroll(this.blueprint.bounds.x, this.blueprint.bounds.y);
    camera.setBackgroundColor(this.blueprint.skyColor);
    if (fadeIn) camera.fadeIn(360, 37, 55, 53);

    audio.setScene(location, {
      rain: location === 'cafe',
      timeOfDay: location === 'park' ? 'evening' : 'day',
    });

    this.nearestInteraction = null;
    this.portalCooldownUntil = this.time.now + 700;
    this.game.canvas.dataset.scene = 'world';
    this.game.canvas.dataset.location = location;
    this.publishState(true);
  }

  private createOrMovePlayer(spawn: Point): void {
    const avatarScale = this.avatarDisplayScale();
    // The player receives a compact cast shadow plus a separately drawn
    // contact patch below.  Together they read as a low sun shadow rather
    // than the generic broad oval that made the actor appear to float.
    const shadowScale = avatarScale * 0.92;
    // Phaser reuses the Scene instance across stop/start cycles. The old
    // sprite field can therefore remain truthy after the display list and its
    // Arcade body have been destroyed (notably in the deterministic QA reset
    // path). Treat that stale reference as absent and build a fresh actor.
    if (!this.playerShadow?.active) {
      this.playerShadow = this.add
        .image(spawn.x + 2, spawn.y - 1, ART_KEYS.shadow)
        .setOrigin(0.5)
        .setScale(shadowScale, 0.7)
        .setAlpha(0.5)
        .setDepth(DEPTH.shadow + spawn.y);
      this.playerGroundContact = this.add
        .graphics()
        .setDepth(DEPTH.shadow + spawn.y + 0.05);
    } else {
      this.playerShadow
        .setPosition(spawn.x + 2, spawn.y - 1)
        .setScale(shadowScale, 0.7)
        .setAlpha(0.5);
      if (!this.playerGroundContact?.active) {
        this.playerGroundContact = this.add.graphics();
      }
    }

    if (!this.player?.active || !this.player.body) {
      this.player = this.physics.add
        .sprite(spawn.x, spawn.y, this.avatarKey('down', false, 0))
        .setOrigin(0.5, 1)
        .setScale(avatarScale)
        .setVisible(false);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      // The 36x48 authored actor is 1.5x the old source contract while its
      // display scale is reduced by the same ratio.  Scaling the local body
      // dimensions and offset likewise preserves the exact world-space
      // collision footprint and bottom contact point.
      body.setSize(18, 12);
      body.setOffset(9, 34.5);
      body.updateFromGameObject();
      body.setMaxVelocity(PLAYER_SPEED * PLAYER_RUN_MULTIPLIER);
    } else {
      this.player.setPosition(spawn.x, spawn.y);
      this.player.setVelocity(0, 0);
      this.player.setScale(avatarScale).setVisible(false);
    }

    if (!this.playerVisual?.active) {
      this.playerVisual = this.add
        .image(spawn.x, spawn.y, this.avatarKey('down', false, 0))
        .setOrigin(0.5, 1)
        .setScale(avatarScale);
    } else {
      this.playerVisual
        .setPosition(spawn.x, spawn.y)
        .setScale(avatarScale)
        .setVisible(true);
    }
    this.playerDirection = 'down';
    this.player.setTexture(this.avatarKey('down', false, 0));
    this.playerVisual
      .setTexture(this.avatarKey('down', false, 0))
      .setDepth(DEPTH.actor + Math.round(spawn.y));
    this.playerLastPhysicsPosition = { x: spawn.x, y: spawn.y };
    this.playerMovementRequested = false;
    this.playerMoving = false;
    this.playerLastMovedAt = 0;
    this.resetPlayerAnimation(this.time.now);
    this.updatePlayerGrounding();
  }

  private avatarDisplayScale(): number {
    return this.game.canvas.getBoundingClientRect().width <= 640
      ? AVATAR_MOBILE_WORLD_SCALE
      : AVATAR_WORLD_SCALE;
  }

  private rebuildCollisionBodies(): void {
    this.collisionHandles.forEach((collider) => collider.destroy());
    this.collisionHandles = [];
    this.collisionZones.forEach((zone) => zone.destroy());
    this.collisionZones = [];

    const collisionRects = [...this.blueprint.obstacles];
    for (const placement of this.savedState.placedDecor) {
      if (placement.location !== this.blueprint.id) continue;
      const definition = sceneDecorById(placement.itemId);
      if (!definition || !this.decorBlocksMovement(definition)) continue;
      const rotation = this.supportedFurnitureRotation(
        definition.id,
        placement.rotation,
      );
      const rotated = rotation === 90 || rotation === 270;
      const width = rotated
        ? definition.footprint.height
        : definition.footprint.width;
      const height = rotated
        ? definition.footprint.width
        : definition.footprint.height;
      collisionRects.push({
        x: placement.x - width / 2,
        y: placement.y - height,
        width,
        height,
      });
    }

    collisionRects.forEach((collisionRect) => {
      const zone = this.add.zone(
        collisionRect.x + collisionRect.width / 2,
        collisionRect.y + collisionRect.height / 2,
        Math.max(2, collisionRect.width),
        Math.max(2, collisionRect.height),
      );
      this.physics.add.existing(zone, true);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(
        Math.max(2, collisionRect.width),
        Math.max(2, collisionRect.height),
      );
      body.updateFromGameObject();
      this.collisionZones.push(zone);
      this.collisionHandles.push(this.physics.add.collider(this.player, zone));
    });
  }

  private renderPlacedDecor(): void {
    this.decorObjects.forEach((object) => object.destroy());
    this.decorObjects = [];
    this.decorSprites.clear();

    for (const placement of this.savedState.placedDecor) {
      if (placement.location !== this.blueprint.id) continue;
      const definition = sceneDecorById(placement.itemId);
      if (!definition) continue;
      const rotation = this.supportedFurnitureRotation(
        definition.id,
        placement.rotation,
      );
      const textureKey = this.resolveFurnitureTextureKey(
        definition,
        rotation,
      );
      const rotated = rotation === 90 || rotation === 270;
      const footprintWidth = rotated
        ? definition.footprint.height
        : definition.footprint.width;
      const footprintHeight = rotated
        ? definition.footprint.width
        : definition.footprint.height;
      const support =
        definition.category === 'tabletop' ||
        definition.placementSurface === 'tabletop'
          ? tabletopSupportAt(
              this.savedState.placedDecor,
              placement.location,
              placement.x,
              placement.y,
            )
          : undefined;
      const presentationY = support?.y ?? placement.y;
      const shadow = this.add
        .image(placement.x, placement.y - 2, ART_KEYS.shadow)
        .setOrigin(0.5)
        .setScale(
          Phaser.Math.Clamp(footprintWidth / 18, 0.65, 2.2),
          Phaser.Math.Clamp(footprintHeight / 12, 0.55, 1.65),
        )
        .setAlpha(0.62)
        .setDepth(DEPTH.worldObject + presentationY + 0.05);
      const sprite = this.add
        .image(placement.x, placement.y, textureKey)
        .setOrigin(0.5, 1)
        // The texture key already selects an authored cel for its supported
        // facing; runtime rotation would blur and falsify the pixel projection.
        .setAngle(0)
        .setDepth(DEPTH.worldObject + presentationY + 0.1)
        .setInteractive({ useHandCursor: true });

      sprite.on(
        Phaser.Input.Events.POINTER_DOWN,
        (
          pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          if (
            this.transitionActive ||
            !this.blueprint.placementAreas.length
          ) {
            return;
          }
          event.stopPropagation();
          this.beginPlacement(placement.itemId, placement.instanceId, false);
          this.updatePlacement(pointer.worldX, pointer.worldY);
        },
      );

      this.decorObjects.push(shadow, sprite);
      this.decorSprites.set(placement.instanceId, sprite);
    }
  }

  private updatePlayerMovement(time: number): void {
    const displacementX = this.player.x - this.playerLastPhysicsPosition.x;
    const displacementY = this.player.y - this.playerLastPhysicsPosition.y;
    const displacement = Math.hypot(displacementX, displacementY);
    this.playerLastPhysicsPosition = {
      x: this.player.x,
      y: this.player.y,
    };

    let x = 0;
    let y = 0;
    const keyboardX =
      (this.keys.left.isDown || this.cursorKeys.left.isDown ? -1 : 0) +
      (this.keys.right.isDown || this.cursorKeys.right.isDown ? 1 : 0);
    const keyboardY =
      (this.keys.up.isDown || this.cursorKeys.up.isDown ? -1 : 0) +
      (this.keys.down.isDown || this.cursorKeys.down.isDown ? 1 : 0);

    if (keyboardX !== 0 || keyboardY !== 0) {
      x = keyboardX;
      y = keyboardY;
      this.clickTarget = null;
    } else if (
      this.touchDirections.size > 0 ||
      this.directMove.x !== 0 ||
      this.directMove.y !== 0
    ) {
      for (const direction of this.touchDirections) {
        const vector = directionVector(direction);
        x += vector.x;
        y += vector.y;
      }
      x += this.directMove.x;
      y += this.directMove.y;
      this.clickTarget = null;
    } else if (this.clickTarget) {
      const differenceX = this.clickTarget.x - this.player.x;
      const differenceY = this.clickTarget.y - this.player.y;
      const distance = Math.hypot(differenceX, differenceY);
      if (distance <= 4) {
        this.clickTarget = null;
      } else {
        x = differenceX / distance;
        y = differenceY / distance;
        if (distance < this.lastClickDistance - 0.5) {
          this.lastClickDistance = distance;
          this.clickStallAt = time;
        } else if (time - this.clickStallAt > 480) {
          this.clickTarget = null;
        }
      }
    }

    const movement = normalizeVector(x, y);
    const running = this.keys.run.isDown || this.directMove.running;
    const speed =
      PLAYER_SPEED * (running ? PLAYER_RUN_MULTIPLIER : 1);
    this.player.setVelocity(movement.x * speed, movement.y * speed);
    const movementRequested = movement.x !== 0 || movement.y !== 0;

    let directionChanged = false;
    if (movementRequested) {
      let direction: Direction;
      if (Math.abs(movement.x) > Math.abs(movement.y)) {
        direction = movement.x < 0 ? 'left' : 'right';
      } else {
        direction = movement.y < 0 ? 'up' : 'down';
      }
      if (!this.playerMovementRequested || direction !== this.playerDirection) {
        this.playerDirection = direction;
        directionChanged = true;
        this.resetPlayerAnimation(time);
      }
    }
    this.playerMovementRequested = movementRequested;

    if (displacement > MOVEMENT_EPSILON) this.playerLastMovedAt = time;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const blockedAlongRequest = Boolean(
      (movement.x < 0 && (body.blocked.left || body.touching.left)) ||
      (movement.x > 0 && (body.blocked.right || body.touching.right)) ||
      (movement.y < 0 && (body.blocked.up || body.touching.up)) ||
      (movement.y > 0 && (body.blocked.down || body.touching.down))
    );
    const actuallyMoving = Boolean(
      displacement > MOVEMENT_EPSILON ||
      (movementRequested &&
        !blockedAlongRequest &&
        time - this.playerLastMovedAt <= PHYSICS_STEP_GRACE_MS)
    );
    if (actuallyMoving) {
      const previousFrameStep = Math.floor(
        this.playerWalkDistance / WALK_FRAME_DISTANCE,
      );
      if (!directionChanged) this.playerWalkDistance += displacement;
      const nextFrameStep = Math.floor(
        this.playerWalkDistance / WALK_FRAME_DISTANCE,
      );
      for (
        let frameStep = previousFrameStep + 1;
        frameStep <= nextFrameStep;
        frameStep += 1
      ) {
        if (FOOT_CONTACT_FRAMES.has(frameStep % AVATAR_FRAME_COUNTS.walk)) {
          emitAudio({ type: 'footstep', surface: this.blueprint.surface });
        }
      }
      this.playerWalkFrame = nextFrameStep % AVATAR_FRAME_COUNTS.walk;
    } else if (this.playerMoving) {
      this.resetPlayerAnimation(time);
    }
    this.playerMoving = actuallyMoving;
  }

  private stopPlayer(time = this.time.now): void {
    this.player.setVelocity(0, 0);
    this.playerLastPhysicsPosition = { x: this.player.x, y: this.player.y };
    if (this.playerMoving || this.playerMovementRequested) {
      this.resetPlayerAnimation(time);
    }
    this.playerMovementRequested = false;
    this.playerMoving = false;
  }

  private updateActorVisuals(time: number): void {
    const frame = this.playerMoving
      ? this.playerWalkFrame
      : Math.floor((time - this.playerAnimationStartedAt) / 1_400) %
        AVATAR_FRAME_COUNTS.idle;
    const textureKey = this.avatarKey(
      this.playerDirection,
      this.playerMoving,
      frame,
    );
    const renderX = Math.round(this.player.x);
    const renderY = Math.round(this.player.y);
    if (this.playerVisual.texture.key !== textureKey) {
      this.playerVisual.setTexture(textureKey);
    }
    this.playerVisual
      .setPosition(renderX, renderY)
      .setDepth(DEPTH.actor + renderY);
    this.playerShadow
      .setPosition(renderX + 2, renderY - 1)
      .setDepth(DEPTH.shadow + renderY);
    this.updatePlayerGrounding();

    if (this.interactionMarker?.active && this.nearestInteraction) {
      this.interactionMarker
        .setPosition(
          this.nearestInteraction.x,
          this.nearestInteraction.y - 35 + Math.round(Math.sin(time / 165) * 2),
        )
        .setDepth(DEPTH.placement + this.nearestInteraction.y);
    }
  }

  /**
   * Pixel-stepped ambient occlusion at the soles and a short lower-right cast
   * shadow make the avatar sit on both tatami and garden paths. The footprint
   * is visual-only; physics and placement remain unchanged.
   */
  private updatePlayerGrounding(): void {
    if (!this.playerGroundContact?.active || !this.player?.active) return;
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    const palette = this.blueprint?.id === 'room'
      ? { cast: 0x5f664b, contact: 0x3e4d3f, bounce: 0xd3bf79 }
      : this.blueprint?.id === 'cafe'
        ? { cast: 0x5c4d43, contact: 0x3c3733, bounce: 0xcaa36d }
        : this.blueprint?.id === 'park'
          ? { cast: 0x3f5960, contact: 0x29434a, bounce: 0xa8b99a }
          : { cast: 0x52653d, contact: 0x2d4a37, bounce: 0xb6ba7c };
    const contact = this.playerGroundContact.clear();

    // Sun/canopy light arrives from the upper left: shadow breaks down-right.
    contact.fillStyle(palette.cast, 0.25);
    contact.fillRect(x - 1, y - 1, 12, 2);
    contact.fillRect(x + 1, y - 2, 7, 1);
    contact.fillStyle(palette.contact, 0.5);
    contact.fillRect(x - 5, y - 1, 10, 2);
    contact.fillRect(x - 3, y - 2, 6, 1);
    contact.fillStyle(palette.bounce, 0.28);
    contact.fillRect(x - 2, y - 2, 4, 1);
    contact.setDepth(DEPTH.shadow + y + 0.05);
  }

  private resetPlayerAnimation(time: number): void {
    this.playerAnimationStartedAt = time;
    this.playerWalkDistance = 0;
    this.playerWalkFrame = 0;
  }

  private isExplorationInputSuspended(): boolean {
    return Boolean(
      this.transitionActive ||
      this.placement ||
      systemRuntime.getState().study.activeSession ||
      this.isWorldUiBlocking()
    );
  }

  private isWorldUiBlocking(): boolean {
    if (this.isModalOrDialogueBlocking()) return true;
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.querySelector('.kh-ui .kh-decor-tray'),
    );
  }

  private isModalOrDialogueBlocking(): boolean {
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.querySelector(
        '.kh-ui [aria-modal="true"], .kh-ui .kh-dialogue',
      ),
    );
  }

  private hasRawKeyboardMovement(): boolean {
    return Boolean(
      this.keys.left.isDown ||
      this.keys.right.isDown ||
      this.keys.up.isDown ||
      this.keys.down.isDown ||
      this.cursorKeys.left.isDown ||
      this.cursorKeys.right.isDown ||
      this.cursorKeys.up.isDown ||
      this.cursorKeys.down.isDown
    );
  }

  private clearExplorationMotionIntent(): void {
    this.touchDirections.clear();
    this.directMove = { x: 0, y: 0, running: false };
    this.clickTarget = null;
  }

  private updateNearestInteraction(): void {
    let nearest: InteractionDefinition | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const interaction of this.blueprint.interactions) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        interaction.x,
        interaction.y,
      );
      const radius = interaction.radius ?? INTERACTION_RADIUS;
      if (distance <= radius && distance < nearestDistance) {
        nearest = interaction;
        nearestDistance = distance;
      }
    }
    if (nearest !== this.nearestInteraction) {
      this.nearestInteraction = nearest;
      this.interactionMarker?.setVisible(nearest !== null);
      this.publishState(true);
    }
  }

  private avatarKey(
    direction: Direction,
    moving: boolean,
    frame: number,
  ): string {
    const richKey = avatarTextureKey(
      direction,
      moving ? 'walk' : 'idle',
      frame,
    );
    return this.textures.exists(richKey)
      ? richKey
      : ART_KEYS.avatar(direction, frame % 2 === 0 ? 0 : 1);
  }

  private performInteraction(): void {
    if (this.transitionActive) return;
    if (this.placement) {
      this.confirmPlacement();
      return;
    }
    if (this.isWorldUiBlocking()) return;
    const interaction = this.nearestInteraction;
    if (!interaction) return;
    emitAudio({ type: 'interact' });
    dispatchGameEvent(GAME_EVENTS.interaction, {
      location: this.blueprint.id,
      interaction,
    });

    switch (interaction.kind) {
      case 'study':
        audio.setStudyActive(true);
        dispatchGameEvent(GAME_EVENTS.study, {
          location: this.blueprint.id,
          stationId: interaction.id,
          stationLabel: interaction.label,
          suggestedMinutes:
            this.blueprint.id === 'cafe' ? [25, 45, 60] : [10, 25, 45],
        });
        emitToast('Your study corner is ready whenever you are.', 'success');
        break;
      case 'shop':
        dispatchGameEvent(GAME_EVENTS.openShop, {
          location: this.blueprint.id,
        });
        break;
      case 'read':
        audio.playSfx('page-turn');
        emitToast(interaction.message ?? 'You read for a quiet moment.');
        this.createInteractionBurst(interaction.x, interaction.y, 0xe7d5a4);
        break;
      case 'water':
        emitToast(interaction.message ?? 'The garden drinks deeply.', 'success');
        this.createInteractionBurst(interaction.x, interaction.y, 0x8fbcb5);
        break;
      case 'drink':
      case 'listen':
      case 'observe':
      case 'rest':
        emitToast(interaction.message ?? interaction.label);
        this.createInteractionBurst(interaction.x, interaction.y, 0xf0cf91);
        break;
      case 'travel':
        if (interaction.destination) {
          this.travelTo(interaction.destination, interaction.spawnId);
        }
        break;
    }
  }

  private checkPortals(time: number): void {
    if (time < this.portalCooldownUntil) return;
    const point = { x: this.player.x, y: this.player.y };
    const portal = this.blueprint.portals.find((candidate) =>
      pointInRect(point, candidate),
    );
    if (!portal) return;
    this.portalCooldownUntil = time + 1_000;
    this.travelTo(portal.destination, portal.destinationSpawn);
  }

  private firstAvailableItem(): string | null {
    for (const [itemId, owned] of Object.entries(this.savedState.ownedItems)) {
      if (owned <= 0) continue;
      const definition = sceneDecorById(itemId);
      if (!definition?.locations.includes(this.blueprint.id)) continue;
      const placed = this.savedState.placedDecor.filter(
        (item) => item.itemId === itemId,
      ).length;
      if (placed < owned) return itemId;
    }
    return null;
  }

  private beginPlacement(
    itemId: string,
    existingInstanceId?: string,
    pointerDrag = false,
  ): void {
    if (this.transitionActive) return;
    const definition = sceneDecorById(itemId);
    if (!definition) {
      emitToast('That item is still being unpacked.', 'warning');
      return;
    }
    if (
      !this.blueprint.placementAreas.length ||
      !definition.locations.includes(this.blueprint.id)
    ) {
      emitToast(
        this.blueprint.id === 'garden'
          ? 'This belongs inside the house.'
          : 'Decorating is available at home and in the garden.',
        'warning',
      );
      return;
    }

    if (!existingInstanceId) {
      const owned = this.savedState.ownedItems[itemId] ?? 0;
      const placed = this.savedState.placedDecor.filter(
        (item) => item.itemId === itemId,
      ).length;
      if (owned <= placed) {
        emitToast('You do not have a free one in your inventory.', 'warning');
        return;
      }
    }

    this.placementSerial += 1;
    this.cancelPlacement(false);
    const existing = existingInstanceId
      ? this.savedState.placedDecor.find(
          (item) => item.instanceId === existingInstanceId,
        )
      : undefined;
    const rotation = this.supportedFurnitureRotation(
      definition.id,
      existing?.rotation ?? 0,
    );
    const direction = directionVector(this.playerDirection);
    const start = existing ?? {
      x: snapWorldCoordinate(this.player.x + direction.x * 32),
      y: snapWorldCoordinate(this.player.y + direction.y * 32),
      rotation,
    };
    const preview = this.add
      .image(
        start.x,
        start.y,
        this.resolveFurnitureTextureKey(definition, rotation),
      )
      .setOrigin(0.5, 1)
      .setAlpha(0.72)
      .setDepth(DEPTH.placement + start.y);
    const footprint = this.add.graphics().setDepth(DEPTH.placement - 2);
    const cursor = this.add
      .image(start.x, start.y + 3, ART_KEYS.cursorValid)
      .setDepth(DEPTH.placement + start.y + 1);
    this.placement = {
      definition,
      preview,
      footprint,
      cursor,
      rotation,
      existingInstanceId,
      x: start.x,
      y: start.y,
      valid: false,
      pointerDrag,
    };
    const original = existingInstanceId
      ? this.decorSprites.get(existingInstanceId)
      : undefined;
    original?.setVisible(false);
    this.playPlacementFeedback('pickup');
    this.updatePlacement(start.x, start.y);
    this.publishState(true);
  }

  private updatePlacementFromPointer(): void {
    if (!this.placement || !this.lastPointerWorld) return;
    this.updatePlacement(this.lastPointerWorld.x, this.lastPointerWorld.y);
  }

  private updatePlacement(x: number, y: number): void {
    const placement = this.placement;
    if (!placement) return;
    placement.x = snapWorldCoordinate(x);
    placement.y = snapWorldCoordinate(y);
    const candidateId =
      placement.existingInstanceId ??
      `preview-${placement.definition.id}-${this.placementSerial}`;
    const validation = validateScenePlacement(
      this.blueprint,
      this.savedState.placedDecor,
      placement.definition,
      candidateId,
      placement.x,
      placement.y,
      placement.rotation,
      placement.existingInstanceId,
    );
    placement.valid =
      validation.ok &&
      this.placementMountValid(
        placement.x,
        placement.y,
        placement.definition,
      ) &&
      !this.playerOverlapsPlacement(
        placement.x,
        placement.y,
        placement.definition,
        placement.rotation,
      );

    placement.preview
      .setPosition(placement.x, placement.y)
      .setAngle(0)
      .setAlpha(placement.valid ? 0.78 : 0.4)
      .setTint(placement.valid ? 0xffffff : 0xd78376)
      .setDepth(DEPTH.placement + placement.y);
    const previewTextureKey = this.resolveFurnitureTextureKey(
      placement.definition,
      placement.rotation,
    );
    if (placement.preview.texture.key !== previewTextureKey) {
      placement.preview.setTexture(previewTextureKey);
    }
    placement.cursor
      .setTexture(
        placement.valid ? ART_KEYS.cursorValid : ART_KEYS.cursorInvalid,
      )
      .setPosition(placement.x, placement.y + 4)
      .setDepth(DEPTH.placement + placement.y + 1);
    this.redrawPlacementFootprint();
  }

  private redrawPlacementFootprint(): void {
    const placement = this.placement;
    if (!placement) return;
    const rotated =
      placement.rotation === 90 || placement.rotation === 270;
    const width = rotated
      ? placement.definition.footprint.height
      : placement.definition.footprint.width;
    const height = rotated
      ? placement.definition.footprint.width
      : placement.definition.footprint.height;
    const color = placement.valid ? 0xb9d486 : 0xe59b88;
    placement.footprint.clear();
    placement.footprint.fillStyle(color, 0.22);
    placement.footprint.fillRect(
      placement.x - width / 2,
      placement.y - height,
      width,
      height,
    );
    placement.footprint.lineStyle(1, color, 0.95);
    placement.footprint.strokeRect(
      placement.x - width / 2,
      placement.y - height,
      width,
      height,
    );
    for (
      let gridX = placement.x - width / 2 + WORLD_GRID;
      gridX < placement.x + width / 2;
      gridX += WORLD_GRID
    ) {
      placement.footprint.lineBetween(
        gridX,
        placement.y - height,
        gridX,
        placement.y,
      );
    }
    for (
      let gridY = placement.y - height + WORLD_GRID;
      gridY < placement.y;
      gridY += WORLD_GRID
    ) {
      placement.footprint.lineBetween(
        placement.x - width / 2,
        gridY,
        placement.x + width / 2,
        gridY,
      );
    }
  }

  private rotatePlacement(): void {
    if (!this.placement) return;
    const rotations = furnitureSupportedRotations(
      this.placement.definition.id,
    );
    if (rotations.length <= 1) {
      // The UI optimistically updates its local rotation label after issuing
      // the command. Re-publish on the next game tick so 0-only upright art
      // remains an honest no-op without flashing a mismatched footprint.
      this.time.delayedCall(0, () => this.publishState(true));
      return;
    }
    const index = rotations.indexOf(this.placement.rotation);
    this.placement.rotation = rotations[(index + 1) % rotations.length] ?? 0;
    emitAudio({ type: 'rotate' });
    this.updatePlacement(this.placement.x, this.placement.y);
    this.publishState(true);
  }

  private supportedFurnitureRotation(
    itemId: string,
    rotation: FurnitureRotation,
  ): FurnitureRotation {
    const supported = furnitureSupportedRotations(itemId);
    return supported.includes(rotation) ? rotation : (supported[0] ?? 0);
  }

  /**
   * Old saves may contain quarter turns created before directional cels were
   * classified. Normalize once at the scene boundary so render, collision,
   * tabletop support, validation, and snapshots all consume the same honest
   * orientation. Moving the item later commits that normalized value.
   */
  private readWorldState(): SavedWorldState {
    const state = systemRuntime.getWorldState();
    return {
      ...state,
      placedDecor: state.placedDecor.map((placement) => {
        const rotation = this.supportedFurnitureRotation(
          placement.itemId,
          placement.rotation,
        );
        return rotation === placement.rotation
          ? placement
          : { ...placement, rotation };
      }),
    };
  }

  private resolveFurnitureTextureKey(
    definition: DecorDefinition,
    rotation: FurnitureRotation,
  ): string {
    const supportedRotation = this.supportedFurnitureRotation(
      definition.id,
      rotation,
    );
    const authoredKey = furnitureTextureKey(
      definition.id,
      0,
      supportedRotation,
    );
    return this.textures.exists(authoredKey)
      ? authoredKey
      : resolveDecorTextureKey(this.textures, definition);
  }

  private confirmPlacement(): void {
    const placement = this.placement;
    if (!placement) return;
    if (!placement.valid) {
      this.playPlacementFeedback('drop', false);
      this.cameras.main.shake(90, 0.002);
      emitToast('That spot is blocked. Try a clear patch of the grid.', 'warning');
      return;
    }

    const committed = systemRuntime.commitPlacement(
      {
        itemId: placement.definition.id,
        location: this.blueprint.id,
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
      },
      placement.existingInstanceId,
    );
    if (!committed.ok) {
      this.playPlacementFeedback('drop', false);
      this.cameras.main.shake(90, 0.002);
      emitToast(
        committed.message ?? 'That placement could not be saved.',
        'warning',
      );
      return;
    }

    this.playPlacementFeedback('drop');
    emitToast(`${placement.definition.name} found its place.`, 'success');
    this.destroyPlacementObjects();
    this.savedState = this.readWorldState();
    this.renderPlacedDecor();
    this.rebuildCollisionBodies();
    this.publishState(true);
  }

  private playPlacementFeedback(
    phase: 'pickup' | 'drop',
    valid = true,
  ): void {
    const placement = this.placement;
    if (!placement) return;
    const footprintArea =
      placement.definition.footprint.width *
      placement.definition.footprint.height;
    const weight =
      placement.definition.category === 'soft' ||
      placement.definition.category === 'tabletop' ||
      footprintArea <= 192
        ? 'light'
        : footprintArea >= 768
          ? 'heavy'
          : 'medium';
    const view = this.cameras.main.worldView;
    const halfViewWidth = Math.max(1, view.width / 2);

    audio.playPlacementCue({
      phase,
      valid,
      weight,
      pan: Phaser.Math.Clamp(
        (placement.x - view.centerX) / halfViewWidth,
        -1,
        1,
      ),
    });
  }

  private storeCurrentPlacement(): void {
    const instanceId = this.placement?.existingInstanceId;
    if (!instanceId) {
      this.cancelPlacement();
      return;
    }
    const name = this.placement?.definition.name ?? 'Decoration';
    const result = systemRuntime.storePlacement(instanceId);
    if (!result.ok) {
      emitToast(result.message ?? 'That item could not be stored.', 'warning');
      return;
    }
    this.destroyPlacementObjects();
    this.savedState = this.readWorldState();
    this.renderPlacedDecor();
    this.rebuildCollisionBodies();
    emitToast(`${name} is safely back in your tray.`, 'success');
    this.publishState(true);
  }

  private cancelPlacement(playSound = true): void {
    if (!this.placement) return;
    const original = this.placement.existingInstanceId
      ? this.decorSprites.get(this.placement.existingInstanceId)
      : undefined;
    original?.setVisible(true);
    this.destroyPlacementObjects();
    if (playSound) emitAudio({ type: 'ui', action: 'back' });
    this.publishState(true);
  }

  private destroyPlacementObjects(): void {
    if (!this.placement) return;
    this.placement.preview.destroy();
    this.placement.footprint.destroy();
    this.placement.cursor.destroy();
    this.placement = null;
  }

  private purchaseItem(itemId: string): void {
    if (
      this.lastPurchase?.itemId === itemId &&
      this.time.now - this.lastPurchase.at < 360
    ) {
      return;
    }
    this.lastPurchase = { itemId, at: this.time.now };
    const definition = sceneDecorById(itemId);
    if (!definition) {
      emitToast('That item is not in today’s catalog.', 'warning');
      return;
    }
    const result = systemRuntime.purchase(itemId);
    if (!result.ok) {
      audio.playSfx('place-invalid');
      emitToast(
        result.error.code === 'INSUFFICIENT_FUNDS'
          ? 'A few more Hikari will bring it home.'
          : result.error.message,
        'warning',
      );
      return;
    }
    this.savedState = this.readWorldState();
    audio.playSfx('purchase');
    this.time.delayedCall(120, () => audio.playSfx('coin'));
    emitToast(`${definition.name} is now in your decorating tray.`, 'success');
    this.publishState(true);
  }

  private decorBlocksMovement(definition: DecorDefinition): boolean {
    return (
      definition.category !== 'soft' &&
      definition.category !== 'tabletop' &&
      definition.placementSurface !== 'tabletop' &&
      definition.placementSurface !== 'wall' &&
      definition.placementSurface !== 'ceiling'
    );
  }

  private playerOverlapsPlacement(
    x: number,
    y: number,
    definition: DecorDefinition,
    rotation: 0 | 90 | 180 | 270,
  ): boolean {
    if (!this.decorBlocksMovement(definition)) return false;
    const rotated = rotation === 90 || rotation === 270;
    const width = rotated
      ? definition.footprint.height
      : definition.footprint.width;
    const height = rotated
      ? definition.footprint.width
      : definition.footprint.height;
    return pointInRect(
      { x: this.player.x, y: this.player.y - 3 },
      {
        x: x - width / 2 - 6,
        y: y - height - 6,
        width: width + 12,
        height: height + 12,
      },
    );
  }

  private placementMountValid(
    x: number,
    y: number,
    definition: DecorDefinition,
  ): boolean {
    const mount = definition.placementMount;
    if (!mount) {
      if (definition.placementSurface === 'tabletop') {
        return this.hasTabletopSupport(x, y);
      }
      return true;
    }

    let context: PlacementSupportContext;
    switch (mount.type) {
      case 'support-socket':
        context = this.hasTabletopSupport(x, y)
          ? { plane: 'support', socket: 'tabletop' }
          : {
              plane: this.blueprint.id === 'garden' ? 'outdoor' : 'floor',
              surface: this.blueprint.surface === 'grass' ? 'grass' : this.blueprint.surface,
            };
        break;
      case 'wall-grid':
        context =
          this.blueprint.id === 'room' && y <= 132
            ? { plane: 'wall', socket: 'wall' }
            : {
                plane: this.blueprint.id === 'garden' ? 'outdoor' : 'floor',
                surface: this.blueprint.surface === 'grass' ? 'grass' : this.blueprint.surface,
              };
        break;
      case 'ceiling-hook':
        context =
          this.blueprint.id === 'room' && y <= 124
            ? { plane: 'ceiling', socket: 'ceiling' }
            : { plane: 'floor', surface: 'tatami' };
        break;
      case 'water-edge': {
        const pond = { x: 328, y: 212, width: 156, height: 92 };
        const nearHorizontalEdge =
          x >= pond.x - 18 &&
          x <= pond.x + pond.width + 18 &&
          (Math.abs(y - pond.y) <= 18 ||
            Math.abs(y - (pond.y + pond.height)) <= 18);
        const nearVerticalEdge =
          y >= pond.y - 18 &&
          y <= pond.y + pond.height + 18 &&
          (Math.abs(x - pond.x) <= 18 ||
            Math.abs(x - (pond.x + pond.width)) <= 18);
        context = {
          plane: 'outdoor',
          surface: 'stone',
          adjacentSurfaces:
            this.blueprint.id === 'garden' &&
            (nearHorizontalEdge || nearVerticalEdge)
              ? ['water']
              : [],
        };
        break;
      }
      case 'floor-grid':
        context = {
          plane: mount.plane,
          surface:
            this.blueprint.surface === 'grass'
              ? 'grass'
              : this.blueprint.surface,
        };
        break;
    }
    return placementMountFits(mount, context);
  }

  private hasTabletopSupport(x: number, y: number): boolean {
    return Boolean(
      tabletopSupportAt(
        this.savedState.placedDecor,
        this.blueprint.id,
        x,
        y,
      ),
    );
  }

  private createAmbient(): void {
    this.ambientMotes.forEach((mote) => mote.image.destroy());
    this.ambientMotes = [];
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = reducedMotion
      ? 5
      : this.blueprint.ambience === 'petals'
        ? 22
        : this.blueprint.ambience === 'dust'
          ? 14
          : 12;
    let seed =
      [...this.blueprint.id].reduce(
        (value, character) => value + character.charCodeAt(0),
        0,
      ) * 2654435761;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const key =
      this.blueprint.ambience === 'petals'
        ? ART_KEYS.petal
        : this.blueprint.ambience === 'steam'
          ? ART_KEYS.steam
          : this.blueprint.ambience === 'fireflies'
            ? ART_KEYS.firefly
            : ART_KEYS.dust;

    for (let index = 0; index < count; index += 1) {
      let x = random() * this.blueprint.bounds.width;
      let y = random() * this.blueprint.bounds.height;
      if (this.blueprint.ambience === 'steam') {
        x = index % 2 ? 266 + (random() - 0.5) * 34 : 466 + (random() - 0.5) * 34;
        y = 204 + random() * 22;
      }
      const image = this.add
        .image(x, y, key)
        .setDepth(DEPTH.weather + y)
        .setAlpha(0.25 + random() * 0.55);
      this.ambientMotes.push({
        image,
        x,
        y,
        originX: x,
        originY: y,
        velocityX:
          this.blueprint.ambience === 'petals'
            ? 4 + random() * 6
            : (random() - 0.5) * 2,
        velocityY:
          this.blueprint.ambience === 'steam'
            ? -(3 + random() * 4)
            : this.blueprint.ambience === 'petals'
              ? 5 + random() * 8
              : (random() - 0.5) * 1.2,
        phase: random() * Math.PI * 2,
        kind: this.blueprint.ambience,
      });
    }
  }

  private updateAmbient(time: number, delta: number): void {
    const seconds = Math.min(delta, 50) / 1_000;
    const bounds = this.blueprint.bounds;
    for (const mote of this.ambientMotes) {
      const wave = Math.sin(time / 700 + mote.phase);
      mote.x += (mote.velocityX + wave * 1.5) * seconds;
      mote.y += mote.velocityY * seconds;
      switch (mote.kind) {
        case 'dust':
          mote.image.setAlpha(0.18 + (wave + 1) * 0.16);
          if (Math.abs(mote.x - mote.originX) > 18) mote.x = mote.originX;
          if (Math.abs(mote.y - mote.originY) > 12) mote.y = mote.originY;
          break;
        case 'petals':
          if (
            mote.y > bounds.y + bounds.height ||
            mote.x > bounds.x + bounds.width
          ) {
            mote.x = bounds.x;
            mote.y = bounds.y + (mote.phase % 1) * bounds.height;
          }
          break;
        case 'steam':
          mote.image.setAlpha(
            Phaser.Math.Clamp(
              0.7 - (mote.originY - mote.y) / 40,
              0,
              0.6,
            ),
          );
          if (mote.y < mote.originY - 34) {
            mote.x = mote.originX;
            mote.y = mote.originY;
          }
          break;
        case 'fireflies':
          mote.image.setAlpha(0.15 + (wave + 1) * 0.35);
          if (Math.abs(mote.x - mote.originX) > 24) mote.x = mote.originX;
          if (Math.abs(mote.y - mote.originY) > 20) mote.y = mote.originY;
          break;
      }
      const renderX = Math.round(mote.x);
      const renderY = Math.round(mote.y);
      mote.image
        .setPosition(renderX, renderY)
        .setDepth(DEPTH.weather + renderY);
    }
  }

  private createInteractionMarker(): void {
    this.interactionMarker?.destroy();
    this.interactionMarker = this.add
      .image(0, 0, ART_KEYS.interaction)
      .setVisible(false)
      .setDepth(DEPTH.placement);
    this.locationObjects.push(this.interactionMarker);
  }

  private createInteractionBurst(x: number, y: number, color: number): void {
    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7;
      const sparkle = this.add
        .rectangle(x, y - 10, 2, 2, color, 0.85)
        .setDepth(DEPTH.weather + y);
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * (14 + (index % 3) * 4),
        y: y - 12 + Math.sin(angle) * (10 + (index % 2) * 5),
        alpha: 0,
        duration: 480,
        ease: 'Quad.easeOut',
        onUpdate: () =>
          sparkle.setPosition(Math.round(sparkle.x), Math.round(sparkle.y)),
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  private applyMoveCommand(
    payload:
      | { x: number; y: number; running?: boolean }
      | { direction: Direction; active: boolean; running?: boolean },
  ): void {
    if ('direction' in payload) {
      if (payload.active && this.isExplorationInputSuspended()) return;
      if (payload.active) this.touchDirections.add(payload.direction);
      else this.touchDirections.delete(payload.direction);
      this.directMove.running = payload.running ?? false;
      return;
    }
    if (this.isExplorationInputSuspended()) {
      this.directMove = { x: 0, y: 0, running: false };
      return;
    }
    const movement = normalizeVector(payload.x, payload.y);
    this.directMove = {
      x: movement.x,
      y: movement.y,
      running: payload.running ?? false,
    };
  }

  private syncFromAuthority(): void {
    const previousPlacements = JSON.stringify(this.savedState.placedDecor);
    this.savedState = this.readWorldState();
    if (
      this.blueprint &&
      previousPlacements !== JSON.stringify(this.savedState.placedDecor)
    ) {
      this.renderPlacedDecor();
      this.rebuildCollisionBodies();
    }
    if (this.blueprint) this.publishState(true);
  }

  private publishState(force = false): void {
    const snapshot = this.getSnapshot();
    const signature = JSON.stringify({
      location: snapshot.location,
      coins: snapshot.coins,
      mode: snapshot.mode,
      selectedItem: snapshot.selectedItem,
      editingExisting: snapshot.editingExisting,
      rotation: snapshot.rotation,
      placementValid: snapshot.placementValid,
      prompt: snapshot.prompt,
      ownedItems: snapshot.ownedItems,
      placedCount: snapshot.placedDecor.length,
    });
    if (!force && signature === this.lastSnapshotSignature) return;
    this.lastSnapshotSignature = signature;
    emitWorldState(snapshot);
    this.game.canvas.dataset.location = snapshot.location;
    this.game.canvas.dataset.mode = snapshot.mode;
    this.game.canvas.dataset.placementValid = String(snapshot.placementValid);
  }

  private installQaHandle(): void {
    if (typeof window === 'undefined') return;
    this.qaHandle = {
      getState: () => this.getSnapshot(),
      command: (command) => this.handleCommand(command),
      travel: (location, spawnId) => this.travelTo(location, spawnId),
      grantCoins: (amount) => {
        if (!Number.isFinite(amount)) return;
        if (systemRuntime.grantCoins(Math.floor(amount))) {
          this.savedState = this.readWorldState();
          this.publishState(true);
        }
      },
      setPlayerWorld: (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        this.player.setPosition(
          Phaser.Math.Clamp(
            x,
            this.blueprint.bounds.x + 8,
            this.blueprint.bounds.x + this.blueprint.bounds.width - 8,
          ),
          Phaser.Math.Clamp(
            y,
            this.blueprint.bounds.y + 8,
            this.blueprint.bounds.y + this.blueprint.bounds.height - 8,
          ),
        );
        this.stopPlayer();
      },
      getPlayer: () => ({
        x: this.player.x,
        y: this.player.y,
        direction: this.playerDirection,
        moving: this.playerMoving,
      }),
      getPlacedDecor: () =>
        this.savedState.placedDecor.map((item) => ({ ...item })),
      getPlacementTargets: (itemId) => this.getQaPlacementTargets(itemId),
      getNavigationAnchors: () =>
        Object.fromEntries(
          Object.entries(this.blueprint.spawns).map(([id, point]) => [
            id,
            { ...point },
          ]),
        ),
    };
    const globals = window as typeof window & {
      __KOMOREBI_WORLD_SCENE__?: WorldSceneQaHandle;
    };
    globals.__KOMOREBI_WORLD_SCENE__ = this.qaHandle;
    this.registry.set('komorebi:world-scene', this);
  }

  private getQaPlacementTargets(
    itemId: string,
  ): Array<{ x: number; y: number; valid: boolean; reason?: string }> {
    const definition = sceneDecorById(itemId);
    if (!definition || !definition.locations.includes(this.blueprint.id)) {
      return [];
    }
    const targets: Array<{
      x: number;
      y: number;
      valid: boolean;
      reason?: string;
    }> = [];
    const candidateId = `qa-preview-${itemId}`;

    for (const area of this.blueprint.placementAreas) {
      // Boundary probes guarantee QA has meaningful rejection cases, while the
      // rest of the samples stay sparse enough to query instantly.
      const points: Point[] = [
        // Keep the guaranteed rejection probe in the unobscured middle of the
        // playfield. A left-edge probe lands beneath the Places rail and never
        // reaches Phaser in pointer-driven QA or real play.
        {
          x: snapWorldCoordinate(area.x + area.width / 2),
          y: area.y - WORLD_GRID,
        },
      ];
      for (
        let y = snapWorldCoordinate(area.y + WORLD_GRID);
        y <= area.y + area.height - WORLD_GRID;
        y += WORLD_GRID * 2
      ) {
        for (
          let x = snapWorldCoordinate(area.x + WORLD_GRID);
          x <= area.x + area.width - WORLD_GRID;
          x += WORLD_GRID * 2
        ) {
          points.push({ x, y });
        }
      }

      for (const point of points) {
        const validation = validateScenePlacement(
          this.blueprint,
          this.savedState.placedDecor,
          definition,
          candidateId,
          point.x,
          point.y,
          0,
        );
        const playerOverlap = this.playerOverlapsPlacement(
          point.x,
          point.y,
          definition,
          0,
        );
        const valid = validation.ok && !playerOverlap;
        const firstIssue = validation.issues[0]?.code;
        const reason =
          firstIssue === 'FOOTPRINT_CONFLICT'
            ? 'occupied'
            : firstIssue === 'OUTSIDE_WORLD'
              ? 'out-of-bounds'
              : firstIssue === 'ZONE_NOT_ALLOWED' ||
                  firstIssue === 'CELL_NOT_PLACEABLE' ||
                  firstIssue === 'SURFACE_NOT_ALLOWED'
                ? 'wrong-zone'
                : playerOverlap
                  ? 'blocks-route'
                  : firstIssue?.toLocaleLowerCase();
        targets.push({
          x: point.x,
          y: point.y,
          valid,
          ...(reason ? { reason } : {}),
        });
      }
    }
    return targets;
  }

  private destroyLocation(): void {
    this.destroyPlacementObjects();
    this.collisionHandles.forEach((collider) => collider.destroy());
    this.collisionHandles = [];
    this.collisionZones.forEach((zone) => zone.destroy());
    this.collisionZones = [];
    this.locationObjects.forEach((object) => {
      if (
        object !== this.player &&
        object !== this.playerVisual &&
        object !== this.playerShadow
      ) {
        object.destroy();
      }
    });
    this.locationObjects = [];
    this.decorObjects.forEach((object) => object.destroy());
    this.decorObjects = [];
    this.decorSprites.clear();
    this.ambientMotes.forEach((mote) => mote.image.destroy());
    this.ambientMotes = [];
    this.environment = null;
    this.interactionMarker?.destroy();
  }

  private cleanupScene(): void {
    this.cleanupCommandListener?.();
    this.cleanupCommandListener = null;
    this.cleanupAuthorityListener?.();
    this.cleanupAuthorityListener = null;
    if (typeof window !== 'undefined') {
      const globals = window as typeof window & {
        __KOMOREBI_WORLD_SCENE__?: WorldSceneQaHandle;
      };
      if (globals.__KOMOREBI_WORLD_SCENE__ === this.qaHandle) {
        delete globals.__KOMOREBI_WORLD_SCENE__;
      }
    }
    this.registry.remove('komorebi:world-scene');
    this.qaHandle = null;
    this.destroyLocation();
  }
}

export default WorldScene;
