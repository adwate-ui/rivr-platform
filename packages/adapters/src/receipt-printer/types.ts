import type { Result } from '@rivr/contracts';
import type { PrinterFailure } from '../shared/failure.ts';

/** A receipt rendered by `@rivr/render` as a PNG at the printer's width. */
export interface ReceiptImage {
  readonly png: Uint8Array;
  readonly widthPx: number;
}

/** Why a receipt did not print: a printer failure, or an image not rendered at the printer's width. */
export type ReceiptPrintFailure = PrinterFailure | { readonly code: 'wrong_width'; readonly printerWidthPx: number };

/** The cage's thermal receipt printer. */
export interface ReceiptPrinterAdapter {
  /** Printable width in dots; render receipts at exactly this width. 576 for 80 mm paper at 203 dpi. */
  readonly widthPx: number;
  /** Prints the image `copies` times. */
  print(input: {
    readonly image: ReceiptImage;
    readonly copies: number;
  }): Promise<Result<{ readonly jobId: string }, ReceiptPrintFailure>>;
}
