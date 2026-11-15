import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { renderToPdf, renderToPng } from './render.ts';
import { INVOICE, STATEMENT } from './test/paper.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

const A4 = tokens.viewport.a4;

/** The number of pages in a PDF. */
function pageCount(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

/** The first page's width and height in points, from its MediaBox. */
function pageSizeInPoints(pdf: Buffer): number[] {
  const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf.toString('latin1'));
  return [Number(box?.[1]), Number(box?.[2])];
}

// Each is compared with its baseline; after a deliberate design change,
// RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test -- paper rewrites them.
describe.each([
  ['invoice', { template: 'document.invoice', props: INVOICE }],
  ['statement', { template: 'document.statement', props: STATEMENT }],
] as const)('the A4 %s', (name, job) => {
  it('draws as a PNG of an A4 page that matches its baseline', async () => {
    const png = await renderToPng({ ...job, ...A4 });
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', ...A4 });
    expect(await differenceFromBaseline(png, `document-${name}`)).toBeLessThanOrEqual(allowedDifference(A4.width, A4.height));
  });

  it('draws as a one-page A4 PDF', async () => {
    const pdf = await renderToPdf({ ...job, ...A4 });
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(pageCount(pdf)).toBe(1);
    // A4 is 595.28 by 841.89 points; Chromium rounds the page to within half a millimetre of it.
    const [width = 0, height = 0] = pageSizeInPoints(pdf);
    expect(Math.abs(width - 595.28)).toBeLessThan(1.5);
    expect(Math.abs(height - 841.89)).toBeLessThan(1.5);
    // Each glyph drawn is text in the PDF, with its font embedded: a blank page would have none.
    expect(pdf.toString('latin1')).toContain('/FontFile');
  });
});

describe('a document longer than its page', () => {
  it('is refused rather than cut off, so no statement loses its closing balance', async () => {
    const movement = STATEMENT.movements[0] ?? { at: '', description: '', amountPaise: 0n, balancePaise: 0n };
    const props = { ...STATEMENT, movements: Array.from({ length: 30 }, () => movement) };
    await expect(renderToPng({ template: 'document.statement', props, ...A4 })).rejects.toThrow(/more than the 1123 px page/);
  });
});
