import { afterEach, describe, expect, it, vi } from 'vitest';
import { AADHAAR_FRONT_COVERS, cardJpeg, coveredPhoto, moved, resized, type CoverBar } from './coverBars.ts';

const BAR: CoverBar = { x: 0.2, y: 0.5, width: 0.3, height: 0.1 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('moving a cover', () => {
  it('moves by the share given', () => {
    const next = moved(BAR, 0.1, -0.2);
    expect(next.x).toBeCloseTo(0.3, 5);
    expect(next.y).toBeCloseTo(0.3, 5);
    expect([next.width, next.height]).toEqual([0.3, 0.1]);
  });

  it('stays on the photo at every edge', () => {
    expect(moved(BAR, -1, -1)).toMatchObject({ x: 0, y: 0 });
    const far = moved(BAR, 1, 1);
    expect(far.x).toBeCloseTo(0.7, 5);
    expect(far.y).toBeCloseTo(0.9, 5);
  });
});

describe('resizing a cover', () => {
  it('grows and shrinks from its corner', () => {
    const next = resized(BAR, 0.1, 0.05);
    expect(next.width).toBeCloseTo(0.4, 5);
    expect(next.height).toBeCloseTo(0.15, 5);
    expect([next.x, next.y]).toEqual([0.2, 0.5]);
  });

  it('never shrinks to nothing, so a cover cannot be made to hide nothing', () => {
    const next = resized(BAR, -1, -1);
    expect(next.width).toBeGreaterThan(0.04);
    expect(next.height).toBeGreaterThan(0.04);
  });

  it('never runs off the photo', () => {
    const next = resized(BAR, 2, 2);
    expect(BAR.x + next.width).toBeCloseTo(1, 5);
    expect(BAR.y + next.height).toBeCloseTo(1, 5);
  });
});

describe('an Aadhaar front', () => {
  it('starts with two covers on the photo: the first eight digits and the QR code', () => {
    expect(AADHAAR_FRONT_COVERS).toHaveLength(2);
    for (const bar of AADHAAR_FRONT_COVERS) {
      expect(bar.x + bar.width).toBeLessThanOrEqual(1);
      expect(bar.y + bar.height).toBeLessThanOrEqual(1);
    }
  });
});

describe('the covered photo', () => {
  /** A canvas that records what is drawn on it, as jsdom has none. */
  function stubCanvas() {
    const drawn: string[] = [];
    const context = {
      fillStyle: '',
      drawImage: () => drawn.push('photo'),
      fillRect: (x: number, y: number, width: number, height: number) => drawn.push(`cover ${String(x)},${String(y)},${String(width)},${String(height)}`),
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => context, configurable: true });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { value: (done: (blob: Blob) => void) => done(new Blob(['covered'], { type: 'image/jpeg' })), configurable: true });
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 1000, height: 500, close: () => undefined }));
    return drawn;
  }

  it('paints each cover after the photo, in the photo\'s own pixels, and hands back a new image', async () => {
    const drawn = stubCanvas();
    const original = new Blob(['original'], { type: 'image/jpeg' });
    const covered = await coveredPhoto(original, [{ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }]);
    expect(drawn).toEqual(['photo', 'cover 100,100,500,200']);
    expect(covered).not.toBe(original);
    expect(await covered.text()).toBe('covered');
  });

  it('refuses to hand back a photo when no cover is given', async () => {
    stubCanvas();
    await expect(coveredPhoto(new Blob(['original']), [])).rejects.toThrow();
  });
});

describe('a card photo the server will take', () => {
  /** A canvas whose JPEG is this many bytes at each quality tried; the qualities tried are kept. */
  function canvasMaking(bytesOf: (quality: number) => number) {
    const tried: number[] = [];
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((done, _type, quality) => {
      const made = Number(quality);
      tried.push(made);
      done(new Blob([new Uint8Array(bytesOf(made))]));
    });
    return { canvas, tried };
  }

  it('stays at the best quality when the photo fits', async () => {
    const { canvas, tried } = canvasMaking(() => 800_000);
    expect((await cardJpeg(canvas)).size).toBe(800_000);
    expect(tried).toEqual([0.92]);
  });

  it('steps down until it fits', async () => {
    const { canvas, tried } = canvasMaking((quality) => (quality > 0.8 ? 2_500_000 : 1_500_000));
    expect((await cardJpeg(canvas)).size).toBe(1_500_000);
    expect(tried).toEqual([0.92, 0.82, 0.72]);
  });

  it('gives its smallest when none fits, for the server to refuse in words', async () => {
    const { canvas, tried } = canvasMaking(() => 3_000_000);
    expect((await cardJpeg(canvas)).size).toBe(3_000_000);
    expect(tried).toHaveLength(3);
  });

  it('fails when the browser cannot make a JPEG', async () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'toBlob').mockImplementation((done) => done(null));
    await expect(cardJpeg(canvas)).rejects.toThrow('The card photo was not made');
  });
});
