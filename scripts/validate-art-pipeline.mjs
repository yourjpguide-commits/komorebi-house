import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../", import.meta.url);
const manifestPath = new URL("art/pipeline/manifests/vertical-slice-01.json", repoRoot);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const fail = (message) => {
  throw new Error(`Art pipeline validation failed: ${message}`);
};

const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const hasPngSignature = (bytes) => bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
const hashFile = async (path) =>
  createHash("sha256").update(await readFile(new URL(path, repoRoot))).digest("hex");

if (manifest.schemaVersion !== 2) fail("unexpected schema version");
if (manifest.runtime?.engine !== "phaser-3.90.0") fail("engine contract drifted");
if (!same(manifest.runtime?.simulationCanvas, [480, 270])) fail("simulation canvas contract drifted");
if (!same(manifest.runtime?.renderCanvas, [960, 540])) fail("render canvas contract drifted");
if (!same(manifest.runtime?.worldTile, [16, 16])) fail("world tile contract drifted");
if (!same(manifest.runtime?.placementGrid, [8, 8])) fail("placement grid drifted");

const room = manifest.geometryLock?.room;
if (!same(room?.bounds, [0, 0, 480, 270])) fail("room bounds drifted");
if (!same(room?.placementArea, [58, 104, 364, 124])) fail("room placement area drifted");
if (!same(room?.spawns, [[240, 172], [240, 224], [104, 214]])) fail("room spawns drifted");
if (!same(room?.portals, [[206, 232, 70, 38], [66, 224, 58, 46]])) fail("room portals drifted");
if (!same(room?.interactions, [[136, 112], [300, 102], [118, 82], [380, 108]])) fail("room interactions drifted");

for (const file of manifest.geometryLock?.files ?? []) {
  if (await hashFile(file.path) !== file.sha256) fail(`protected geometry file drifted: ${file.path}`);
}
for (const reference of manifest.references ?? []) {
  if (await hashFile(reference.path) !== reference.sha256) fail(`reference hash mismatch: ${reference.id}`);
}

const expectedAssets = new Map([
  ["room-base", { runtimeKey: "koh:world:room", nativeCanvas: [960, 540], runtimeOrigin: [0, 0] }],
  ["round-chabudai", { runtimeKey: "koh:decor:round-chabudai", nativeCanvas: [58, 34], runtimeOrigin: [0.5, 1], footprint: [32, 24], starterPlacement: [294, 190, 0] }],
  ["patchwork-zabuton", { runtimeKey: "koh:decor:patchwork-zabuton", nativeCanvas: [32, 17], runtimeOrigin: [0.5, 1], footprint: [16, 12], starterPlacement: [294, 210, 0] }],
  ["folded-futon", { runtimeKey: "koh:decor:folded-futon", nativeCanvas: [62, 35], runtimeOrigin: [0.5, 1], footprint: [32, 12], starterPlacement: [194, 212, 0] }],
  ["seigaiha-notebook", { runtimeKey: "koh:decor:seigaiha-notebook", nativeCanvas: [20, 13], runtimeOrigin: [0.5, 1], footprint: [16, 12], starterPlacement: [282, 178, 0] }],
  ["milk-glass-desk-lamp", { runtimeKey: "koh:decor:milk-glass-desk-lamp", nativeCanvas: [20, 28], runtimeOrigin: [0.5, 1], footprint: [16, 12], starterPlacement: [306, 178, 0] }],
]);
const ids = new Set();
const keys = new Set();
for (const asset of manifest.assets ?? []) {
  if (ids.has(asset.id)) fail(`duplicate asset id: ${asset.id}`);
  if (keys.has(asset.runtimeKey)) fail(`duplicate runtime key: ${asset.runtimeKey}`);
  if (!asset.currentProducer || !asset.sameChangeDeletionTargets?.length) {
    fail(`incomplete producer/deletion row: ${asset.id}`);
  }
  if (asset.currentFallbacks?.some((entry) => !entry.file || !entry.symbol || !entry.scope)) {
    fail(`fallback without consumer scope: ${asset.id}`);
  }
  const contract = expectedAssets.get(asset.id);
  if (!contract) fail(`unexpected asset: ${asset.id}`);
  for (const [field, expected] of Object.entries(contract)) {
    if (!same(asset[field], expected)) fail(`asset contract drifted: ${asset.id}.${field}`);
  }
  ids.add(asset.id);
  keys.add(asset.runtimeKey);
}
if (!same([...ids].sort(), [...expectedAssets.keys()].sort())) fail("first proof must contain exactly room-base plus five starter assets");

for (const asset of manifest.assets) {
  if (typeof asset.replacementTarget !== "string") fail(`asset must replace a PNG in place: ${asset.id}`);
  const bytes = await readFile(new URL(asset.replacementTarget, repoRoot));
  if (!hasPngSignature(bytes)) fail(`${asset.id} is not a PNG`);
  const dimensions = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (!same(dimensions, asset.nativeCanvas)) fail(`${asset.id} must remain exactly ${asset.nativeCanvas.join("x")}`);
  if (asset.sha256 && await hashFile(asset.replacementTarget) !== asset.sha256) {
    fail(`${asset.id} runtime PNG hash does not match its approval receipt`);
  }
}

const rotatableFurnitureIds = new Set(["patchwork-zabuton", "seigaiha-notebook"]);
for (const asset of manifest.assets) {
  const derivedRotationCels = asset.derivedRotationCels ?? [];
  if (derivedRotationCels.length > 0 && !rotatableFurnitureIds.has(asset.id)) {
    fail(`derived rotation cels are not allowed for ${asset.id}`);
  }
  if (rotatableFurnitureIds.has(asset.id)
    && !same(derivedRotationCels.map((cel) => cel.rotation).sort((a, b) => a - b), [90, 180, 270])) {
    fail(`${asset.id} must declare 90, 180, and 270 degree derived cels`);
  }
  const derivedKeys = new Set();
  for (const cel of derivedRotationCels) {
    if (![90, 180, 270].includes(cel.rotation)) fail(`illegal derived rotation: ${asset.id}:${cel.rotation}`);
    if (cel.runtimeKey !== `${asset.runtimeKey}:r${cel.rotation}`) {
      fail(`derived runtime key drifted: ${asset.id}:${cel.rotation}`);
    }
    if (derivedKeys.has(cel.runtimeKey)) fail(`duplicate derived runtime key: ${cel.runtimeKey}`);
    derivedKeys.add(cel.runtimeKey);
    const expectedDimensions = cel.rotation === 180
      ? asset.nativeCanvas
      : [asset.nativeCanvas[1], asset.nativeCanvas[0]];
    if (!same(cel.nativeCanvas, expectedDimensions)) {
      fail(`derived dimensions drifted: ${asset.id}:${cel.rotation}`);
    }
    if (typeof cel.replacementTarget !== "string") {
      fail(`derived cel must replace a PNG in place: ${asset.id}:${cel.rotation}`);
    }
    const bytes = await readFile(new URL(cel.replacementTarget, repoRoot));
    if (!hasPngSignature(bytes)) fail(`derived cel is not a PNG: ${cel.replacementTarget}`);
    const dimensions = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    if (!same(dimensions, cel.nativeCanvas)) {
      fail(`derived cel PNG dimensions drifted: ${cel.replacementTarget}`);
    }
  }
}

const cutover = manifest.cutover ?? {};
for (const field of ["newRuntimeFiles", "newRenderers", "newFeatureFlags", "newAtlases", "newMapSchemas", "newMigrationLayers", "newDuplicateAssetPaths", "maxNetRuntimeSourceLines"]) {
  if (cutover[field] !== 0) fail(`subtraction gate violated: ${field}`);
}
if (cutover.externalFurnitureLoader === "absent-blocked") {
  if (cutover.strictRequiredAssetFailure !== "not-implemented-blocked") fail("loader and strict-failure states disagree");
  if (cutover.imageGenerationAuthorized !== false) fail("ImageGen cannot be authorized before strict cutover exists");
  for (const asset of manifest.assets.filter((candidate) => candidate.kind === "furniture")) {
    if (asset.replacementTarget !== null) fail(`blocked furniture must not claim a runtime target: ${asset.id}`);
  }
}
const strictCutoverReady = cutover.externalFurnitureLoader === "strict-ready"
  && cutover.strictRequiredAssetFailure === "implemented";
if (cutover.imageGenerationAuthorized !== strictCutoverReady) fail("ImageGen authorization and strict cutover readiness disagree");
if (!strictCutoverReady) fail("strict-ready external furniture cutover is required");

if (manifest.acceptance?.visualScoreMinimum !== 85) fail("visual score threshold drifted");
if (manifest.acceptance?.visualCategoryMinimum !== 8) fail("visual category threshold drifted");
if (!same(manifest.acceptance?.desktopCapture, [1280, 720, 1])) fail("desktop capture contract drifted");
if (!same(manifest.acceptance?.mobileCapture, [390, 844, 2])) fail("mobile capture contract drifted");

console.log(`Art pipeline OK: 480x270 simulation, 960x540 render, six exact PNGs locked, ${ids.size} single-authority rows, strict furniture cutover ready.`);
