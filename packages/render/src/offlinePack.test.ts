import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { offlinePackFromRow } from './offlinePack.ts';
import { renderToPdf, renderToPng } from './render.ts';
import { OFFLINE_PACK } from './test/paper.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

const A4 = tokens.viewport.a4;
const job = { template: 'document.offlinePack', props: { pack: OFFLINE_PACK }, pages: 'all' } as const;

/** A PDF's pages, by their size in points. */
function pageSizes(pdf: Buffer): { width: number; height: number }[] {
  return [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
    .map(([, width, height]) => ({ width: Number(width), height: Number(height) }));
}

// The offline pack (#167). After a deliberate design change,
// RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test -- offlinePack rewrites its baseline.
describe('the offline pack', () => {
  it('reads the database row, and a venue not yet configured is headed by its name', () => {
    const pack = offlinePackFromRow({
      issuer: null, venue_name: 'RIVR Gurugram', generated_at: '2026-11-15T11:30:00Z', contacts: [],
      tables: [{ name: 'Table 3', game: 'NLH 100/200', seats: [{ seat: 2, name: 'Mihir Shah', member_number: '1042' }] }],
      waitlist: [{ table: 'Table 3', game: 'NLH 100/200', place: 1, name: 'Ritika Das', member_number: '1051' }],
    });
    expect(pack.issuer).toEqual({ legalName: 'RIVR Gurugram', address: '' });
    expect(pack.tables[0]?.seats).toEqual([{ seat: 2, name: 'Mihir Shah', memberNumber: '1042' }]);
    expect(pack.waitlist).toEqual([{ table: 'Table 3', game: 'NLH 100/200', place: 1, name: 'Ritika Das', memberNumber: '1051' }]);
  });

  it('draws its first page as a PNG of an A4 page that matches its baseline', async () => {
    const png = await renderToPng({ ...job, ...A4 });
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', ...A4 });
    expect(await differenceFromBaseline(png, 'document-offline-pack')).toBeLessThanOrEqual(allowedDifference(A4.width, A4.height));
  });

  it('draws as a PDF of A4 pages, as many as it needs: each part from a new page', async () => {
    const pdf = await renderToPdf({ ...job, ...A4 });
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    const sizes = pageSizes(pdf);
    // Who to call and the floor.
    expect(sizes.length).toBeGreaterThanOrEqual(2);
    // A4 at 72 points to the inch: 794 by 1123 CSS pixels.
    for (const size of sizes) {
      expect(Math.abs(size.width - A4.width * 0.75)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(size.height - A4.height * 0.75)).toBeLessThanOrEqual(1.5);
    }
  });
});
