/**
 * Writes the brand kit: every app icon, splash screen, launch screen, profile image and cover in
 * src/brandKit.ts, drawn from BrandArt and the tokens. Run `pnpm --filter @rivr/render render:brand-kit`
 * after a brand change and commit what it writes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import buildRenderHost from '../vitest.global-setup.ts';
import { BRAND_KIT } from '../src/brandKit.ts';
import { renderToPng } from '../src/render.ts';

const REPOSITORY = new URL('../../../', import.meta.url);

await buildRenderHost();
for (const output of BRAND_KIT) {
  const file = fileURLToPath(new URL(output.path, REPOSITORY));
  const png = await renderToPng({ template: 'brand.art', props: { art: output.art }, width: output.width, height: output.height });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
}
process.stdout.write(`Wrote ${String(BRAND_KIT.length)} brand kit files.\n`);
