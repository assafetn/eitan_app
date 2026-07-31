// App icon generator.
//
// Rasterizes the single master `assets/icon.svg` to every PNG the app ships.
// The master is stroked geometry, so this needs no fonts at render time and
// produces byte-identical output on any machine.
//
// The one that actually matters on iPhone is public/apple-touch-icon.png:
// iOS web clips read <link rel="apple-touch-icon">, NOT the web manifest.
// Everything else here serves Android/desktop.
//
// Dev-only. sharp is a devDependency and this is NEVER wired into `next build`
// — Vercel serves the committed PNGs and never installs sharp.
//
// Regenerate with:  npm run icons
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = resolve(ROOT, "assets/icon.svg");
const OUT_DIR = resolve(ROOT, "public");

// Bottom stop of the tile gradient. Used as the flatten backdrop so no alpha
// channel survives into any output — transparent pixels render black on the
// iOS home screen, and Android's maskable crop would expose them too.
const TILE_BOTTOM = "#161618";

const master = readFileSync(MASTER, "utf8");

// The master draws the glyph at 53% of the canvas. Android's maskable safe zone
// is a circle covering 80% of the canvas, so the glyph is shrunk to 40% for that
// variant — same artwork, just enough headroom to survive any launcher's crop.
const MASTER_GLYPH_RATIO = 0.53;

/** Rewrites the `scale(1)` on the master's #glyph group. Kept as an exact,
 *  asserted replace so a future edit to icon.svg that drops the hook fails
 *  loudly instead of silently shipping an unscaled maskable icon. */
function withGlyphRatio(svg, ratio) {
  if (ratio === MASTER_GLYPH_RATIO) return svg;
  const scale = (ratio / MASTER_GLYPH_RATIO).toFixed(6);
  const pattern = /(id="glyph" transform="translate\(512,512\) scale\()1(\))/;
  if (!pattern.test(svg)) {
    throw new Error("assets/icon.svg: could not find the #glyph scale hook — did the transform change?");
  }
  return svg.replace(pattern, `$1${scale}$2`);
}

const TARGETS = [
  // iOS web clip. Full bleed, opaque, no corner rounding of our own — iOS
  // applies its squircle mask on top.
  { file: "apple-touch-icon.png", size: 180, glyphRatio: MASTER_GLYPH_RATIO },
  // Android / PWA "any" purpose.
  { file: "icon-192.png", size: 192, glyphRatio: MASTER_GLYPH_RATIO },
  { file: "icon-512.png", size: 512, glyphRatio: MASTER_GLYPH_RATIO },
  // Android maskable — glyph pulled in to clear the 80% safe zone.
  { file: "icon-maskable-512.png", size: 512, glyphRatio: 0.4 },
  // Browser tab.
  { file: "favicon-32.png", size: 32, glyphRatio: MASTER_GLYPH_RATIO },
];

for (const t of TARGETS) {
  const svg = withGlyphRatio(master, t.glyphRatio);
  const buf = await sharp(Buffer.from(svg), { density: 384 })
    .resize(t.size, t.size, { fit: "fill" })
    .flatten({ background: TILE_BOTTOM }) // drops the alpha channel
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(resolve(OUT_DIR, t.file), buf);

  const meta = await sharp(buf).metadata();
  if (meta.hasAlpha) throw new Error(`${t.file} still carries an alpha channel.`);
  console.log(
    `${t.file.padEnd(24)} ${meta.width}x${meta.height}  ` +
      `channels=${meta.channels} alpha=${meta.hasAlpha}  ${buf.length} bytes`
  );
}

console.log(`\nWrote ${TARGETS.length} icons to public/`);
