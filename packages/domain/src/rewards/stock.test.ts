import { describe, expect, it } from 'vitest';
import { LOW_STOCK, soldOutLast, stockLevel } from './index.ts';

describe('a reward\u2019s stock (F-072)', () => {
  it('is sold out at none left', () => {
    expect(stockLevel(0)).toBe('sold_out');
  });

  it('is low from one up to under the threshold', () => {
    expect(stockLevel(1)).toBe('low');
    expect(stockLevel(LOW_STOCK - 1)).toBe('low');
  });

  it('is enough at the threshold, above it, or with no limit', () => {
    expect(stockLevel(LOW_STOCK)).toBe('enough');
    expect(stockLevel(42)).toBe('enough');
    expect(stockLevel(null)).toBe('enough');
  });
});

describe('sold out last (F-187)', () => {
  it('moves only what has none left, keeping the order of the rest', () => {
    const [cap, hoodie, seat, mug] = [{ id: 'cap', stock: 0 }, { id: 'hoodie', stock: 3 }, { id: 'seat', stock: null }, { id: 'mug', stock: 0 }];
    expect(soldOutLast([cap, hoodie, seat, mug])).toEqual([hoodie, seat, cap, mug]);
  });

  it('leaves the list it was given alone', () => {
    const items = [{ stock: 0 }, { stock: 1 }];
    soldOutLast(items);
    expect(items).toEqual([{ stock: 0 }, { stock: 1 }]);
  });
});
