import { connect } from 'node:net';
import { createAdapters } from '@rivr/adapters';
import type { KitchenPrinterAdapter } from '@rivr/adapters/kitchen-printer';
import { createEscPosKitchenPrinter, type PrinterConnect } from '@rivr/adapters/kitchen-printer-escpos';
import { runConsumer, type Consumer, type OutboxStore } from '@rivr/adapters/outbox';
import { err, fnbOrderedSchema } from '@rivr/contracts';
import type { AgentApi } from './api.ts';

/**
 * The venue's KOTs as an outbox store: claimed and finished through the cage-agent function, as the agent's own. A
 * finish the function could not take is tried once more; one still not taken calls `onUnrecorded`, and that KOT stays
 * claimed and comes back once its lease runs out, while the rest of the batch still prints (F4-10).
 */
export function kotStore(api: AgentApi, token: string, onUnrecorded: () => void = () => undefined): OutboxStore {
  return {
    async claim({ limit }) {
      const claimed = await api.claimKots(token, limit);
      if ('refusal' in claimed) throw new Error(`KOTs not claimed: ${claimed.refusal}`);
      return claimed;
    },
    async finish(outcome) {
      try {
        await api.finishKot(token, outcome);
      } catch {
        await api.finishKot(token, outcome).catch(onUnrecorded);
      }
    },
  };
}

/** bar_printer (#123): prints each fnb.ordered as a KOT on the bar printer. A payload that is no KOT is refused for good. */
export function barPrinter(printer: KitchenPrinterAdapter): Consumer {
  return {
    name: 'bar_printer',
    eventTypes: ['fnb.ordered'],
    isMessaging: false,
    async deliver(delivery) {
      const kot = fnbOrderedSchema.safeParse(delivery.payload);
      if (!kot.success) return err({ code: 'rejected', reason: 'not a KOT' });
      const printed = await printer.printKot({
        kotNumber: kot.data.kot_number, tableName: kot.data.table_name, seat: kot.data.seat, items: kot.data.items,
        orderedAt: new Date(kot.data.ordered_at), isComp: kot.data.is_comp,
      });
      if (printed.ok) return printed;
      // Out of paper is tried again, as a printer that is down is, once the roll is changed.
      return err(printed.error.code === 'out_of_paper' ? ({ code: 'unavailable' } as const) : printed.error);
    },
  };
}

/** The bar printer's raw port over TCP, through Node's own sockets: resolves once every byte is sent. */
export const tcpConnect: PrinterConnect = (host, port, bytes, timeoutMs) => new Promise((resolve, reject) => {
  const socket = connect({ host, port });
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('The bar printer did not answer')));
  socket.once('error', reject);
  socket.once('connect', () => socket.end(bytes, () => resolve()));
});

/** The bar printer at `RIVR_BAR_PRINTER`, `host` or `host:port` (9100 unless given). */
export function barPrinterAt(address: string, open: PrinterConnect = tcpConnect): KitchenPrinterAdapter {
  const [host = '', port] = address.split(':');
  const live = createEscPosKitchenPrinter({ host, port: port === undefined ? 9100 : Number(port), connect: open });
  // The agent serves a real venue: the database never gives it the practice venue's KOTs.
  return createAdapters({ isPracticeVenue: false, live: { kitchenPrinter: live } }).kitchenPrinter;
}

/**
 * Prints the KOTs waiting, ten at most, and says how many were printed, how many failed, and how many the function was
 * not told about, which come back after their lease and print again.
 */
export async function printKots(api: AgentApi, token: string, printer: KitchenPrinterAdapter): Promise<{ delivered: number; failed: number; unrecorded: number }> {
  let unrecorded = 0;
  const done = await runConsumer(kotStore(api, token, () => { unrecorded += 1; }), barPrinter(printer), 10);
  return { ...done, unrecorded };
}
