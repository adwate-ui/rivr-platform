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
  it('reads the database row: amounts in paise as bigints, and a venue not yet configured headed by its name', () => {
    const pack = offlinePackFromRow({
      issuer: null, venue_name: 'RIVR Gurugram', generated_at: '2026-11-15T11:30:00Z', contacts: [],
      balances: [{ name: 'Mihir Shah', member_number: '1042', wallet_paise: 2_500_000, markers_paise: 0 }],
      wallets_paise: 2_500_000, markers_paise: 0, chips_in_play_paise: 48_600_000, cage_float_paise: 0,
      tables: [{ name: 'Table 3', game: 'NLH 100/200', seats: [{ seat: 2, name: 'Mihir Shah', member_number: '1042' }] }],
      waitlist: [], sops: [{ title: 'Cash-out', version: 1, in_force_from: '2026-11-01', body: 'Count the chips.' }],
    });
    expect(pack.issuer).toEqual({ legalName: 'RIVR Gurugram', address: '' });
    expect(pack.balances).toEqual([{ name: 'Mihir Shah', memberNumber: '1042', walletPaise: 2_500_000n, markersPaise: 0n }]);
    expect(pack.chipsInPlayPaise).toBe(48_600_000n);
    expect(pack.tables[0]?.seats).toEqual([{ seat: 2, name: 'Mihir Shah', memberNumber: '1042' }]);
    expect(pack.sops[0]?.inForceFrom).toBe('2026-11-01');
  });

  it('draws its first page as a PNG of an A4 page that matches its baseline', async () => {
    const png = await renderToPng({ ...job, ...A4 });
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', ...A4 });
    expect(await differenceFromBaseline(png, 'document-offline-pack')).toBeLessThanOrEqual(allowedDifference(A4.width, A4.height));
  });

  it('draws as a PDF of A4 pages, as many as it needs: each part from a new page, a long SOP running on', async () => {
    const pdf = await renderToPdf({ ...job, ...A4 });
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    const sizes = pageSizes(pdf);
    // Who to call, balances, the floor, and the SOPs over at least two pages.
    expect(sizes.length).toBeGreaterThanOrEqual(5);
    // A4 at 72 points to the inch: 794 by 1123 CSS pixels.
    for (const size of sizes) {
      expect(Math.abs(size.width - A4.width * 0.75)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(size.height - A4.height * 0.75)).toBeLessThanOrEqual(1.5);
    }
  });
});
