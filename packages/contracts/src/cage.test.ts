import { describe, expect, it } from 'vitest';
import { chipCountSchema, closeShiftSchema, eodReviewSchema, openShiftSchema } from './cage.ts';

describe('the cage\'s chip count and shift (#24)', () => {
  it('takes a whole number of each chip, none included', () => {
    expect(chipCountSchema.safeParse({ quantities: ['400', '0', ' 12 '] }).success).toBe(true);
    expect(chipCountSchema.parse({ quantities: [' 12 '] }).quantities).toEqual(['12']);
  });

  it('refuses part of a chip, fewer than none, a count left blank, or no chips at all', () => {
    for (const quantity of ['1.5', '-1', '', '007', '1000000']) {
      expect(chipCountSchema.safeParse({ quantities: ['1', quantity] }).success).toBe(false);
    }
    expect(chipCountSchema.safeParse({ quantities: [] }).success).toBe(false);
  });

  it('opens a shift with a float in whole rupees, nothing included', () => {
    expect(openShiftSchema.safeParse({ float: '1200000', quantities: ['400'] }).success).toBe(true);
    expect(openShiftSchema.safeParse({ float: '0', quantities: ['400'] }).success).toBe(true);
    expect(openShiftSchema.safeParse({ float: '1200000.50', quantities: ['400'] }).success).toBe(false);
    expect(openShiftSchema.safeParse({ float: '', quantities: ['400'] }).success).toBe(false);
  });
});

describe('closing the cage\'s shift (#45)', () => {
  it('takes the cash, receipts and markers in whole rupees, nothing included, with the chips', () => {
    expect(closeShiftSchema.safeParse({ cash: '1206000', receipts: '20000', markers: '0', quantities: ['400'] }).success).toBe(true);
    expect(closeShiftSchema.safeParse({ cash: '1206000.50', receipts: '20000', markers: '0', quantities: ['400'] }).success).toBe(false);
    expect(closeShiftSchema.safeParse({ cash: '1206000', receipts: '', markers: '0', quantities: ['400'] }).success).toBe(false);
  });

  it('takes a reviewer\'s reason of 3 to 500 characters', () => {
    expect(eodReviewSchema.safeParse({ reason: ' A note paid out twice ' }).success).toBe(true);
    expect(eodReviewSchema.safeParse({ reason: ' ab ' }).success).toBe(false);
    expect(eodReviewSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });
});
