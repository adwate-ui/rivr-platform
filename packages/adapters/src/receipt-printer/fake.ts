import { err, ok } from '@rivr/contracts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { ReceiptImage, ReceiptPrinterAdapter, ReceiptPrintFailure } from './types.ts';

/** A print job the fake received. */
export interface ReceiptPrintCall {
  readonly image: ReceiptImage;
  readonly copies: number;
}

/** The fake receipt printer with its call log and failure script. */
export type FakeReceiptPrinter = ReceiptPrinterAdapter & FakeControls<ReceiptPrintCall, ReceiptPrintFailure>;

/** An 80 mm printer (576 dots) that prints nothing and refuses images of any other width. */
export function createFakeReceiptPrinter(options: { readonly widthPx?: number } = {}): FakeReceiptPrinter {
  const recorder = createRecorder<ReceiptPrintCall, ReceiptPrintFailure>();
  const widthPx = options.widthPx ?? 576;
  return {
    widthPx,
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async print({ image, copies }) {
      const failure = recorder.record({ image, copies });
      if (failure) return err(failure);
      if (image.widthPx !== widthPx) return err({ code: 'wrong_width', printerWidthPx: widthPx });
      return ok({ jobId: `fake-receipt-${recorder.calls.length}` });
    },
  };
}
