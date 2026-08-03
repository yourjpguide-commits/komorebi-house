import {
  AVATAR_FRAME_COUNTS,
  PROCEDURAL_FURNITURE_IDS,
  createAvatarSprite,
  createEnvironment,
  createFurnitureSprite,
  drawPixelArt,
  type AvatarAction,
  type CardinalDirection,
  type LocationId,
  type PixelArt,
} from "./index";

const atlas = document.querySelector<HTMLElement>("#atlas");
if (!atlas) throw new Error("Art atlas mount is missing");

const heading = (text: string): HTMLHeadingElement => {
  const element = document.createElement("h2");
  element.textContent = text;
  return element;
};

const canvasFor = (art: PixelArt): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = art.width;
  canvas.height = art.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.imageSmoothingEnabled = false;
  drawPixelArt(context, art);
  return canvas;
};

const label = (text: string): HTMLDivElement => {
  const element = document.createElement("div");
  element.className = "label";
  element.textContent = text;
  return element;
};

atlas.append(heading("Environment plates · 480 × 270"));
const environmentGrid = document.createElement("section");
environmentGrid.className = "environments";
for (const location of ["room", "garden", "cafe", "park"] satisfies readonly LocationId[]) {
  const card = document.createElement("article");
  card.className = "environment";
  card.append(canvasFor(createEnvironment(location, { seed: "atlas", furnished: true })));
  card.append(label(location));
  environmentGrid.append(card);
}
atlas.append(environmentGrid);

atlas.append(heading("Avatar cels · 36 × 48"));
const avatarGrid = document.createElement("section");
avatarGrid.className = "avatars";
const actions = ["idle", "walk", "study", "carry"] satisfies readonly AvatarAction[];
for (const direction of ["north", "east", "south", "west"] satisfies readonly CardinalDirection[]) {
  for (const action of actions) {
    for (let frame = 0; frame < AVATAR_FRAME_COUNTS[action]; frame += 1) {
      const card = document.createElement("article");
      card.className = "avatar";
      card.append(canvasFor(createAvatarSprite(direction, action, frame)));
      card.append(label(`${direction} · ${action} · ${frame}`));
      avatarGrid.append(card);
    }
  }
}
atlas.append(avatarGrid);

atlas.append(heading("Procedural furniture · 55 generated sprites"));
const spriteGrid = document.createElement("section");
spriteGrid.className = "sprites";
for (const itemId of PROCEDURAL_FURNITURE_IDS) {
  const card = document.createElement("article");
  card.className = "sprite";
  const art = createFurnitureSprite(itemId, { seed: "atlas" });
  const canvas = canvasFor(art);
  const displayScale = art.width > 80 || art.height > 76 ? 1 : 2;
  canvas.style.width = `${art.width * displayScale}px`;
  canvas.style.height = `${art.height * displayScale}px`;
  card.append(canvas);
  card.append(label(itemId));
  spriteGrid.append(card);
}
atlas.append(spriteGrid);
