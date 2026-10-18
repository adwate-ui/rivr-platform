import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { renderToPdf, renderToPng } from './render.ts';

const BASELINE = new URL('../baselines/tv-bad-beat-jackpot.png', import.meta.url);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Up to 0.1% of the pixels may differ, for anti-aliasing between machines; a layout or
// colour change moves far more than that.
const MAX_DIFFERENT_PIXELS = (1920 * 1080) / 1000;

const SLIDE = { template: 'tv.badBeatJackpot', props: { amountPaise: 34_260_000n }, width: 1920, height: 1080 } as const;

/** Width and height from the IHDR chunk that follows the PNG signature. */
function pngSize(png: Buffer) {
  return { chunk: png.toString('ascii', 12, 16), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** How many pixels differ between two PNGs of the same size, decoded by Chromium itself. */
async function differentPixels(actual: Buffer, expected: Buffer): Promise<number> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await page.evaluate(
      async ([left, right]) => {
        const pixels = async (base64: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = new OffscreenCanvas(image.width, image.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('No 2D canvas');
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, image.width, image.height).data;
        };
        const [a, b] = await Promise.all([pixels(left), pixels(right)]);
        if (a.length !== b.length) return Number.POSITIVE_INFINITY;
        let count = 0;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count += 1;
        }
        return count;
      },
      [actual.toString('base64'), expected.toString('base64')] as const,
    );
  } finally {
    await browser.close();
  }
}

describe('renderToPng', () => {
  it('draws the bad-beat jackpot slide as a 1920 by 1080 PNG that matches the baseline', async () => {
    const png = await renderToPng(SLIDE);
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', width: 1920, height: 1080 });
    // RIVR_UPDATE_BASELINES=1 pnpm --filter @rivr/render test rewrites the baseline after a deliberate change.
    if (process.env.RIVR_UPDATE_BASELINES) writeFileSync(BASELINE, png);
    expect(await differentPixels(png, readFileSync(BASELINE))).toBeLessThanOrEqual(MAX_DIFFERENT_PIXELS);
  });
});

describe('renderToPdf', () => {
  it('draws the same slide as a one-page PDF', async () => {
    const pdf = await renderToPdf(SLIDE);
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });
});
