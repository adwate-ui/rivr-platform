/**
 * Makes each still in public/media at the widths the website's <picture> elements offer (UI polish audit AS-10), as AVIF
 * and WebP in public/media/w/, which git ignores. A still is never enlarged: at a width beyond it, that width's file is a
 * copy of the still at its own size, so every address a page names exists. Runs before the website's dev server and
 * build, and before Storybook, which serves this folder too. A file newer than its still is kept.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** As MEDIA_WIDTHS in @rivr/ui (src/internal/webMedia.tsx). */
const WIDTHS = [640, 1280, 1920, 2560];
const ENCODE = { avif: { quality: 55, effort: 2 }, webp: { quality: 80 } };

const media = join(dirname(fileURLToPath(import.meta.url)), '../public/media');
const out = join(media, 'w');
mkdirSync(out, { recursive: true });

/** Whether `file` was made from `still` as it is now. */
function isFresh(file, still) {
  try {
    return statSync(file).mtimeMs >= statSync(still).mtimeMs;
  } catch {
    return false;
  }
}

/** One still in one format at every width: each size encoded once, a width beyond the still a copy of its own size. */
async function makeWidths(name, still, stillWidth, format) {
  const made = new Map();
  for (const width of WIDTHS) {
    const file = join(out, `${parse(name).name}-${width}.${format}`);
    const size = Math.min(width, stillWidth);
    if (!isFresh(file, still)) {
      if (made.has(size)) copyFileSync(made.get(size), file);
      else await sharp(still).resize({ width: size })[format](ENCODE[format]).toFile(file);
    }
    made.set(size, file);
  }
}

for (const name of readdirSync(media).filter((file) => /\.(webp|jpe?g|png)$/.test(file))) {
  const still = join(media, name);
  const { width: stillWidth = Infinity } = await sharp(still).metadata();
  for (const format of ['avif', 'webp']) await makeWidths(name, still, stillWidth, format);
}
