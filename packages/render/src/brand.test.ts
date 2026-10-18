import { describe, expect, it } from 'vitest';
import { renderToPng } from './render.ts';
import type { TemplateProps } from './templates/index.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

// One design per art, drawn at very different sizes; RIVR_UPDATE_BASELINES=1 rewrites the baselines.
const CASES: readonly { name: string; props: TemplateProps<'brand.art'>; width: number; height: number }[] = [
  { name: 'icon-48', props: { art: 'icon' }, width: 48, height: 48 },
  { name: 'icon-512', props: { art: 'icon' }, width: 512, height: 512 },
  { name: 'maskable-512', props: { art: 'maskable' }, width: 512, height: 512 },
  { name: 'adaptive-432', props: { art: 'adaptive' }, width: 432, height: 432 },
  { name: 'splash-1170x2532', props: { art: 'lockup' }, width: 1170, height: 2532 },
  { name: 'cover-1500x500', props: { art: 'lockup' }, width: 1500, height: 500 },
];

describe('brand art', () => {
  it.each(CASES)('draws $name at exactly its size, matching the baseline', async ({ name, props, width, height }) => {
    const png = await renderToPng({ template: 'brand.art', props, width, height });
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', width, height });
    expect(await differenceFromBaseline(png, `brand-${name}`)).toBeLessThanOrEqual(allowedDifference(width, height));
  });
});
