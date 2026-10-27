import { describe, expect, it, vi } from 'vitest';
import { createEscPosKitchenPrinter, kotBytes, type PrinterConnect } from './escpos.ts';
import type { KitchenOrderTicket } from '../kitchen-printer/types.ts';

const TICKET: KitchenOrderTicket = {
  kotNumber: '12',
  tableName: 'Table 3',
  seat: 5,
  items: [{ name: 'Masala chai', quantity: 2, note: 'Less sugar' }, { name: 'Club sandwich', quantity: 1, note: null }],
  orderedAt: new Date('2026-11-15T16:30:00Z'),
  isComp: false,
};

/** The ticket's printable text, the commands left out. */
function printedText(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => (byte === 0x0a || (byte >= 0x20 && byte <= 0x7e) ? String.fromCharCode(byte) : '')).join('');
}

describe('the bar printer (ESC/POS)', () => {
  it('prints the KOT large, the seat, paid or comp, the time, and each line with its note, then cuts', () => {
    const bytes = kotBytes(TICKET);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0]);
    const text = printedText(bytes);
    for (const line of ['KOT 12', 'Table 3, seat 5', 'PAID BY THE MEMBER', '22:00', '2 x Masala chai', '   Less sugar', '1 x Club sandwich']) {
      expect(text).toContain(line);
    }
    expect(printedText(kotBytes({ ...TICKET, isComp: true }))).toContain('COMP - RIVR');
  });

  it('prints what its font cannot as a question mark', () => {
    expect(printedText(kotBytes({ ...TICKET, items: [{ name: 'Chai ☕', quantity: 1, note: null }] }))).toContain('1 x Chai ?');
  });

  it('sends one ticket to the printer\'s raw port, and says when it cannot be reached', async () => {
    const connect = vi.fn<PrinterConnect>(() => Promise.resolve());
    const printer = createEscPosKitchenPrinter({ host: '192.168.1.50', connect });
    expect((await printer.printKot(TICKET)).ok).toBe(true);
    expect(connect).toHaveBeenCalledWith('192.168.1.50', 9100, kotBytes(TICKET), 5_000);
    const down = createEscPosKitchenPrinter({ host: '192.168.1.50', connect: () => Promise.reject(new Error('ECONNREFUSED')) });
    expect(await down.printKot(TICKET)).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await printer.printKot({ ...TICKET, items: [] })).toEqual({ ok: false, error: { code: 'rejected', reason: 'a KOT needs at least one item' } });
  });
});
