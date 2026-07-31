import type {
  CanvasLike,
  PixelArt,
  PixelArtMetadata,
  PixelRect,
} from "./types";

export type PixelRotation = 0 | 90 | 180 | 270;

const clampByte = (value: number): number => Math.max(0, Math.min(255, value | 0));
const asInt = (value: number): number => Math.round(Number.isFinite(value) ? value : 0);

/** Stable FNV-1a seed; intentionally independent of JS engine random state. */
export function seedFrom(...parts: readonly (string | number)[]): number {
  const text = parts.join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface SeededRandom {
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(values: readonly T[]): T;
}

/** Mulberry32 with convenience methods for visual recipes. */
export function createSeededRandom(seed: number | string): SeededRandom {
  let state = typeof seed === "number" ? seed >>> 0 : seedFrom(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      const low = Math.ceil(Math.min(min, max));
      const high = Math.floor(Math.max(min, max));
      return low + Math.floor(next() * (high - low + 1));
    },
    chance(probability) {
      return next() < Math.max(0, Math.min(1, probability));
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) throw new Error("Cannot pick from an empty palette");
      return values[Math.floor(next() * values.length)]!;
    },
  };
}

/**
 * A tiny immediate-mode painter which records rectangles rather than touching a
 * rendering API.  Its polygon/line methods rasterize up front, guaranteeing
 * identical output in Canvas and Phaser.
 */
export class PixelPainter {
  readonly commands: PixelRect[] = [];
  private offsetX = 0;
  private offsetY = 0;

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    alpha = 1,
  ): this {
    const roundedWidth = asInt(width);
    const roundedHeight = asInt(height);
    if (roundedWidth <= 0 || roundedHeight <= 0 || alpha <= 0) return this;
    this.commands.push({
      x: asInt(x) + this.offsetX,
      y: asInt(y) + this.offsetY,
      width: roundedWidth,
      height: roundedHeight,
      color,
      alpha: Math.max(0, Math.min(1, alpha)),
    });
    return this;
  }

  pixel(x: number, y: number, color: string, alpha = 1): this {
    return this.rect(x, y, 1, 1, color, alpha);
  }

  hLine(x: number, y: number, length: number, color: string, thickness = 1): this {
    return this.rect(x, y, length, thickness, color);
  }

  vLine(x: number, y: number, length: number, color: string, thickness = 1): this {
    return this.rect(x, y, thickness, length, color);
  }

  frame(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    thickness = 1,
  ): this {
    this.rect(x, y, width, thickness, color);
    this.rect(x, y + height - thickness, width, thickness, color);
    this.rect(x, y + thickness, thickness, height - thickness * 2, color);
    this.rect(x + width - thickness, y + thickness, thickness, height - thickness * 2, color);
    return this;
  }

  checker(
    x: number,
    y: number,
    width: number,
    height: number,
    colorA: string,
    colorB: string,
    cell = 1,
  ): this {
    const size = Math.max(1, asInt(cell));
    for (let yy = 0; yy < height; yy += size) {
      for (let xx = 0; xx < width; xx += size) {
        this.rect(
          x + xx,
          y + yy,
          Math.min(size, width - xx),
          Math.min(size, height - yy),
          ((xx / size + yy / size) & 1) === 0 ? colorA : colorB,
        );
      }
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, thickness = 1): this {
    let currentX = asInt(x0);
    let currentY = asInt(y0);
    const targetX = asInt(x1);
    const targetY = asInt(y1);
    const deltaX = Math.abs(targetX - currentX);
    const stepX = currentX < targetX ? 1 : -1;
    const deltaY = -Math.abs(targetY - currentY);
    const stepY = currentY < targetY ? 1 : -1;
    let error = deltaX + deltaY;
    for (;;) {
      this.rect(currentX, currentY, thickness, thickness, color);
      if (currentX === targetX && currentY === targetY) break;
      const twiceError = error * 2;
      if (twiceError >= deltaY) {
        error += deltaY;
        currentX += stepX;
      }
      if (twiceError <= deltaX) {
        error += deltaX;
        currentY += stepY;
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, radiusX: number, radiusY: number, color: string, alpha = 1): this {
    const rx = Math.max(1, asInt(radiusX));
    const ry = Math.max(1, asInt(radiusY));
    for (let yy = -ry; yy <= ry; yy += 1) {
      const normalized = 1 - (yy * yy) / (ry * ry);
      const span = Math.floor(rx * Math.sqrt(Math.max(0, normalized)));
      this.rect(cx - span, cy + yy, span * 2 + 1, 1, color, alpha);
    }
    return this;
  }

  circle(cx: number, cy: number, radius: number, color: string, alpha = 1): this {
    return this.ellipse(cx, cy, radius, radius, color, alpha);
  }

  /**
   * Scanline-filled polygon. Useful for roofs, cast shadows, and 3/4 diamonds
   * without relying on anti-aliased canvas paths.
   */
  polygon(points: readonly (readonly [number, number])[], color: string, alpha = 1): this {
    if (points.length < 3) return this;
    const translated = points.map(([x, y]) => [asInt(x) + this.offsetX, asInt(y) + this.offsetY] as const);
    const minY = Math.min(...translated.map((point) => point[1]));
    const maxY = Math.max(...translated.map((point) => point[1]));
    for (let y = minY; y <= maxY; y += 1) {
      const crossings: number[] = [];
      for (let index = 0; index < translated.length; index += 1) {
        const [x1, y1] = translated[index]!;
        const [x2, y2] = translated[(index + 1) % translated.length]!;
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          crossings.push(Math.floor(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let index = 0; index + 1 < crossings.length; index += 2) {
        const start = crossings[index]!;
        const end = crossings[index + 1]!;
        // Coordinates are already translated, so compensate for the painter
        // offset before recording them through rect().
        this.rect(start - this.offsetX, y - this.offsetY, end - start + 1, 1, color, alpha);
      }
    }
    return this;
  }

  diamond(cx: number, cy: number, radiusX: number, radiusY: number, color: string, alpha = 1): this {
    return this.polygon(
      [
        [cx, cy - radiusY],
        [cx + radiusX, cy],
        [cx, cy + radiusY],
        [cx - radiusX, cy],
      ],
      color,
      alpha,
    );
  }

  withOffset(x: number, y: number, draw: (painter: PixelPainter) => void): this {
    const previousX = this.offsetX;
    const previousY = this.offsetY;
    this.offsetX += asInt(x);
    this.offsetY += asInt(y);
    draw(this);
    this.offsetX = previousX;
    this.offsetY = previousY;
    return this;
  }
}

export function makePixelArt(
  width: number,
  height: number,
  draw: (painter: PixelPainter) => void,
  metadata: PixelArtMetadata = {},
): PixelArt {
  const painter = new PixelPainter();
  draw(painter);
  return Object.freeze({
    width: Math.max(1, asInt(width)),
    height: Math.max(1, asInt(height)),
    commands: Object.freeze(painter.commands.map((command) => Object.freeze(command))),
    metadata: Object.freeze({ ...metadata }),
  });
}

/**
 * Integer-resamples a recipe before it reaches the renderer. This is used for
 * tiny tabletop props that share a 1× world atlas with the 36×48 avatar; the
 * browser never performs fractional texture scaling.
 */
export function scalePixelArt(art: PixelArt, scale: number): PixelArt {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError("Pixel art scale must be a positive finite number");
  }
  if (scale === 1) return art;
  const width = Math.max(1, Math.ceil(art.width * scale));
  const height = Math.max(1, Math.ceil(art.height * scale));
  const commands = art.commands.map((command) => {
    const x = Math.floor(command.x * scale);
    const y = Math.floor(command.y * scale);
    const right = Math.min(width, Math.max(x + 1, Math.ceil((command.x + command.width) * scale)));
    const bottom = Math.min(
      height,
      Math.max(y + 1, Math.ceil((command.y + command.height) * scale)),
    );
    return Object.freeze({
      ...command,
      x,
      y,
      width: right - x,
      height: bottom - y,
    });
  });
  const anchor = art.metadata.anchor
    ? {
        x: Math.min(width - 1, Math.max(0, Math.round(art.metadata.anchor.x * scale))),
        y: Math.min(height - 1, Math.max(0, Math.round(art.metadata.anchor.y * scale))),
      }
    : undefined;
  return Object.freeze({
    width,
    height,
    commands: Object.freeze(commands),
    metadata: Object.freeze({
      ...art.metadata,
      ...(anchor ? { anchor } : {}),
      tags: Object.freeze([...(art.metadata.tags ?? []), `authored-scale-${scale}`]),
    }),
  });
}

/**
 * Rotates a complete authored cel in 90-degree steps without asking Canvas or
 * Phaser to resample it at runtime. Rectangle clusters, frame bounds, and the
 * bottom contact anchor all stay on integer pixels.
 */
export function rotatePixelArt(
  art: PixelArt,
  rotation: PixelRotation,
): PixelArt {
  if (rotation === 0) return art;
  const width = rotation === 90 || rotation === 270 ? art.height : art.width;
  const height = rotation === 90 || rotation === 270 ? art.width : art.height;
  const commands = art.commands.map((command) => {
    if (rotation === 90) {
      return Object.freeze({
        ...command,
        x: art.height - command.y - command.height,
        y: command.x,
        width: command.height,
        height: command.width,
      });
    }
    if (rotation === 180) {
      return Object.freeze({
        ...command,
        x: art.width - command.x - command.width,
        y: art.height - command.y - command.height,
      });
    }
    return Object.freeze({
      ...command,
      x: command.y,
      y: art.width - command.x - command.width,
      width: command.height,
      height: command.width,
    });
  });
  const sourceAnchor = art.metadata.anchor;
  const anchor = sourceAnchor
    ? rotation === 90
      ? { x: art.height - 1 - sourceAnchor.y, y: sourceAnchor.x }
      : rotation === 180
        ? {
            x: art.width - 1 - sourceAnchor.x,
            y: art.height - 1 - sourceAnchor.y,
          }
        : { x: sourceAnchor.y, y: art.width - 1 - sourceAnchor.x }
    : undefined;
  return Object.freeze({
    width,
    height,
    commands: Object.freeze(commands),
    metadata: Object.freeze({
      ...art.metadata,
      ...(anchor ? { anchor: Object.freeze(anchor) } : {}),
      tags: Object.freeze([
        ...(art.metadata.tags ?? []).filter(
          (tag) => !tag.startsWith("rotation-"),
        ),
        `rotation-${rotation}`,
      ]),
    }),
  });
}

export function drawPixelArt(
  context: CanvasLike,
  art: PixelArt,
  x = 0,
  y = 0,
  scale = 1,
): void {
  const pixelScale = Math.max(1, asInt(scale));
  context.save?.();
  if ("imageSmoothingEnabled" in context) context.imageSmoothingEnabled = false;
  for (const command of art.commands) {
    context.fillStyle = command.color;
    context.globalAlpha = command.alpha;
    context.fillRect(
      asInt(x + command.x * pixelScale),
      asInt(y + command.y * pixelScale),
      command.width * pixelScale,
      command.height * pixelScale,
    );
  }
  context.globalAlpha = 1;
  context.restore?.();
}

/** A cheap stable signature used by QA to catch accidental recipe drift. */
export function pixelArtSignature(art: PixelArt): string {
  let hash = seedFrom(art.width, art.height, art.metadata.id ?? "");
  for (const command of art.commands) {
    hash = seedFrom(
      hash,
      command.x,
      command.y,
      command.width,
      command.height,
      command.color,
      Math.round(command.alpha * 255),
    );
  }
  return hash.toString(16).padStart(8, "0");
}

export function hexWithLightness(hex: string, delta: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return hex;
  const numeric = Number.parseInt(normalized, 16);
  const red = clampByte((numeric >> 16) + delta);
  const green = clampByte(((numeric >> 8) & 0xff) + delta);
  const blue = clampByte((numeric & 0xff) + delta);
  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}
