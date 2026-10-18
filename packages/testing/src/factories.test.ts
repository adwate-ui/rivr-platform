import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { buildMember, buildTable, buildVenue, buildWaitlistEntry } from './factories.ts';
import { designPromptSeed } from './seed/index.ts';

describe('factories', () => {
  it('builds a 100/200 table in the seed venue unless told otherwise', () => {
    const table = buildTable();

    expect(table).toMatchObject({ venueId: designPromptSeed.venue.id, buyIn: 1_000_000n, rakeCap: 600_000n, isOpen: true });
    expect(table.stakes).toEqual({ smallBlind: 10_000n, bigBlind: 20_000n });
  });

  it('takes only the fields a test is about', () => {
    expect(buildTable({ seated: 9 }).seated).toBe(9);
    expect(buildMember({ tier: 'black_card' }).tier).toBe('black_card');
  });

  it('gives every built record its own id, and every member their own phone', () => {
    const [first, second] = [buildMember(), buildMember()];

    expect(first.id).not.toBe(second.id);
    expect(first.phone).not.toBe(second.phone);
    expect(indianMobileSchema.safeParse(first.phone).success).toBe(true);
    expect(buildTable().id).not.toBe(buildTable().id);
  });

  it('builds a venue that is real unless the test says practice', () => {
    expect(buildVenue().isPractice).toBe(false);
    expect(buildVenue({ isPractice: true }).isPractice).toBe(true);
  });

  it('builds a waitlist entry on 100/200 at the seed clock', () => {
    const entry = buildWaitlistEntry();

    expect(entry.joinedAt).toEqual(designPromptSeed.clock);
    expect(entry.stakes).toEqual(designPromptSeed.tables.table2.stakes);
  });
});
