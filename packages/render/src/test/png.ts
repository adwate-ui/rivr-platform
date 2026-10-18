import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from the IHDR chunk that follows the PNG signature. */
export function pngSize(png: Buffer) {
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

/**
 * How many pixels of `png` differ from the committed baseline `baselines/<name>.png`. With
 * RIVR_UPDATE_BASELINES=1 it first rewrites the baseline, after a deliberate design change.
 */
export async function differenceFromBaseline(png: Buffer, name: string): Promise<number> {
  const baseline = new URL(`../../baselines/${name}.png`, import.meta.url);
  if (process.env.RIVR_UPDATE_BASELINES) writeFileSync(baseline, png);
  return differentPixels(png, readFileSync(baseline));
}

/** Up to 0.1% of the pixels may differ, for anti-aliasing between machines; a layout or colour change moves far more. */
export function allowedDifference(width: number, height: number): number {
  return (width * height) / 1000;
}
