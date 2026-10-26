import { describe, expect, it } from 'vitest';
import { blindLevelsSchema } from './blindLevels.ts';
import {
  blindStructureSchema, cageBuySchema, dealSchema, istMoment, newTournamentSchema, payoutSharesSchema, stageFormSchema, structurePlanSchema, tournamentRoomSchema,
  tournamentTemplateSchema,
} from './tournaments.ts';

const TEMPLATE = {
  name: 'RIVR Sunday', format: 're_entry', buyIn: '10000', fee: '1000', startingStack: '30000', structureId: '00000000-0000-4000-8000-0000000007b1',
  lastRegistrationLevel: '9', maxBuys: '', addOn: '', addOnFee: '', addOnChips: '', placesPaid: '8', guarantee: '500000',
  bounty: '', bountyKind: 'none',
} as const;

const issuesOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`) ?? [];

describe('blindLevelsSchema', () => {
  it('reads the database’s levels and breaks into the domain’s shape', () => {
    expect(blindLevelsSchema.parse([{ kind: 'level', small_blind: 400, big_blind: 800, ante: 800, minutes: 20 }, { kind: 'break', minutes: 10 }]))
      .toEqual([{ kind: 'level', smallBlind: 400, bigBlind: 800, ante: 800, minutes: 20 }, { kind: 'break', minutes: 10 }]);
    expect(blindLevelsSchema.safeParse([{ kind: 'pause', minutes: 10 }]).success).toBe(false);
  });
});

describe('stageFormSchema', () => {
  it('reads a typed level and a break', () => {
    expect(stageFormSchema.parse({ kind: 'level', smallBlind: '400', bigBlind: '800', ante: '0', minutes: '20' }))
      .toEqual({ kind: 'level', smallBlind: 400, bigBlind: 800, ante: 0, minutes: 20 });
    expect(stageFormSchema.parse({ kind: 'break', smallBlind: '', bigBlind: '', ante: '', minutes: '10' })).toEqual({ kind: 'break', minutes: 10 });
  });

  it('names each wrong figure, and a small blind above the big', () => {
    expect(issuesOf(stageFormSchema.safeParse({ kind: 'level', smallBlind: '0', bigBlind: 'x', ante: '-1', minutes: '20' })))
      .toEqual(['smallBlind:invalid', 'bigBlind:invalid', 'ante:invalid']);
    expect(issuesOf(stageFormSchema.safeParse({ kind: 'level', smallBlind: '900', bigBlind: '800', ante: '0', minutes: '20' }))).toEqual(['smallBlind:above_big_blind']);
    expect(stageFormSchema.safeParse({ kind: 'break', smallBlind: '', bigBlind: '', ante: '', minutes: '121' }).success).toBe(false);
  });

  it('takes a structure of one to sixty stages', () => {
    const level = { kind: 'level', smallBlind: '50', bigBlind: '100', ante: '0', minutes: '20' } as const;
    expect(blindStructureSchema.safeParse({ name: 'Deep', stages: [] }).success).toBe(false);
    expect(blindStructureSchema.safeParse({ name: 'Deep', stages: [level] }).success).toBe(true);
  });
});

describe('structurePlanSchema', () => {
  it('reads the target length in hours as minutes', () => {
    const plan = { startingStack: '30000', expectedEntries: '60', firstBigBlind: '200', levelMinutes: '20', breakEvery: '4', breakMinutes: '10', hasAnte: true };
    expect(structurePlanSchema.parse({ ...plan, targetHours: '7.5' }).targetHours).toBe(450);
    expect(structurePlanSchema.safeParse({ ...plan, targetHours: '7.55' }).success).toBe(false);
    expect(structurePlanSchema.safeParse({ ...plan, firstBigBlind: '50', targetHours: '8' }).success).toBe(false);
  });
});

describe('tournamentTemplateSchema', () => {
  it('takes RIVR Sunday', () => {
    expect(tournamentTemplateSchema.safeParse(TEMPLATE).success).toBe(true);
  });

  it('keeps the fee below the buy-in, a freezeout to one buy, and an add-on whole', () => {
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, fee: '10000' }))).toEqual(['fee:not_below_buy_in']);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, format: 'freezeout', maxBuys: '2' }))).toEqual(['maxBuys:freezeout']);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, addOn: '2000' }))).toEqual(['addOn:add_on_incomplete']);
    expect(tournamentTemplateSchema.safeParse({ ...TEMPLATE, format: 'rebuy', maxBuys: '4', addOn: '2000', addOnFee: '0', addOnChips: '15000' }).success).toBe(true);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, addOn: '2000', addOnFee: '2000', addOnChips: '15000' }))).toEqual(['addOnFee:not_below_add_on']);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, lastRegistrationLevel: '0', addOn: '2000', addOnFee: '0', addOnChips: '15000' })))
      .toEqual(['addOn:add_on_at_start']);
  });

  it('takes amounts only in ₹50 chips', () => {
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, buyIn: '10025' }))).toEqual(['buyIn:not_chips']);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, guarantee: '500010' }))).toEqual(['buyIn:not_chips']);
  });

  it('takes a bounty with its kind, below what the pool would get, never in a rebuy', () => {
    expect(tournamentTemplateSchema.safeParse({ ...TEMPLATE, bounty: '2000', bountyKind: 'progressive' }).success).toBe(true);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, bounty: '2000' }))).toEqual(['bounty:bounty_incomplete']);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, bounty: '9000', bountyKind: 'standard' }))).toEqual(['bounty:bounty_above_pool']);
    expect(issuesOf(tournamentTemplateSchema.safeParse({ ...TEMPLATE, format: 'rebuy', bounty: '2000', bountyKind: 'standard' })))
      .toEqual(['bounty:bounty_rebuy']);
  });
});

describe('payoutSharesSchema', () => {
  const shares = (...typed: string[]) => ({ shares: typed.map((percent) => ({ percent })) });

  it('reads each place’s percent as basis points, adding up to 100%', () => {
    expect(payoutSharesSchema.parse(shares('62.5', '37.5'))).toEqual([6250, 3750]);
    expect(payoutSharesSchema.parse(shares('100'))).toEqual([10_000]);
  });

  it('refuses shares that do not add up to 100%, a share of nothing, and none at all', () => {
    expect(issuesOf(payoutSharesSchema.safeParse(shares('50', '30', '19')))).toEqual([':not_whole']);
    expect(issuesOf(payoutSharesSchema.safeParse(shares('100', '0')))).toEqual([':not_whole']);
    expect(issuesOf(payoutSharesSchema.safeParse(shares('40', '60')))).toEqual([':not_whole']);
    expect(payoutSharesSchema.safeParse(shares('33.333', '66.667')).success).toBe(false);
    expect(payoutSharesSchema.safeParse(shares()).success).toBe(false);
  });
});

describe('dealSchema', () => {
  it('takes two to nine players, each with whole chips', () => {
    const stack = (chips: string) => ({ entryId: '00000000-0000-4000-8000-000000000213', chips });
    expect(dealSchema.parse({ method: 'icm', stacks: [stack('40000'), stack('20000')] }).stacks.map((each) => each.chips)).toEqual([40000n, 20000n]);
    expect(dealSchema.safeParse({ method: 'icm', stacks: [stack('40000')] }).success).toBe(false);
    expect(dealSchema.safeParse({ method: 'chip_chop', stacks: [stack('0'), stack('100')] }).success).toBe(false);
  });
});

describe('a new tournament’s start', () => {
  it('reads an IST day and 24-hour time as the moment it is', () => {
    expect(istMoment('2026-11-15', '16:00').toISOString()).toBe('2026-11-15T10:30:00.000Z');
    const order = { templateId: '00000000-0000-4000-8000-0000000007c1', name: 'RIVR Sunday', day: '2026-11-15', time: '24:00', isPublished: true };
    expect(newTournamentSchema.safeParse(order).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...order, time: '16:00' }).success).toBe(true);
  });
});

describe('the floor’s forms', () => {
  it('takes a room of 1 to 30 tables of 2 to 10 seats', () => {
    expect(tournamentRoomSchema.parse({ tables: '4', seatsPerTable: '9' })).toEqual({ tables: 4, seatsPerTable: 9 });
    expect(tournamentRoomSchema.safeParse({ tables: '31', seatsPerTable: '9' }).success).toBe(false);
    expect(tournamentRoomSchema.safeParse({ tables: '4', seatsPerTable: '1' }).success).toBe(false);
  });

  it('takes a cash buy for a chosen member', () => {
    expect(cageBuySchema.safeParse({ memberId: '00000000-0000-4000-8000-000000000213', purchase: 'add_on' }).success).toBe(true);
    expect(cageBuySchema.safeParse({ memberId: '', purchase: 'entry' }).success).toBe(false);
  });
});
