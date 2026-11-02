import { describe, expect, it } from 'vitest';
import { ORDER_STAGES, orderStage } from './index.ts';

const AT = '2026-11-15T17:00:00Z';

describe('where a member\'s order stands (decision 0320)', () => {
  it('reads the bar\'s furthest step: sent, preparing, on its way, delivered', () => {
    expect(ORDER_STAGES).toEqual(['sent', 'preparing', 'on_its_way', 'delivered']);
    expect(orderStage({ acceptedAt: null, onWayAt: null, deliveredAt: null })).toBe('sent');
    expect(orderStage({ acceptedAt: AT, onWayAt: null, deliveredAt: null })).toBe('preparing');
    expect(orderStage({ acceptedAt: AT, onWayAt: AT, deliveredAt: null })).toBe('on_its_way');
    expect(orderStage({ acceptedAt: AT, onWayAt: AT, deliveredAt: AT })).toBe('delivered');
  });

  it('reads an order delivered without being marked on its way as delivered', () => {
    expect(orderStage({ acceptedAt: AT, onWayAt: null, deliveredAt: AT })).toBe('delivered');
  });
});
