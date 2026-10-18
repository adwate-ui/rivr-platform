import { describe, expect, it } from 'vitest';
import { renderToPdf, renderToPng } from './render.ts';
import { allowedDifference, differenceFromBaseline, PNG_SIGNATURE, pngSize } from './test/png.ts';

const SLIDE = { template: 'tv.badBeatJackpot', props: { amountPaise: 34_260_000n }, width: 1920, height: 1080 } as const;

describe('renderToPng', () => {
  it('draws the bad-beat jackpot slide as a 1920 by 1080 PNG that matches the baseline', async () => {
    const png = await renderToPng(SLIDE);
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', width: 1920, height: 1080 });
    // RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test rewrites the baseline after a deliberate change.
    expect(await differenceFromBaseline(png, 'tv-bad-beat-jackpot')).toBeLessThanOrEqual(allowedDifference(1920, 1080));
  });
});

describe('renderToPdf', () => {
  it('draws the same slide as a one-page PDF', async () => {
    const pdf = await renderToPdf(SLIDE);
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });
});
