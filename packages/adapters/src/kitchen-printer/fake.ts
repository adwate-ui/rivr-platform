import { err, ok } from '@rivr/contracts';
import type { PrinterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { KitchenOrderTicket, KitchenPrinterAdapter } from './types.ts';

/** The fake kitchen printer with its call log and failure script. */
export type FakeKitchenPrinter = KitchenPrinterAdapter & FakeControls<KitchenOrderTicket, PrinterFailure>;

/** A kitchen printer that prints nothing and records every ticket. */
export function createFakeKitchenPrinter(): FakeKitchenPrinter {
  const recorder = createRecorder<KitchenOrderTicket, PrinterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async printKot(ticket) {
      const failure = recorder.record(ticket);
      if (failure) return err(failure);
      if (ticket.items.length === 0) return err({ code: 'rejected', reason: 'a KOT needs at least one item' });
      return ok({ jobId: `fake-kot-${recorder.calls.length}` });
    },
  };
}
