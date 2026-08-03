import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifestPath = new URL("../art/pipeline/manifests/vertical-slice-01.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const fail = (message) => {
  throw new Error(`Art pipeline validation failed: ${message}`);
};

if (manifest.schemaVersion !== 1) fail("unexpected schema version");
if (manifest.runtime?.engine !== "phaser-3.90.0") fail("engine contract drifted");
if (JSON.stringify(manifest.runtime?.canvas) !== "[480,270]") fail("canvas contract drifted");
if (JSON.stringify(manifest.runtime?.worldTile) !== "[16,16]") fail("world tile contract drifted");
if (JSON.stringify(manifest.runtime?.placementGrid) !== "[8,8]") fail("placement grid contract drifted");

const ids = new Set();
for (const asset of manifest.assets ?? []) {
  if (ids.has(asset.id)) fail(`duplicate asset id ${asset.id}`);
  ids.add(asset.id);
}
if (ids.size < 12) fail("vertical slice asset set is incomplete");

for (const reference of manifest.references ?? []) {
  const bytes = await readFile(new URL(`../${reference.path}`, import.meta.url));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== reference.sha256) fail(`reference hash mismatch for ${reference.id}`);
}

console.log(`Art pipeline OK: ${manifest.sliceId}, ${ids.size} planned assets, ${manifest.references.length} verified references.`);
