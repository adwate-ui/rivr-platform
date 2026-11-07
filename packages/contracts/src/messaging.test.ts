import { describe, expect, it } from 'vitest';
import {
  bonusCreditedSchema, bonusRedeemedSchema, callTimeEndingSchema, callTimeUpdatedSchema, promotionOfferedSchema, waitlistCalledSchema,
} from './messaging.ts';

describe('the bonus chip events (decision 0504)', () => {
  const member = '00000000-0000-4000-8000-000000000211';
  const other = '00000000-0000-4000-8000-0000000005e1';
  it('reads bonus.credited: the chips in paise and why', () => {
    const credited = { member_id: member, bonus_grant_id: other, amount_paise: 50_000, reason: 'Welcome bonus' };
    expect(bonusCreditedSchema.parse(credited)).toEqual(credited);
    expect(bonusCreditedSchema.safeParse({ ...credited, amount_paise: 0 }).success).toBe(false);
  });

  it('reads bonus.redeemed in whole ₹50 chips, at a table', () => {
    const redeemed = { member_id: member, bonus_redemption_id: other, amount_paise: 100_000, table_id: other, table_name: 'Table 3' };
    expect(bonusRedeemedSchema.parse(redeemed)).toEqual(redeemed);
    expect(bonusRedeemedSchema.safeParse({ ...redeemed, amount_paise: 2_500 }).success).toBe(false);
  });
});

describe('waitlistCalledSchema', () => {
  // As private.put_call builds it (#63): Postgres writes the hold with microseconds and the session's offset.
  const emitted = {
    entry_id: '7a1c4f0e-2b8d-4e9a-9c3f-5d6e7f8a9b0c',
    member_id: '00000000-0000-4000-8000-000000000202',
    table_name: 'Table 3',
    seat: 9,
    hold_until: '2026-10-19T21:45:12.123456+05:30',
  };

  it('reads the payload the database emits, and drops what the message does not use', () => {
    expect(waitlistCalledSchema.parse(emitted)).toEqual({
      entry_id: emitted.entry_id, member_id: emitted.member_id, table_name: 'Table 3', seat: 9, hold_until: emitted.hold_until,
    });
  });

  it('refuses a seat the tables do not have', () => {
    expect(waitlistCalledSchema.safeParse({ ...emitted, seat: 11 }).success).toBe(false);
  });
});

describe('promotionOfferedSchema (#86)', () => {
  it('reads an offer as the database emits it, a card with or without its detail', () => {
    const offer = { promotion_id: '00000000-0000-4000-8000-000000000a01', member_id: '00000000-0000-4000-8000-000000000212', title: 'Double points', detail: null, runs: 'Every day' };
    expect(promotionOfferedSchema.safeParse(offer).success).toBe(true);
    expect(promotionOfferedSchema.safeParse({ ...offer, title: ' ' }).success).toBe(false);
    expect(promotionOfferedSchema.safeParse({ ...offer, member_id: 'not-a-member' }).success).toBe(false);
  });
});

describe('the call time\u2019s events (decision 0320)', () => {
  // As private.sweep_seated_time and private.decide_call_time_request build them.
  const session = { member_id: '00000000-0000-4000-8000-000000000211', session_id: '00000000-0000-4000-8000-0000000005e1' };

  it('reads call_time.ending with its table, seat and end', () => {
    const ending = { ...session, table_name: 'Table 5', seat: 2, ends_at: '2026-11-15T23:18:04.123456+05:30' };
    expect(callTimeEndingSchema.parse(ending)).toEqual(ending);
    expect(callTimeEndingSchema.safeParse({ ...ending, ends_at: null }).success).toBe(false);
  });

  it('reads call_time.updated, at most a day', () => {
    expect(callTimeUpdatedSchema.parse({ ...session, minutes: 240 })).toEqual({ ...session, minutes: 240 });
    expect(callTimeUpdatedSchema.safeParse({ ...session, minutes: 1441 }).success).toBe(false);
  });
});
