/**
 * Writes the logo animation: the wordmark's tiles rising in turn, as an MP4 for reels and one for
 * the TV (src/logo.ts). Run `pnpm --filter @rivr/render render:logo` after a brand change and
 * commit what it writes.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import buildRenderHost from '../vitest.global-setup.ts';
import { LOGO_TIMING, LOGO_VIDEOS } from '../src/logo.ts';
import { renderToMp4 } from '../src/render.ts';

const REPOSITORY = new URL('../../../', import.meta.url);

// Always from the current tokens: a brand change must never be drawn with an older stylesheet.
execFileSync('pnpm', ['--filter', '@rivr/tokens', 'build'], { stdio: 'inherit' });
execFileSync('pnpm', ['--filter', '@rivr/ui', 'build'], { stdio: 'inherit' });
await buildRenderHost();
for (const video of LOGO_VIDEOS) {
  const file = fileURLToPath(new URL(video.path, REPOSITORY));
  const props = { art: 'lockup', isAnimated: true } as const;
  const mp4 = await renderToMp4({ template: 'brand.art', props, width: video.width, height: video.height }, LOGO_TIMING);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, mp4);
  process.stdout.write(`Wrote ${video.path} (${String(Math.round(mp4.length / 1024))} KB).\n`);
}
