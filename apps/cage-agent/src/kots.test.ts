import { createServer } from 'node:net';
import { createFakeKitchenPrinter } from '@rivr/adapters/kitchen-printer';
import type { ClaimedDelivery } from '@rivr/adapters/outbox';
import { describe, expect, it, vi } from 'vitest';
import type { AgentApi } from './api.ts';
import { barPrinterAt, printKots, tcpConnect } from './kots.ts';

const KOT = {
  order_id: '00000000-0000-4000-8000-0000000f0001', kot_number: '12', table_name: 'Table 3', seat: 5,
  items: [{ name: 'Masala chai', quantity: 2, note: 'Less sugar' }], ordered_at: '2026-11-15T16:30:00Z', is_comp: false,
};

function delivery(id: string, payload: unknown): ClaimedDelivery {
  return { deliveryId: id, eventId: `e-${id}`, venueId: 'v1', eventType: 'fnb.ordered', payload, attempts: 1 };
}

/** The function, giving `claimed` and recording each finish. */
function fakeApi(claimed: ClaimedDelivery[]) {
  const finished: unknown[] = [];
  const api: AgentApi = {
    enrol: vi.fn(), newestPack: vi.fn(),
    claimKots: vi.fn(() => Promise.resolve(claimed)),
    finishKot: vi.fn((_token, outcome) => { finished.push(outcome); return Promise.resolve(); }),
  };
  return { api, finished };
}

describe('printing KOTs at the bar', () => {
  it('prints each claimed KOT and tells the function it is printed; a payload that is no KOT is refused for good', async () => {
    const printer = createFakeKitchenPrinter();
    const { api, finished } = fakeApi([delivery('d1', KOT), delivery('d2', { not: 'a KOT' })]);
    expect(await printKots(api, 'token', printer)).toEqual({ delivered: 1, failed: 1 });
    expect(printer.calls).toEqual([{
      kotNumber: '12', tableName: 'Table 3', seat: 5, items: [{ name: 'Masala chai', quantity: 2, note: 'Less sugar' }],
      orderedAt: new Date('2026-11-15T16:30:00Z'), isComp: false,
    }]);
    expect(finished).toEqual([
      { deliveryId: 'd1', isDelivered: true, error: null, retryAfterSeconds: 0 },
      { deliveryId: 'd2', isDelivered: false, error: 'rejected: not a KOT', retryAfterSeconds: null },
    ]);
  });

  it('tries a KOT again later while the printer cannot be reached', async () => {
    const { api, finished } = fakeApi([delivery('d1', KOT)]);
    const unreachable = barPrinterAt('192.0.2.1', () => Promise.reject(new Error('ECONNREFUSED')));
    expect(await printKots(api, 'token', unreachable)).toEqual({ delivered: 0, failed: 1 });
    expect(finished).toEqual([{ deliveryId: 'd1', isDelivered: false, error: 'unavailable', retryAfterSeconds: 60 }]);
  });

  it('sends the ticket\'s bytes to the printer\'s raw port over TCP', async () => {
    const received: Buffer[] = [];
    const server = createServer((socket) => socket.on('data', (chunk) => received.push(chunk)));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    await tcpConnect('127.0.0.1', port, Uint8Array.from([0x1b, 0x40, 0x41]), 2_000);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(Array.from(Buffer.concat(received))).toEqual([0x1b, 0x40, 0x41]);
  });
});
