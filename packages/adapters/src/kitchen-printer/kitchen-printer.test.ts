import { describe, expect, it } from 'vitest';
import { createFakeKitchenPrinter, type KitchenOrderTicket } from './index.ts';

const chai: KitchenOrderTicket = {
  kotNumber: 'KOT-0042',
  tableName: 'Table 2',
  seat: 5,
  items: [{ name: 'Masala chai', quantity: 2, note: null }],
  orderedAt: new Date('2026-11-16T18:34:00Z'),
  isComp: true,
};

describe('fake kitchen printer', () => {
  it('prints a KOT at the bar', async () => {
    const printer = createFakeKitchenPrinter();

    expect(await printer.printKot(chai)).toEqual({ ok: true, value: { jobId: 'fake-kot-1' } });
    expect(printer.calls).toEqual([chai]);
  });

  it('refuses a ticket with nothing on it', async () => {
    expect(await createFakeKitchenPrinter().printKot({ ...chai, items: [] })).toEqual({
      ok: false,
      error: { code: 'rejected', reason: 'a KOT needs at least one item' },
    });
  });

  it('reports paper running out when a test scripts it', async () => {
    const printer = createFakeKitchenPrinter();
    printer.failNext({ code: 'out_of_paper' });

    expect(await printer.printKot(chai)).toEqual({ ok: false, error: { code: 'out_of_paper' } });
  });
});
