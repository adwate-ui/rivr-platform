import { describe, expect, it } from 'vitest';
import { newClubEventSchema } from './clubEvents.ts';
import { newCreatorSchema } from './creators.ts';

describe('a new event and a new creator, as the console takes them', () => {
  it('takes an event with its seats as a number, and refuses one with none', () => {
    const event = { kind: 'pro_night', title: ' Pro night ', day: '2026-11-20', time: '21:00', seats: '8', details: '' };
    expect(newClubEventSchema.parse(event)).toEqual({ ...event, title: 'Pro night', seats: 8 });
    expect(newClubEventSchema.safeParse({ ...event, seats: '0' }).success).toBe(false);
    expect(newClubEventSchema.safeParse({ ...event, kind: 'party' }).success).toBe(false);
  });

  it('takes a creator whose code fits in a link, and a commission in whole rupees', () => {
    const creator = { name: 'Zoya Khan', code: 'ZOYA', basis: 'first_buy_in', commission: '500' };
    expect(newCreatorSchema.parse(creator)).toEqual(creator);
    expect(newCreatorSchema.safeParse({ ...creator, code: 'with space' }).success).toBe(false);
    expect(newCreatorSchema.safeParse({ ...creator, commission: '12.50' }).success).toBe(false);
  });
});
