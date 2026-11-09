/**
 * Writes the brand kit: every app icon, splash screen, launch screen, profile image and cover in
 * src/brandKit.ts, drawn from BrandArt and the tokens. Run `pnpm --filter @rivr/render render:brand-kit`
 * after a brand change and commit what it writes. Paths after the command write only the files under them.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import buildRenderHost from '../vitest.global-setup.ts';
import { BRAND_KIT } from '../src/brandKit.ts';
import { renderToPng } from '../src/render.ts';

const REPOSITORY = new URL('../../../', import.meta.url);

// Always from the current tokens: a brand change must never be drawn with an older stylesheet.
execFileSync('pnpm', ['--filter', '@rivr/tokens', 'build'], { stdio: 'inherit' });
execFileSync('pnpm', ['--filter', '@rivr/ui', 'build'], { stdio: 'inherit' });
await buildRenderHost();
const only = process.argv.slice(2).filter((argument) => argument !== '--');
const outputs = only.length === 0 ? BRAND_KIT : BRAND_KIT.filter((output) => only.some((path) => output.path.startsWith(path)));
for (const output of outputs) {
  const file = fileURLToPath(new URL(output.path, REPOSITORY));
  const props = output.backdrop === undefined ? { art: output.art } : { art: output.art, backdrop: output.backdrop };
  const png = await renderToPng({ template: 'brand.art', props, width: output.width, height: output.height });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
}
process.stdout.write(`Wrote ${String(outputs.length)} brand kit files.\n`);
