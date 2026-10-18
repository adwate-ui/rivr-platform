import type { Result } from '@rivr/contracts';
import type { PrinterFailure } from '../shared/failure.ts';

/** One line of a kitchen order ticket. */
export interface KotItem {
  readonly name: string;
  readonly quantity: number;
  readonly note: string | null;
}

/** A kitchen order ticket for table-side F&B, printed at Glaza's bar. */
export interface KitchenOrderTicket {
  readonly kotNumber: string;
  readonly tableName: string;
  readonly seat: number | null;
  readonly items: readonly KotItem[];
  readonly orderedAt: Date;
  /** Comped by the floor rather than paid. */
  readonly isComp: boolean;
}

/** The bar's network printer for kitchen order tickets. */
export interface KitchenPrinterAdapter {
  /** Prints one ticket. */
  printKot(ticket: KitchenOrderTicket): Promise<Result<{ readonly jobId: string }, PrinterFailure>>;
}
