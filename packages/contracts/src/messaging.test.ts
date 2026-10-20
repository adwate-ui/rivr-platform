import { describe, expect, it } from 'vitest';
import { promotionOfferedSchema, waitlistCalledSchema } from './messaging.ts';

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
      member_id: emitted.member_id, table_name: 'Table 3', seat: 9, hold_until: emitted.hold_until,
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
