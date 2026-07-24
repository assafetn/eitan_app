// PWA icon generator.
//
// Builds an SVG wordmark (solid brand square + the Hebrew letter "א") and
// rasterizes it to PNG with sharp.
//
// The glyph is NOT rendered as SVG <text>: that would depend on whatever fonts
// happen to be installed on the build machine (DM Sans has no Hebrew coverage at
// all, and a fontconfig miss silently substitutes a system face). Instead the
// aleph is extracted from Rubik 500 with opentype.js and embedded as raw SVG
// path data, so the output is identical on every machine and needs no fonts at
// render time.
//
// Regenerate with:  npm run icons
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/icons");

// --jmh-blue = oklch(0.54 0.14 240), resolved to sRGB. Same value already used by
// the viewport themeColor and app/manifest.ts — not a new colour.
const BRAND = "#0076b7";
const GLYPH_FILL = "#ffffff";
const ALEPH = "א"; // א

// @fontsource ships woff/woff2 only (no ttf). opentype.js parses this woff
// directly, so we read the real Rubik outline rather than substituting a face.
const FONT_PATH = resolve(ROOT, "node_modules/@fontsource/rubik/files/rubik-hebrew-500-normal.woff");

// Corner radius as a fraction of canvas, for the rounded "any"-purpose icons.
const CORNER_RATIO = 0.22;
// The aleph reads as optically low when centred mathematically; lift it by this
// fraction of canvas height.
const OPTICAL_LIFT = 0.03;

function loadAleph() {
  const buf = readFileSync(FONT_PATH);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const glyph = font.charToGlyph(ALEPH);
  // .notdef (index 0) or an empty outline means the subset lacks the codepoint —
  // fail loudly rather than shipping a blank square.
  if (!glyph || glyph.index === 0) {
    throw new Error(`Rubik subset does not contain U+05D0 (got glyph index ${glyph?.index}).`);
  }
  const path = glyph.getPath(0, 0, 1000);
  const d = path.toPathData(3);
  if (!d) throw new Error("U+05D0 resolved to an empty outline.");
  return { d, box: path.getBoundingBox() };
}

const { d: ALEPH_PATH, box: ALEPH_BOX } = loadAleph();

/**
 * @param size        canvas edge in px
 * @param glyphRatio  glyph's largest dimension as a fraction of the canvas
 * @param rounded     rounded-square background (transparent corners) vs full bleed
 */
function buildSvg({ size, glyphRatio, rounded }) {
  const w = ALEPH_BOX.x2 - ALEPH_BOX.x1;
  const h = ALEPH_BOX.y2 - ALEPH_BOX.y1;
  // Scale on the LARGER dimension so the glyph always fits inside the target box.
  const scale = (size * glyphRatio) / Math.max(w, h);
  const cx = size / 2;
  const cy = size / 2 - size * OPTICAL_LIFT;
  const tx = cx - ((ALEPH_BOX.x1 + ALEPH_BOX.x2) / 2) * scale;
  const ty = cy - ((ALEPH_BOX.y1 + ALEPH_BOX.y2) / 2) * scale;
  const r = rounded ? Math.round(size * CORNER_RATIO) : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BRAND}"/>` +
    `<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(6)})">` +
    `<path d="${ALEPH_PATH}" fill="${GLYPH_FILL}"/>` +
    `</g></svg>`;
}

const TARGETS = [
  // "any" purpose: rounded square, transparent corners.
  { file: "icon-192.png", size: 192, glyphRatio: 0.62, rounded: true, flatten: false },
  { file: "icon-512.png", size: 512, glyphRatio: 0.62, rounded: true, flatten: false },
  // Maskable: full bleed, glyph at ~60% so Android's circular crop can't clip it
  // (the maskable safe zone is a circle of 80% of the canvas).
  { file: "icon-512-maskable.png", size: 512, glyphRatio: 0.6, rounded: false, flatten: true },
  // iOS applies its own mask: no rounding of our own, and NO alpha — transparent
  // pixels render black on the home screen.
  { file: "apple-touch-icon.png", size: 180, glyphRatio: 0.62, rounded: false, flatten: true },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const t of TARGETS) {
  const svg = buildSvg(t);
  let pipeline = sharp(Buffer.from(svg));
  if (t.flatten) pipeline = pipeline.flatten({ background: BRAND }); // drops the alpha channel
  const out = resolve(OUT_DIR, t.file);
  const buf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(out, buf);

  const meta = await sharp(buf).metadata();
  console.log(
    `${t.file.padEnd(24)} ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}  ${buf.length} bytes`
  );
}

console.log(`\nWrote ${TARGETS.length} icons to public/icons/`);
