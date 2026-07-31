import {
  OUTFIT_PALETTES,
  PALETTE,
  type OutfitPaletteName,
} from "./palette";
import { makePixelArt, PixelPainter } from "./pixel";
import type {
  AvatarAction,
  AvatarDirection,
  CardinalDirection,
  PixelAnchor,
  PixelArt,
} from "./types";

/**
 * A separately authored presentation-scale avatar. None of this geometry is
 * resampled from the compact 24x32 predecessor sprite.
 */
export const HIRES_AVATAR_WIDTH = 36;
export const HIRES_AVATAR_HEIGHT = 48;
export const HIRES_AVATAR_ANCHOR = Object.freeze({
  x: 18,
  y: 45,
} satisfies PixelAnchor);
export const HIRES_AVATAR_FRAME_COUNTS = Object.freeze({
  idle: 2,
  walk: 4,
  study: 3,
  carry: 2,
} satisfies Record<AvatarAction, number>);

export interface AvatarAppearance {
  readonly outfit?: OutfitPaletteName;
  readonly skin?: "warm" | "golden" | "deep";
  readonly hair?: "espresso" | "chestnut" | "blue-black";
  readonly accessory?: "none" | "hairpin" | "glasses";
}

export type HiResAvatarAppearance = AvatarAppearance;

type Point = readonly [number, number];
type SkinName = NonNullable<AvatarAppearance["skin"]>;
type HairName = NonNullable<AvatarAppearance["hair"]>;
type Accessory = NonNullable<AvatarAppearance["accessory"]>;
type OutfitRamp = (typeof OUTFIT_PALETTES)[OutfitPaletteName];

const CONTOUR = Object.freeze({
  // World-facing contours intentionally stay chromatic and one step lighter
  // than a UI/icon outline.  The painted backplates have soft, weathered
  // edges, so this keeps the actor embedded in the light rather than stamped
  // over it.
  deep: "#463840",
  warm: "#624640",
  soft: "#806054",
  reflected: "#A97B68",
});

const SKIN = Object.freeze({
  warm: {
    contour: "#89584A",
    deep: "#A96B54",
    shadow: "#C98263",
    mid: "#E0A077",
    light: "#F4C194",
    blush: "#DD796A",
  },
  golden: {
    contour: "#774F42",
    deep: "#96654A",
    shadow: "#BB805A",
    mid: "#D99E6C",
    light: "#EDBC87",
    blush: "#CB735B",
  },
  deep: {
    contour: "#513B39",
    deep: "#694A43",
    shadow: "#8B5E4E",
    mid: "#AE7357",
    light: "#C88662",
    blush: "#A85F53",
  },
} satisfies Record<
  SkinName,
  {
    contour: string;
    deep: string;
    shadow: string;
    mid: string;
    light: string;
    blush: string;
  }
>);

const HAIR = Object.freeze({
  espresso: {
    contour: "#2B2024",
    deep: "#38262A",
    shadow: "#4B3033",
    mid: "#67413E",
    light: "#8B5B50",
    shine: "#B47762",
  },
  chestnut: {
    contour: "#493430",
    deep: "#5D3B35",
    shadow: "#75483E",
    mid: "#925B49",
    light: "#BD765A",
    shine: "#DFA079",
  },
  "blue-black": {
    contour: "#202232",
    deep: "#292C3F",
    shadow: "#353B51",
    mid: "#48536A",
    light: "#60768B",
    shine: "#819BA9",
  },
} satisfies Record<
  HairName,
  {
    contour: string;
    deep: string;
    shadow: string;
    mid: string;
    light: string;
    shine: string;
  }
>);

const OUTFIT_DETAIL = Object.freeze({
  indigo: {
    contour: "#294157",
    deep: "#35546A",
    weave: "#79A5B4",
    thread: "#A8C8C3",
  },
  moss: {
    contour: "#203E35",
    deep: "#2B4D3C",
    weave: "#7FA078",
    thread: "#A8BC8B",
  },
  sakura: {
    contour: "#533448",
    deep: "#684256",
    weave: "#D29598",
    thread: "#F2C7C0",
  },
  ember: {
    contour: "#74352F",
    deep: "#963F34",
    weave: "#F19A71",
    thread: "#FFD0A5",
  },
} satisfies Record<
  OutfitPaletteName,
  {
    contour: string;
    deep: string;
    weave: string;
    thread: string;
  }
>);

type SkinRamp = (typeof SKIN)[SkinName];
type HairRamp = (typeof HAIR)[HairName];
type OutfitDetail = (typeof OUTFIT_DETAIL)[OutfitPaletteName];

function mirrorPoints(
  points: readonly Point[],
  facingEast: boolean,
): readonly Point[] {
  return facingEast
    ? points
    : points.map(
        ([x, y]) => [HIRES_AVATAR_WIDTH - 1 - x, y] as const,
      );
}

function mirrorX(x: number, width: number, facingEast: boolean): number {
  return facingEast ? x : HIRES_AVATAR_WIDTH - x - width;
}

export function normalizeAvatarDirection(
  direction: AvatarDirection,
): CardinalDirection {
  if (direction === "up") return "north";
  if (direction === "right") return "east";
  if (direction === "down") return "south";
  if (direction === "left") return "west";
  return direction;
}

function polygon(
  painter: PixelPainter,
  points: readonly Point[],
  color: string,
): void {
  painter.polygon(points, color);
}

function paintFrontHead(
  painter: PixelPainter,
  bob: number,
  skin: SkinRamp,
  hair: HairRamp,
  blink: boolean,
  accessory: Accessory,
): void {
  const y = 1 + bob;

  // Hair silhouette, built as nested hand-shaped planes rather than a helmet.
  polygon(
    painter,
    [
      [13, y],
      [21, y],
      [25, y + 2],
      [28, y + 6],
      [29, y + 13],
      [29, y + 19],
      [27, y + 23],
      [24, y + 26],
      [20, y + 27],
      [13, y + 27],
      [9, y + 25],
      [7, y + 21],
      [6, y + 14],
      [7, y + 7],
      [10, y + 3],
    ],
    hair.contour,
  );
  polygon(
    painter,
    [
      [13, y + 1],
      [21, y + 1],
      [25, y + 3],
      [27, y + 7],
      [28, y + 14],
      [27, y + 21],
      [23, y + 25],
      [13, y + 25],
      [9, y + 22],
      [8, y + 15],
      [9, y + 7],
    ],
    hair.deep,
  );
  polygon(
    painter,
    [
      [11, y + 4],
      [16, y + 2],
      [23, y + 3],
      [26, y + 7],
      [27, y + 13],
      [25, y + 19],
      [22, y + 22],
      [18, y + 23],
      [13, y + 21],
      [10, y + 17],
      [9, y + 9],
    ],
    hair.mid,
  );
  polygon(
    painter,
    [
      [18, y + 3],
      [23, y + 4],
      [25, y + 7],
      [26, y + 12],
      [24, y + 16],
      [22, y + 13],
      [21, y + 7],
    ],
    hair.shadow,
  );

  // Ears and a softly outlined face plane.
  painter.rect(8, y + 12, 4, 7, skin.contour);
  painter.rect(9, y + 13, 3, 5, skin.shadow);
  painter.pixel(10, y + 14, skin.light);
  painter.rect(24, y + 12, 4, 7, skin.contour);
  painter.rect(24, y + 13, 3, 5, skin.shadow);
  painter.pixel(25, y + 14, skin.light);
  polygon(
    painter,
    [
      [12, y + 7],
      [23, y + 7],
      [25, y + 10],
      [25, y + 17],
      [23, y + 22],
      [20, y + 24],
      [15, y + 24],
      [11, y + 21],
      [10, y + 17],
      [10, y + 11],
    ],
    skin.contour,
  );
  polygon(
    painter,
    [
      [13, y + 8],
      [22, y + 8],
      [24, y + 11],
      [24, y + 17],
      [22, y + 21],
      [19, y + 23],
      [15, y + 22],
      [12, y + 20],
      [11, y + 16],
      [11, y + 11],
    ],
    skin.mid,
  );
  polygon(
    painter,
    [
      [13, y + 9],
      [17, y + 8],
      [17, y + 21],
      [15, y + 21],
      [12, y + 18],
      [12, y + 12],
    ],
    skin.light,
  );
  painter.vLine(23, y + 12, 6, skin.shadow);
  painter.pixel(22, y + 19, skin.shadow);

  // Broken fringe, temple locks, and small directional highlight clusters.
  polygon(
    painter,
    [
      [9, y + 7],
      [12, y + 4],
      [18, y + 3],
      [24, y + 5],
      [26, y + 8],
      [24, y + 11],
      [22, y + 9],
      [20, y + 13],
      [18, y + 9],
      [16, y + 12],
      [14, y + 8],
      [12, y + 12],
      [10, y + 10],
    ],
    hair.shadow,
  );
  polygon(
    painter,
    [
      [11, y + 6],
      [14, y + 3],
      [19, y + 3],
      [16, y + 6],
      [15, y + 9],
      [13, y + 7],
    ],
    hair.light,
  );
  painter.hLine(14, y + 2, 6, hair.shine);
  painter.hLine(12, y + 3, 3, hair.light);
  painter.pixel(10, y + 5, hair.shine);
  painter.vLine(8, y + 13, 9, hair.deep);
  painter.vLine(27, y + 12, 9, hair.contour);
  painter.hLine(9, y + 21, 3, hair.shadow);
  painter.hLine(24, y + 20, 3, hair.deep);

  // Downcast, compact features keep the south-facing pose in the same
  // top-down language as the world instead of reading as a large frontal UI
  // portrait.  Their low-contrast planes survive at handheld scale without
  // becoming a pair of heavy black marks.
  painter.hLine(13, y + 13, 3, hair.shadow);
  painter.hLine(21, y + 13, 3, hair.shadow);
  if (blink) {
    painter.hLine(14, y + 15, 2, skin.contour);
    painter.hLine(21, y + 15, 2, skin.contour);
  } else {
    painter.rect(14, y + 14, 1, 2, CONTOUR.warm);
    painter.pixel(14, y + 14, hair.deep);
    painter.rect(22, y + 14, 1, 2, CONTOUR.warm);
    painter.pixel(22, y + 14, hair.deep);
  }
  painter.pixel(18, y + 16, skin.shadow);
  painter.pixel(19, y + 17, skin.shadow);
  painter.rect(12, y + 18, 2, 1, skin.blush, 0.72);
  painter.rect(23, y + 18, 2, 1, skin.blush, 0.64);
  painter.hLine(17, y + 20, 3, CONTOUR.warm);
  painter.pixel(18, y + 20, PALETTE.vermilionLight, 0.72);

  if (accessory === "hairpin") {
    painter.line(22, y + 7, 26, y + 5, PALETTE.amberLight);
    painter.hLine(24, y + 5, 3, PALETTE.vermilionLight);
    painter.pixel(26, y + 6, PALETTE.glow);
  } else if (accessory === "glasses") {
    painter.frame(12, y + 13, 6, 5, CONTOUR.deep);
    painter.frame(19, y + 13, 6, 5, CONTOUR.deep);
    painter.hLine(18, y + 15, 2, CONTOUR.deep);
    painter.pixel(13, y + 14, PALETTE.skyLight);
    painter.pixel(20, y + 14, PALETTE.skyLight);
  }
}

function paintBackHead(
  painter: PixelPainter,
  bob: number,
  hair: HairRamp,
  accessory: Accessory,
): void {
  const y = 1 + bob;
  polygon(
    painter,
    [
      [13, y],
      [21, y],
      [25, y + 2],
      [28, y + 6],
      [29, y + 14],
      [28, y + 22],
      [25, y + 26],
      [21, y + 28],
      [13, y + 28],
      [9, y + 26],
      [7, y + 22],
      [6, y + 14],
      [7, y + 7],
      [10, y + 3],
    ],
    hair.contour,
  );
  polygon(
    painter,
    [
      [13, y + 1],
      [21, y + 1],
      [25, y + 4],
      [27, y + 8],
      [28, y + 15],
      [26, y + 23],
      [22, y + 26],
      [13, y + 26],
      [9, y + 23],
      [8, y + 15],
      [9, y + 7],
    ],
    hair.deep,
  );
  polygon(
    painter,
    [
      [11, y + 5],
      [15, y + 2],
      [19, y + 2],
      [19, y + 25],
      [14, y + 24],
      [10, y + 20],
      [9, y + 11],
    ],
    hair.mid,
  );
  polygon(
    painter,
    [
      [20, y + 3],
      [24, y + 5],
      [26, y + 10],
      [26, y + 18],
      [23, y + 24],
      [20, y + 25],
    ],
    hair.shadow,
  );
  painter.vLine(19, y + 4, 20, hair.contour);
  painter.vLine(20, y + 5, 18, hair.shadow);
  painter.hLine(13, y + 2, 6, hair.shine);
  painter.hLine(11, y + 4, 4, hair.light);
  painter.hLine(9, y + 7, 3, hair.shine);
  painter.pixel(10, y + 11, hair.light);
  painter.pixel(12, y + 15, hair.light);
  painter.hLine(9, y + 23, 5, hair.deep);
  painter.hLine(21, y + 24, 4, hair.contour);
  painter.pixel(26, y + 20, hair.light);

  if (accessory === "hairpin") {
    painter.line(22, y + 8, 26, y + 6, PALETTE.amberLight);
    painter.hLine(24, y + 6, 3, PALETTE.vermilionLight);
    painter.pixel(26, y + 7, PALETTE.glow);
  } else if (accessory === "glasses") {
    painter.hLine(8, y + 15, 3, CONTOUR.deep);
    painter.hLine(25, y + 15, 3, CONTOUR.deep);
  }
}

function paintSideHead(
  painter: PixelPainter,
  bob: number,
  facingEast: boolean,
  skin: SkinRamp,
  hair: HairRamp,
  blink: boolean,
  accessory: Accessory,
): void {
  const y = 1 + bob;
  const points = (value: readonly Point[]): readonly Point[] =>
    mirrorPoints(value, facingEast);
  const x = (value: number, width = 1): number =>
    mirrorX(value, width, facingEast);

  polygon(
    painter,
    points([
      [11, y],
      [20, y],
      [25, y + 3],
      [28, y + 8],
      [28, y + 19],
      [25, y + 24],
      [21, y + 27],
      [12, y + 27],
      [8, y + 24],
      [7, y + 17],
      [8, y + 7],
    ]),
    hair.contour,
  );
  polygon(
    painter,
    points([
      [12, y + 1],
      [20, y + 1],
      [24, y + 4],
      [27, y + 9],
      [27, y + 18],
      [24, y + 23],
      [20, y + 25],
      [12, y + 25],
      [9, y + 22],
      [9, y + 8],
    ]),
    hair.deep,
  );
  polygon(
    painter,
    points([
      [11, y + 4],
      [16, y + 2],
      [22, y + 3],
      [25, y + 6],
      [26, y + 12],
      [24, y + 18],
      [20, y + 22],
      [14, y + 22],
      [10, y + 18],
      [9, y + 9],
    ]),
    hair.mid,
  );

  // Profile face with forehead, nose bridge, lips, and chin on separate planes.
  polygon(
    painter,
    points([
      [19, y + 7],
      [25, y + 8],
      [27, y + 11],
      [28, y + 14],
      [31, y + 16],
      [30, y + 18],
      [28, y + 19],
      [29, y + 21],
      [26, y + 24],
      [21, y + 24],
      [18, y + 20],
      [18, y + 12],
    ]),
    skin.contour,
  );
  polygon(
    painter,
    points([
      [20, y + 8],
      [24, y + 9],
      [26, y + 12],
      [27, y + 15],
      [30, y + 16],
      [28, y + 18],
      [27, y + 19],
      [28, y + 21],
      [25, y + 23],
      [21, y + 23],
      [19, y + 20],
      [19, y + 12],
    ]),
    skin.mid,
  );
  polygon(
    painter,
    points([
      [20, y + 9],
      [23, y + 9],
      [25, y + 12],
      [25, y + 18],
      [23, y + 21],
      [20, y + 20],
    ]),
    skin.light,
  );
  painter.pixel(x(27), y + 15, skin.light);
  painter.pixel(x(28), y + 18, skin.shadow);
  painter.pixel(x(27), y + 20, PALETTE.vermilionLight);

  polygon(
    painter,
    points([
      [9, y + 7],
      [13, y + 3],
      [19, y + 2],
      [24, y + 4],
      [27, y + 8],
      [26, y + 11],
      [23, y + 9],
      [22, y + 13],
      [19, y + 10],
      [17, y + 14],
      [14, y + 10],
      [11, y + 12],
    ]),
    hair.shadow,
  );
  // Lighting stays screen-space upper-left even when the anatomy mirrors.
  painter.hLine(facingEast ? x(13, 6) : 13, y + 2, 6, hair.shine);
  painter.hLine(facingEast ? x(11, 4) : 11, y + 4, 4, hair.light);
  painter.pixel(facingEast ? x(10) : 10, y + 7, hair.shine);
  painter.vLine(x(8), y + 12, 10, hair.deep);
  painter.hLine(x(9, 5), y + 22, 5, hair.contour);

  painter.hLine(x(23, 3), y + 13, 3, hair.shadow);
  if (blink) {
    painter.hLine(x(24, 2), y + 15, 2, skin.contour);
  } else {
    painter.rect(x(24), y + 14, 1, 2, CONTOUR.warm);
    painter.pixel(x(24), y + 14, hair.deep);
  }
  painter.rect(x(22, 2), y + 19, 2, 1, skin.blush, 0.68);

  if (accessory === "hairpin") {
    painter.line(x(11), y + 8, x(15), y + 6, PALETTE.amberLight);
    painter.hLine(x(12, 4), y + 7, 4, PALETTE.vermilionLight);
  } else if (accessory === "glasses") {
    painter.frame(x(22, 6), y + 13, 6, 5, CONTOUR.deep);
    painter.hLine(x(28, 2), y + 14, 2, CONTOUR.deep);
    painter.pixel(x(23), y + 14, PALETTE.skyLight);
  }
}

function paintFrontLegs(
  painter: PixelPainter,
  action: AvatarAction,
  frame: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
  bob: number,
): void {
  const y = 35 + bob;
  const phase = frame % 4;
  const leftFoot = action === "walk" ? [-2, 0, 2, 0][phase]! : -1;
  const rightFoot = action === "walk" ? [1, 0, -1, 0][phase]! : 1;
  const leftLift = action === "walk" && phase === 1 ? 1 : 0;
  const rightLift = action === "walk" && phase === 3 ? 1 : 0;

  polygon(
    painter,
    [
      [11, y],
      [17, y],
      [17 + leftFoot, y + 8 - leftLift],
      [14 + leftFoot, y + 10 - leftLift],
      [9 + leftFoot, y + 10 - leftLift],
      [10, y + 5],
    ],
    detail.contour,
  );
  polygon(
    painter,
    [
      [12, y + 1],
      [16, y + 1],
      [16 + leftFoot, y + 7 - leftLift],
      [13 + leftFoot, y + 8 - leftLift],
      [11 + leftFoot, y + 8 - leftLift],
      [11, y + 4],
    ],
    outfit.dark,
  );
  painter.hLine(9 + leftFoot, y + 8 - leftLift, 7, PALETTE.soilDeep, 2);
  painter.hLine(10 + leftFoot, y + 8 - leftLift, 3, PALETTE.hinoki);

  polygon(
    painter,
    [
      [19, y],
      [25, y],
      [26, y + 6],
      [27 + rightFoot, y + 9 - rightLift],
      [24 + rightFoot, y + 11 - rightLift],
      [18 + rightFoot, y + 10 - rightLift],
      [19, y + 5],
    ],
    detail.contour,
  );
  polygon(
    painter,
    [
      [20, y + 1],
      [24, y + 1],
      [25, y + 6],
      [25 + rightFoot, y + 8 - rightLift],
      [22 + rightFoot, y + 9 - rightLift],
      [20 + rightFoot, y + 8 - rightLift],
      [20, y + 4],
    ],
    outfit.dark,
  );
  painter.hLine(20 + rightFoot, y + 9 - rightLift, 8, PALETTE.soilDeep, 2);
  painter.hLine(21 + rightFoot, y + 9 - rightLift, 3, PALETTE.hinoki);
}

function paintSideLegs(
  painter: PixelPainter,
  action: AvatarAction,
  frame: number,
  facingEast: boolean,
  outfit: OutfitRamp,
  detail: OutfitDetail,
  bob: number,
): void {
  const y = 35 + bob;
  const phase = frame % 4;
  const frontStride = action === "walk" ? [3, 0, -2, 0][phase]! : 1;
  const rearStride = action === "walk" ? [-2, 0, 3, 0][phase]! : -1;
  const frontLift = action === "walk" && phase === 1 ? 1 : 0;
  const rearLift = action === "walk" && phase === 3 ? 1 : 0;
  const points = (value: readonly Point[]): readonly Point[] =>
    mirrorPoints(value, facingEast);

  polygon(
    painter,
    points([
      [13, y],
      [19, y],
      [19 + rearStride, y + 8 - rearLift],
      [17 + rearStride, y + 10 - rearLift],
      [11 + rearStride, y + 10 - rearLift],
      [12, y + 5],
    ]),
    detail.contour,
  );
  polygon(
    painter,
    points([
      [14, y + 1],
      [18, y + 1],
      [18 + rearStride, y + 7 - rearLift],
      [15 + rearStride, y + 8 - rearLift],
      [13 + rearStride, y + 8 - rearLift],
      [13, y + 4],
    ]),
    outfit.dark,
  );
  painter.hLine(
    mirrorX(11 + rearStride, 7, facingEast),
    y + 8 - rearLift,
    7,
    PALETTE.soilDeep,
    2,
  );

  polygon(
    painter,
    points([
      [18, y],
      [24, y],
      [24 + frontStride, y + 8 - frontLift],
      [27 + frontStride, y + 10 - frontLift],
      [20 + frontStride, y + 10 - frontLift],
      [19, y + 5],
    ]),
    detail.contour,
  );
  polygon(
    painter,
    points([
      [19, y + 1],
      [23, y + 1],
      [23 + frontStride, y + 7 - frontLift],
      [25 + frontStride, y + 8 - frontLift],
      [21 + frontStride, y + 8 - frontLift],
      [20, y + 4],
    ]),
    outfit.dark,
  );
  painter.hLine(
    mirrorX(20 + frontStride, 8, facingEast),
    y + 8 - frontLift,
    8,
    PALETTE.soilDeep,
    2,
  );
  painter.hLine(
    mirrorX(22 + frontStride, 3, facingEast),
    y + 8 - frontLift,
    3,
    PALETTE.hinoki,
  );
}

function paintFrontArms(
  painter: PixelPainter,
  direction: "north" | "south",
  action: AvatarAction,
  frame: number,
  bob: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
  skin: SkinRamp,
): void {
  const y = 23 + bob;
  const phase = frame % 4;
  const leftSwing =
    action === "walk" ? [-2, -1, 2, 1][phase]! : action === "idle" ? frame : 0;
  const rightSwing =
    action === "walk" ? [2, 1, -2, -1][phase]! : action === "idle" ? -frame : 0;

  polygon(
    painter,
    [
      [10, y],
      [14, y + 2],
      [12 + leftSwing, y + 13],
      [9 + leftSwing, y + 17],
      [5 + leftSwing, y + 15],
      [7, y + 4],
    ],
    detail.contour,
  );
  polygon(
    painter,
    [
      [10, y + 2],
      [13, y + 3],
      [11 + leftSwing, y + 12],
      [8 + leftSwing, y + 14],
      [7 + leftSwing, y + 13],
      [8, y + 5],
    ],
    outfit.mid,
  );
  painter.hLine(7 + leftSwing, y + 14, 4, skin.contour, 3);
  painter.hLine(8 + leftSwing, y + 14, 3, skin.light);

  polygon(
    painter,
    [
      [22, y + 2],
      [26, y],
      [29, y + 5],
      [30 + rightSwing, y + 15],
      [27 + rightSwing, y + 18],
      [23 + rightSwing, y + 15],
      [23, y + 6],
    ],
    detail.contour,
  );
  polygon(
    painter,
    [
      [23, y + 3],
      [26, y + 2],
      [28, y + 6],
      [29 + rightSwing, y + 14],
      [27 + rightSwing, y + 16],
      [25 + rightSwing, y + 14],
      [24, y + 6],
    ],
    outfit.dark,
  );
  painter.hLine(25 + rightSwing, y + 15, 4, skin.contour, 3);
  painter.hLine(26 + rightSwing, y + 15, 3, skin.mid);

  if (direction === "north") {
    painter.pixel(8 + leftSwing, y + 15, skin.shadow);
    painter.pixel(28 + rightSwing, y + 16, skin.shadow);
  }
}

function paintSideArms(
  painter: PixelPainter,
  action: AvatarAction,
  frame: number,
  facingEast: boolean,
  bob: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
  skin: SkinRamp,
): void {
  const y = 23 + bob;
  const phase = frame % 4;
  const swing =
    action === "walk" ? [-2, 0, 3, 1][phase]! : action === "idle" ? frame : 0;
  const points = (value: readonly Point[]): readonly Point[] =>
    mirrorPoints(value, facingEast);

  // Far arm.
  polygon(
    painter,
    points([
      [12, y + 3],
      [17, y + 3],
      [15 - swing, y + 14],
      [11 - swing, y + 17],
      [8 - swing, y + 15],
      [10, y + 7],
    ]),
    detail.contour,
  );
  polygon(
    painter,
    points([
      [13, y + 4],
      [16, y + 4],
      [14 - swing, y + 13],
      [11 - swing, y + 15],
      [10 - swing, y + 14],
      [11, y + 7],
    ]),
    outfit.dark,
  );
  painter.hLine(
    mirrorX(9 - swing, 4, facingEast),
    y + 14,
    4,
    skin.shadow,
    3,
  );

  // Near arm carries the strongest light and opposite swing.
  polygon(
    painter,
    points([
      [21, y + 2],
      [26, y + 4],
      [28 + swing, y + 13],
      [28 + swing, y + 17],
      [24 + swing, y + 19],
      [21 + swing, y + 16],
      [21, y + 8],
    ]),
    detail.contour,
  );
  polygon(
    painter,
    points([
      [22, y + 4],
      [25, y + 5],
      [26 + swing, y + 13],
      [26 + swing, y + 16],
      [24 + swing, y + 17],
      [23 + swing, y + 15],
      [22, y + 8],
    ]),
    outfit.mid,
  );
  painter.hLine(
    mirrorX(23 + swing, 4, facingEast),
    y + 16,
    4,
    skin.contour,
    3,
  );
  painter.hLine(
    mirrorX(24 + swing, 3, facingEast),
    y + 16,
    3,
    skin.light,
  );
}

function paintFrontTorso(
  painter: PixelPainter,
  direction: "north" | "south",
  bob: number,
  frame: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
): void {
  const y = 21 + bob;
  const hemShift = frame % 2;
  polygon(
    painter,
    [
      [12, y],
      [23, y],
      [27, y + 4],
      [28, y + 16],
      [25, y + 20 + hemShift],
      [18, y + 19],
      [11, y + 20 - hemShift],
      [8, y + 16],
      [9, y + 4],
    ],
    detail.contour,
  );
  polygon(
    painter,
    [
      [13, y + 1],
      [22, y + 1],
      [25, y + 4],
      [26, y + 15],
      [24, y + 18 + hemShift],
      [18, y + 17],
      [12, y + 18 - hemShift],
      [10, y + 15],
      [11, y + 4],
    ],
    outfit.mid,
  );
  polygon(
    painter,
    [
      [13, y + 2],
      [17, y + 1],
      [16, y + 16],
      [12, y + 17],
      [11, y + 14],
      [12, y + 5],
    ],
    outfit.light,
  );
  polygon(
    painter,
    [
      [22, y + 2],
      [25, y + 5],
      [25, y + 14],
      [23, y + 17],
      [19, y + 16],
      [19, y + 3],
    ],
    outfit.dark,
  );

  if (direction === "south") {
    polygon(
      painter,
      [
        [14, y],
        [18, y + 5],
        [16, y + 10],
        [12, y + 3],
      ],
      PALETTE.washiShadow,
    );
    polygon(
      painter,
      [
        [21, y],
        [18, y + 5],
        [20, y + 10],
        [24, y + 3],
      ],
      PALETTE.washi,
    );
    painter.vLine(18, y + 5, 13, detail.contour);
    painter.hLine(13, y + 11, 11, detail.deep, 2);
    painter.hLine(14, y + 11, 8, outfit.accent);
    painter.pixel(17, y + 13, PALETTE.amberLight);
    painter.pixel(19, y + 13, PALETTE.amber);
  } else {
    polygon(
      painter,
      [
        [13, y + 1],
        [18, y + 4],
        [23, y + 1],
        [22, y + 6],
        [14, y + 6],
      ],
      detail.deep,
    );
    painter.hLine(15, y + 2, 6, outfit.light);
    painter.vLine(18, y + 6, 11, detail.contour);
    painter.hLine(12, y + 12, 13, outfit.accent, 2);
    painter.hLine(14, y + 13, 9, detail.deep);
  }

  // Sparse woven flecks follow the planes instead of reading as noise.
  painter.hLine(12, y + 7, 3, detail.thread);
  painter.pixel(13, y + 9, detail.weave);
  painter.hLine(22, y + 7, 2, detail.weave);
  painter.pixel(24, y + 10, detail.thread);
  painter.hLine(11, y + 15, 3, detail.weave);
  painter.hLine(21, y + 16, 3, detail.thread);
  painter.pixel(15 + (frame % 2), y + 18, detail.weave);
}

function paintSideTorso(
  painter: PixelPainter,
  facingEast: boolean,
  bob: number,
  frame: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
): void {
  const y = 21 + bob;
  const points = (value: readonly Point[]): readonly Point[] =>
    mirrorPoints(value, facingEast);
  const x = (value: number, width = 1): number =>
    mirrorX(value, width, facingEast);
  polygon(
    painter,
    points([
      [13, y],
      [23, y],
      [27, y + 5],
      [27, y + 16],
      [24, y + 20],
      [14, y + 19],
      [10, y + 15],
      [11, y + 4],
    ]),
    detail.contour,
  );
  polygon(
    painter,
    points([
      [14, y + 1],
      [22, y + 1],
      [25, y + 5],
      [25, y + 15],
      [23, y + 18],
      [15, y + 17],
      [12, y + 14],
      [13, y + 4],
    ]),
    outfit.mid,
  );
  polygon(
    painter,
    [
      [14, y + 2],
      [18, y + 1],
      [17, y + 16],
      [14, y + 15],
      [13, y + 6],
    ],
    outfit.light,
  );
  polygon(
    painter,
    [
      [20, y + 2],
      [24, y + 5],
      [24, y + 15],
      [22, y + 17],
      [19, y + 16],
    ],
    outfit.dark,
  );
  polygon(
    painter,
    points([
      [16, y],
      [22, y + 1],
      [20, y + 7],
      [17, y + 9],
      [14, y + 3],
    ]),
    PALETTE.washi,
  );
  painter.line(x(18), y + 6, x(20), y + 16, detail.contour);
  painter.hLine(x(13, 12), y + 11, 12, outfit.accent, 2);
  painter.hLine(x(15, 9), y + 12, 9, detail.deep);
  painter.hLine(x(14, 3), y + 6, 3, detail.thread);
  painter.pixel(x(23), y + 8, detail.weave);
  painter.hLine(x(15 + (frame % 2), 3), y + 16, 3, detail.weave);
}

function paintCarryParcel(
  painter: PixelPainter,
  direction: CardinalDirection,
  frame: number,
  skin: SkinRamp,
): void {
  const sway = frame === 0 ? -1 : 1;
  if (direction === "east" || direction === "west") {
    const facingEast = direction === "east";
    const x = (value: number, width = 1): number =>
      mirrorX(value, width, facingEast);
    painter.rect(x(20 + sway, 10), 29, 10, 10, CONTOUR.warm);
    painter.rect(x(21 + sway, 8), 30, 8, 8, PALETTE.hinoki);
    painter.hLine(x(21 + sway, 8), 30, 8, PALETTE.hinokiLight, 2);
    painter.vLine(x(24 + sway), 30, 8, PALETTE.amberDeep);
    painter.hLine(x(21 + sway, 8), 34, 8, PALETTE.amberDeep);
    painter.rect(x(19 + sway, 3), 31, 3, 3, skin.contour);
    painter.pixel(x(20 + sway), 32, skin.light);
    painter.rect(x(27 + sway, 3), 34, 3, 3, skin.contour);
    painter.pixel(x(28 + sway), 34, skin.mid);
    return;
  }

  painter.rect(11 + sway, 28, 15, 12, CONTOUR.warm);
  painter.rect(12 + sway, 29, 13, 10, PALETTE.hinoki);
  painter.hLine(12 + sway, 29, 13, PALETTE.hinokiLight, 2);
  painter.vLine(18 + sway, 29, 10, PALETTE.amberDeep);
  painter.hLine(12 + sway, 34, 13, PALETTE.amberDeep);
  painter.rect(9 + sway, 30, 4, 4, skin.contour);
  painter.rect(10 + sway, 30, 3, 3, skin.light);
  painter.rect(24 + sway, 33, 4, 4, skin.contour);
  painter.rect(24 + sway, 33, 3, 3, skin.mid);
}

function paintStandingBody(
  painter: PixelPainter,
  direction: CardinalDirection,
  action: Exclude<AvatarAction, "study">,
  frame: number,
  bob: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
  skin: SkinRamp,
): void {
  if (direction === "east" || direction === "west") {
    const facingEast = direction === "east";
    paintSideLegs(painter, action, frame, facingEast, outfit, detail, bob);
    paintSideArms(
      painter,
      action,
      frame,
      facingEast,
      bob,
      outfit,
      detail,
      skin,
    );
    paintSideTorso(painter, facingEast, bob, frame, outfit, detail);
  } else {
    paintFrontLegs(painter, action, frame, outfit, detail, bob);
    paintFrontArms(
      painter,
      direction,
      action,
      frame,
      bob,
      outfit,
      detail,
      skin,
    );
    paintFrontTorso(painter, direction, bob, frame, outfit, detail);
  }

  if (action === "carry") {
    paintCarryParcel(painter, direction, frame, skin);
  }
}

function paintStudyBody(
  painter: PixelPainter,
  direction: CardinalDirection,
  frame: number,
  outfit: OutfitRamp,
  detail: OutfitDetail,
  skin: SkinRamp,
): void {
  const side = direction === "east" || direction === "west";
  const facingEast = direction === "east";
  const points = (value: readonly Point[]): readonly Point[] =>
    side ? mirrorPoints(value, facingEast) : value;
  const x = (value: number, width = 1): number =>
    side ? mirrorX(value, width, facingEast) : value;
  const pageLift = frame === 0 ? -1 : frame === 2 ? 1 : 0;

  // A broad, low cross-legged silhouette communicates a seated study pose.
  polygon(
    painter,
    points([
      [11, 24],
      [24, 24],
      [28, 29],
      [27, 37],
      [32, 41],
      [31, 45],
      [22, 45],
      [18, 42],
      [14, 45],
      [5, 45],
      [4, 41],
      [9, 37],
      [8, 29],
    ]),
    detail.contour,
  );
  polygon(
    painter,
    points([
      [12, 25],
      [23, 25],
      [26, 29],
      [25, 37],
      [29, 41],
      [29, 43],
      [22, 43],
      [18, 40],
      [14, 43],
      [7, 43],
      [7, 41],
      [11, 37],
      [10, 29],
    ]),
    outfit.mid,
  );
  polygon(
    painter,
    points([
      [12, 26],
      [17, 25],
      [16, 39],
      [13, 41],
      [9, 41],
      [12, 36],
    ]),
    outfit.light,
  );
  polygon(
    painter,
    points([
      [20, 25],
      [23, 26],
      [25, 30],
      [24, 37],
      [28, 41],
      [23, 41],
      [19, 38],
    ]),
    outfit.dark,
  );
  painter.hLine(x(6, 10), 43, 10, PALETTE.soilDeep, 2);
  painter.hLine(x(22, 9), 43, 9, PALETTE.soilDeep, 2);
  painter.hLine(x(7, 4), 43, 4, PALETTE.hinoki);
  painter.hLine(x(25, 4), 43, 4, PALETTE.hinoki);

  if (side) {
    polygon(
      painter,
      points([
        [15, 24],
        [22, 25],
        [24, 31],
        [20, 36],
        [14, 33],
        [11, 28],
      ]),
      detail.deep,
    );
    polygon(
      painter,
      points([
        [16, 25],
        [21, 26],
        [22, 30],
        [19, 34],
        [15, 32],
        [13, 28],
      ]),
      outfit.mid,
    );
    polygon(
      painter,
      points([
        [18, 30],
        [27, 28 + pageLift],
        [31, 33 + pageLift],
        [22, 36],
      ]),
      PALETTE.washiShadow,
    );
    polygon(
      painter,
      points([
        [18, 30],
        [22, 36],
        [14, 37],
        [10, 33 - pageLift],
      ]),
      PALETTE.washi,
    );
    painter.line(x(18), 30, x(22), 36, PALETTE.indigoDeep);
    painter.hLine(x(22, 6), 32 + pageLift, 6, PALETTE.indigoLight);
    painter.hLine(x(12, 5), 34 - pageLift, 5, PALETTE.hinokiDark);
    painter.rect(x(13 + frame, 3), 30 + frame, 3, 3, skin.contour);
    painter.pixel(x(14 + frame), 30 + frame, skin.light);
    painter.rect(x(24 - frame, 3), 33 - frame, 3, 3, skin.contour);
    painter.pixel(x(25 - frame), 33 - frame, skin.mid);
  } else {
    polygon(
      painter,
      [
        [11, 24],
        [18, 27],
        [24, 24],
        [26, 29],
        [23, 35],
        [12, 35],
        [9, 29],
      ],
      detail.deep,
    );
    polygon(
      painter,
      [
        [12, 25],
        [18, 28],
        [23, 25],
        [24, 29],
        [22, 33],
        [13, 33],
        [11, 29],
      ],
      outfit.mid,
    );
    painter.hLine(13, 27, 4, detail.thread);
    painter.hLine(20, 27, 3, detail.weave);

    if (direction === "north") {
      polygon(
        painter,
        [
          [7, 29 + pageLift],
          [17, 31],
          [17, 39],
          [5, 35],
        ],
        PALETTE.washiShadow,
      );
      polygon(
        painter,
        [
          [18, 31],
          [29, 29 - pageLift],
          [31, 35],
          [18, 39],
        ],
        PALETTE.washi,
      );
    } else {
      polygon(
        painter,
        [
          [7, 30 + pageLift],
          [17, 32],
          [17, 40],
          [5, 36],
        ],
        PALETTE.washi,
      );
      polygon(
        painter,
        [
          [18, 32],
          [29, 30 - pageLift],
          [31, 36],
          [18, 40],
        ],
        PALETTE.washiShadow,
      );
    }
    painter.vLine(17, 31, 9, PALETTE.indigoDeep);
    painter.hLine(8, 33 + pageLift, 6, PALETTE.indigoLight);
    painter.hLine(22, 33 - pageLift, 6, PALETTE.hinokiDark);
    painter.rect(10 + frame, 31 + frame, 4, 3, skin.contour);
    painter.hLine(11 + frame, 31 + frame, 3, skin.light);
    painter.rect(23 - frame, 34 - frame, 4, 3, skin.contour);
    painter.hLine(23 - frame, 34 - frame, 3, skin.mid);
  }
}

/**
 * A restrained screen-space key light ties all facings to the top-left sun
 * already present in the room and garden plates.  These are deliberately
 * sparse one-pixel clusters: surface variation, not a second outline.
 */
function paintWorldLightFinish(
  painter: PixelPainter,
  direction: CardinalDirection,
  action: AvatarAction,
  bob: number,
  outfit: OutfitRamp,
  hair: HairRamp,
): void {
  const headY = 1 + bob;
  const torsoY = action === "study" ? 26 : 23 + bob;

  // Upper-left hair catches the same warm window/canopy light in every facing.
  painter.hLine(10, headY + 7, 3, hair.shine, 1);
  painter.pixel(9, headY + 10, hair.light, 0.72);
  painter.pixel(11, headY + 5, PALETTE.amberLight, 0.44);

  if (action !== "study") {
    // A broken shoulder ridge and tiny sleeve glint model cloth without adding
    // noisy checkerboard texture or changing the established silhouette.
    painter.hLine(11, torsoY + 4, 3, outfit.light, 1);
    painter.pixel(10, torsoY + 8, outfit.light, 0.72);
    painter.pixel(12, torsoY + 13, PALETTE.skyLight, 0.38);
    if (direction === "south" || direction === "north") {
      painter.pixel(15, torsoY + 17, PALETTE.amberLight, 0.34);
    }
  } else {
    painter.hLine(10, 30, 3, outfit.light, 1);
    painter.pixel(9, 35, PALETTE.skyLight, 0.4);
  }
}

/**
 * Creates one native 36x48 avatar cel with a stable bottom-center floor
 * contact. The four actions expose exactly 2/4/3/2 frames respectively.
 */
export function createHiResAvatarSprite(
  directionInput: AvatarDirection,
  action: AvatarAction = "idle",
  frameInput = 0,
  appearance: AvatarAppearance = {},
): PixelArt {
  const direction = normalizeAvatarDirection(directionInput);
  const frameCount = HIRES_AVATAR_FRAME_COUNTS[action];
  const frame = ((frameInput % frameCount) + frameCount) % frameCount;
  const outfitName = appearance.outfit ?? "indigo";
  const skinName = appearance.skin ?? "warm";
  const hairName = appearance.hair ?? "chestnut";
  const accessory = appearance.accessory ?? "hairpin";
  const outfit = OUTFIT_PALETTES[outfitName];
  const detail = OUTFIT_DETAIL[outfitName];
  const skin = SKIN[skinName];
  const hair = HAIR[hairName];
  const bob =
    action === "walk" && (frame === 1 || frame === 3)
      ? -1
      : action === "study"
        ? frame === 2
          ? 5
          : 4
          : 0;
  const blink =
    (action === "idle" && frame === 1) ||
    (action === "study" && frame === 2);

  return makePixelArt(
    HIRES_AVATAR_WIDTH,
    HIRES_AVATAR_HEIGHT,
    (painter) => {
      if (action === "study") {
        paintStudyBody(painter, direction, frame, outfit, detail, skin);
      } else {
        paintStandingBody(
          painter,
          direction,
          action,
          frame,
          bob,
          outfit,
          detail,
          skin,
        );
      }

      if (direction === "south") {
        paintFrontHead(
          painter,
          bob,
          skin,
          hair,
          blink,
          accessory,
        );
      } else if (direction === "north") {
        paintBackHead(painter, bob, hair, accessory);
      } else {
        paintSideHead(
          painter,
          bob,
          direction === "east",
          skin,
          hair,
          blink,
          accessory,
        );
      }
      paintWorldLightFinish(painter, direction, action, bob, outfit, hair);
    },
    {
      id: `avatar:${outfitName}:${direction}:${action}:${frame}`,
      anchor: HIRES_AVATAR_ANCHOR,
      renderBand: "character",
      tags: [
        direction,
        action,
        `frame-${frame}`,
        outfitName,
        "native-36x48",
        "runtime-avatar",
        "warm-contour",
        "woven-hanten",
      ],
    },
  );
}
