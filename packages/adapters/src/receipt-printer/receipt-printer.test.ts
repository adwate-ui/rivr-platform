import { describe, expect, it } from 'vitest';
import { createFakeReceiptPrinter, type ReceiptImage } from './index.ts';

const receipt = (widthPx: number): ReceiptImage => ({ png: new Uint8Array([137, 80, 78, 71]), widthPx });

describe('fake receipt printer', () => {
  it('prints an image rendered at the printer width', async () => {
    const printer = createFakeReceiptPrinter();

    expect(printer.widthPx).toBe(576);
    expect(await printer.print({ image: receipt(576), copies: 2 })).toEqual({ ok: true, value: { jobId: 'fake-receipt-1' } });
    expect(printer.calls).toEqual([{ image: receipt(576), copies: 2 }]);
  });

  it('refuses an image of another width rather than print it scaled', async () => {
    const printer = createFakeReceiptPrinter({ widthPx: 384 });

    expect(await printer.print({ image: receipt(576), copies: 1 })).toEqual({
      ok: false,
      error: { code: 'wrong_width', printerWidthPx: 384 },
    });
  });

  it('reports paper running out when a test scripts it', async () => {
    const printer = createFakeReceiptPrinter();
    printer.failNext({ code: 'out_of_paper' });

    expect(await printer.print({ image: receipt(576), copies: 1 })).toEqual({ ok: false, error: { code: 'out_of_paper' } });
  });
});
