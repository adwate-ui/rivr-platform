import { describe, expect, it } from 'vitest';
import { badBeatSchema, jackpotReversalSchema } from './jackpot.ts';

const TABLE = '0b0b0b0b-0000-4000-8000-000000000003';
const BEAT = { tableId: TABLE, loserPhone: '90000 00201', winnerPhone: '9000000202', otherPhones: '9000000203, 9000000204\n9000000209' };

describe('a bad beat as the floor records it (#48)', () => {
  it('gives the numbers as +91 numbers, the others split by commas and lines', () => {
    expect(badBeatSchema.parse(BEAT)).toEqual({
      tableId: TABLE, loserPhone: '+919000000201', winnerPhone: '+919000000202',
      otherPhones: ['+919000000203', '+919000000204', '+919000000209'],
    });
    expect(badBeatSchema.parse({ ...BEAT, otherPhones: '' }).otherPhones).toEqual([]);
  });

  it('takes every player once, real mobile numbers, and at most nine others', () => {
    expect(badBeatSchema.safeParse({ ...BEAT, winnerPhone: '9000000201' }).success).toBe(false);
    expect(badBeatSchema.safeParse({ ...BEAT, otherPhones: '9000000203, 9000000203' }).success).toBe(false);
    expect(badBeatSchema.safeParse({ ...BEAT, otherPhones: '12345' }).success).toBe(false);
    expect(badBeatSchema.safeParse({ ...BEAT, otherPhones: Array.from({ length: 10 }, (_, i) => `90000003${String(i).padStart(2, '0')}`).join(',') }).success).toBe(false);
    expect(badBeatSchema.safeParse({ ...BEAT, tableId: 'Table 3' }).success).toBe(false);
  });

  it('asks a reason of a few words to reverse a payout', () => {
    expect(jackpotReversalSchema.parse({ reason: '  Wrong table ' })).toEqual({ reason: 'Wrong table' });
    expect(jackpotReversalSchema.safeParse({ reason: 'no' }).success).toBe(false);
  });
});
