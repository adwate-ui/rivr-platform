import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { renderToPdf, renderToPng } from './render.ts';
import { PARTNER_STATEMENT } from './test/paper.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

const A4 = tokens.viewport.a4;
const job = { template: 'document.partnerStatement', props: PARTNER_STATEMENT } as const;

// The monthly partner and investor statement (#98). After a deliberate design change,
// RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test -- statement rewrites its baseline.
describe('the partner statement', () => {
  it('draws as a PNG of an A4 page that matches its baseline', async () => {
    const png = await renderToPng({ ...job, ...A4 });
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', ...A4 });
    expect(await differenceFromBaseline(png, 'document-partner-statement')).toBeLessThanOrEqual(allowedDifference(A4.width, A4.height));
  });

  it('draws as a one-page PDF', async () => {
    const pdf = await renderToPdf({ ...job, ...A4 });
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length).toBe(1);
  });
});
