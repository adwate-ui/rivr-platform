import type { FnbOrderTonight } from '@rivr/db/fnb';
import { describe, expect, it } from 'vitest';
import { ordersByLane } from './orderLanes.ts';

const BASE: FnbOrderTonight = {
  orderId: 'o', kotNumber: 0, tableName: 'Table 3', seat: 5, memberName: 'Yash Gupta', memberNumber: 1043, lines: [], isComp: false, source: 'app',
  createdAt: '2026-11-15T16:00:00Z', kotSentBy: 'agent', isKotPrintFailed: false, seatState: 'seated', acceptedAt: '2026-11-15T16:30:00Z', deliveredAt: null,
  ageSeconds: 60, cancelledAt: null, cancelReason: null, onWayAt: null,
};
const order = (kotNumber: number, deliveredAt: string | null): FnbOrderTonight =>
  ({ ...BASE, orderId: `o${kotNumber}`, kotNumber, createdAt: `2026-11-15T16:${String(kotNumber).padStart(2, '0')}:00Z`, deliveredAt });

describe('ordersByLane', () => {
  it('keeps standing orders oldest first and delivered ones newest first (audit F-096)', () => {
    const lanes = ordersByLane([order(1, 'x'), order(2, null), order(3, 'x'), order(4, null)]);
    expect(lanes.preparing.map((one) => one.kotNumber)).toEqual([2, 4]);
    expect(lanes.delivered.map((one) => one.kotNumber)).toEqual([3, 1]);
  });
});
