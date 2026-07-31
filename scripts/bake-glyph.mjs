// Bakes the Hebrew א outline into the absolute 1024-space path data that
// assets/icon.svg carries inline.
//
// Run this ONLY when the glyph itself needs to change — the normal icon
// pipeline (npm run icons) never touches a font. The point of baking is that
// assets/icon.svg is self-contained: no <text>, no font lookup at render time,
// so it rasterises identically on every machine.
//
// The outline comes from Rubik 500 Hebrew (@fontsource/rubik, devDependency).
// @fontsource ships woff only, which opentype.js parses directly — this reads
// the real outline rather than letting fontconfig substitute some other face.
//
//   node scripts/bake-glyph.mjs   -> prints the path data to paste into icon.svg
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FONT = resolve(ROOT, "node_modules/@fontsource/rubik/files/rubik-hebrew-500-normal.woff");

const CANVAS = 1024;
// Largest glyph dimension as a fraction of the canvas. 53% matches the optical
// size of the surrounding iOS system icons — bigger reads as shouting.
const EXTENT = 546;

const buf = readFileSync(FONT);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const glyph = font.charToGlyph("א");
if (!glyph || glyph.index === 0) {
  throw new Error("Rubik subset does not contain U+05D0 — refusing to bake a blank path.");
}

// Measure at a nominal size, derive the scale that hits EXTENT, then re-emit the
// path already translated so its bounding box is centred on the canvas.
const raw = glyph.getPath(0, 0, 1000).getBoundingBox();
const size = (1000 * EXTENT) / Math.max(raw.x2 - raw.x1, raw.y2 - raw.y1);
const k = size / 1000;
const dx = CANVAS / 2 - ((raw.x1 + raw.x2) / 2) * k;
const dy = CANVAS / 2 - ((raw.y1 + raw.y2) / 2) * k;

const path = glyph.getPath(dx, dy, size);
const b = path.getBoundingBox();
const f = (n) => n.toFixed(2);

console.log(`bbox    x ${f(b.x1)}–${f(b.x2)}   y ${f(b.y1)}–${f(b.y2)}`);
console.log(`size    ${f(b.x2 - b.x1)} x ${f(b.y2 - b.y1)}   (${f(((b.y2 - b.y1) / CANVAS) * 100)}% of canvas)`);
console.log(`centre  (${f((b.x1 + b.x2) / 2)}, ${f((b.y1 + b.y2) / 2)})  — canvas centre is (512, 512)`);
console.log(`\nglyphGrad y1="${f(b.y1)}" y2="${f(b.y2)}"\n`);
console.log(path.toPathData(2));
