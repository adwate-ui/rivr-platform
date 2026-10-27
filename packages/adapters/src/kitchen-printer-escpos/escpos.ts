import { err, ok } from '@rivr/contracts';
import { documents, formatTime, registerMessages, t } from '@rivr/i18n';
import type { KitchenOrderTicket, KitchenPrinterAdapter } from '../kitchen-printer/types.ts';

// The KOT's words are the documents namespace's, as the printed documents' are.
registerMessages({ documents });

/**
 * Sends bytes to a network printer and resolves once they are written, or rejects on a refused connection or after
 * `timeoutMs`. The caller gives it: the cage agent opens a TCP socket with Node's net, and this package stays free of
 * any one runtime's sockets.
 */
export type PrinterConnect = (host: string, port: number, bytes: Uint8Array, timeoutMs: number) => Promise<void>;

const ESC = 0x1b;
const GS = 0x1d;
const LINE = 0x0a;

/** Text as the printer's own font prints it: printable ASCII, anything else a question mark. */
function ascii(text: string): number[] {
  return Array.from(text, (character) => {
    const code = character.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e ? code : 0x3f;
  });
}

/**
 * A ticket as ESC/POS commands, which the usual network kitchen printers take: the KOT's number large, the table and
 * seat, paid or comp, the time, each line with its note beneath, then a feed and a cut.
 */
export function kotBytes(ticket: KitchenOrderTicket): Uint8Array {
  const text = (line: string) => [...ascii(line), LINE];
  const bytes = [
    ESC, 0x40,
    GS, 0x21, 0x11, ESC, 0x45, 1, ...text(t('documents.kot.title', { number: ticket.kotNumber })), GS, 0x21, 0x00,
    ...text(ticket.seat === null ? ticket.tableName : t('documents.kot.seat', { table: ticket.tableName, seat: ticket.seat })),
    ...text(t(ticket.isComp ? 'documents.kot.comp' : 'documents.kot.paid')), ESC, 0x45, 0,
    ...text(formatTime(ticket.orderedAt)),
    LINE,
    ...ticket.items.flatMap((item) => [
      ...text(t('documents.kot.line', { quantity: item.quantity, name: item.name })),
      ...(item.note === null ? [] : text(`   ${item.note}`)),
    ]),
    ESC, 0x64, 4,
    GS, 0x56, 0x42, 0,
  ];
  return Uint8Array.from(bytes);
}

/**
 * The bar's network kitchen printer, speaking ESC/POS on its raw port (9100 unless set): a ticket is one connection.
 * The printer's make and model are not known yet (owner, 27 Oct); this is what most network thermal printers take.
 */
export function createEscPosKitchenPrinter(options: { host: string; port?: number; connect: PrinterConnect; timeoutMs?: number }): KitchenPrinterAdapter {
  const { host, port = 9100, connect, timeoutMs = 5_000 } = options;
  return {
    async printKot(ticket) {
      if (ticket.items.length === 0) return err({ code: 'rejected', reason: 'a KOT needs at least one item' });
      try {
        await connect(host, port, kotBytes(ticket), timeoutMs);
        return ok({ jobId: `kot-${ticket.kotNumber}-${String(ticket.orderedAt.getTime())}` });
      } catch {
        return err({ code: 'unavailable' });
      }
    },
  };
}
