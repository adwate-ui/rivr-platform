import type { Reward } from '@rivr/contracts/promotionModel';
import { buildMemberFacts, buildPromotionEvent, buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { NO_GRANT, toPromotionEvent } from './grant.ts';
import { checkLimits, decideGrant, ledgerEntryFor, periodKey, remainingBudget, slotKey, tallyFor, type LedgerEntry } from './limits.ts';

const BONUS = { kind: 'buyin_bonus', mode: 'percent', percent: 20 } as const;
const buyIn = (place: Parameters<typeof buildPromotionEvent>[1] = {}) =>
  toPromotionEvent(buildPromotionEvent({ kind: 'buy_in', ownChips: 10_000, isFirstOfVisit: true }, place));
const entry = (more: Partial<LedgerEntry>): LedgerEntry => ({
  ...NO_GRANT, chips: 1_000, memberId: 'member-2', clubDay: '2026-11-17', periodKey: 'event:old', tableId: 'table-1', ...more,
});
const NOTHING_YET = { chipsGiven: 0, grantsGiven: 0, membersToday: 0, isMemberGrantedToday: false, periodGiven: 0, grantsAtTableToday: 0 };

describe('periodKey for a play-time step (the owner, 9 Nov)', () => {
  const steps: Reward = { kind: 'hours_bonus', mode: 'steps', steps: [{ afterMinutes: 120, chips: 200 }, { afterMinutes: 240, chips: 500 }] };
  const moved: Reward = { kind: 'hours_bonus', mode: 'steps', steps: [{ afterMinutes: 180, chips: 200 }, { afterMinutes: 240, chips: 500 }] };
  const at = new Date('2026-11-17T21:00:00+05:30');
  const step = (stepMinutes: number) => ({ key: `hours_step:visit-1:${String(stepMinutes)}`, at, visitId: 'visit-1', stepMinutes });

  it('keys a step by its place among the steps, so a version that moves its minutes keeps it the same step', () => {
    expect(periodKey({ perMember: 'per_day' }, step(240), steps)).toBe('day:2026-11-17@2');
    expect(periodKey({ perMember: 'per_day' }, step(120), steps)).toBe(periodKey({ perMember: 'per_day' }, step(180), moved));
  });

  it('gives a step with no limit its visit, as a step is paid once a visit', () => {
    expect(periodKey({ perMember: 'none' }, step(120), steps)).toBe('visit:visit-1@1');
    expect(periodKey({ perMember: 'none' }, { ...step(120), visitId: null }, steps)).toBe('visit:hours_step:visit-1:120@1');
  });

  it('keeps the minutes where the reward has no such step, or is no play-time bonus', () => {
    expect(periodKey({ perMember: 'once' }, step(90), steps)).toBe('once@90');
    expect(periodKey({ perMember: 'once' }, step(120))).toBe('once@120');
    expect(periodKey({ perMember: 'once' }, step(120), { kind: 'bonus_chips', on: 'visit', chips: 100 })).toBe('once@120');
  });
});

describe('periodKey', () => {
  const night = buyIn({ at: '2026-11-18T02:00:00+05:30' });

  it('keys each limit by its period on the club day the event falls in', () => {
    expect(periodKey({ perMember: 'none' }, night)).toBe('event:event-1');
    expect(periodKey({ perMember: 'per_visit' }, night)).toBe('visit:visit-1');
    expect(periodKey({ perMember: 'per_day' }, night)).toBe('day:2026-11-17');
    expect(periodKey({ perMember: 'per_week' }, night)).toBe('week:2026-11-16');
    expect(periodKey({ perMember: 'once' }, night)).toBe('once');
  });

  it('keys a visit limit by the event when there is no visit', () => {
    expect(periodKey({ perMember: 'per_visit' }, buyIn({ visitId: null, key: 'signup:7' }))).toBe('visit:signup:7');
  });
});

describe('slotKey', () => {
  it('keys a member\'s first grant in a period by the period, then #2, #3 and on (decision 0499)', () => {
    expect(slotKey('day:2026-11-17', 0)).toBe('day:2026-11-17');
    expect(slotKey('day:2026-11-17', 1)).toBe('day:2026-11-17#2');
    expect(slotKey('once', 19)).toBe('once#20');
  });
});

describe('remainingBudget', () => {
  it('is none with no budget, what is left of one, and never below nothing', () => {
    const terms = buildPromotionTerms();
    expect(remainingBudget(terms, [entry({})], '2026-11-17')).toBeNull();
    expect(remainingBudget({ limits: { perMember: 'none', budgetChips: 5_000 } }, [entry({}), entry({ chips: 1_500 })], '2026-11-17')).toBe(2_500);
    expect(remainingBudget({ limits: { perMember: 'none', budgetChips: 1_000 } }, [entry({ chips: 1_500 })], '2026-11-17')).toBe(0);
  });

  it('counts a monthly budget\'s own month only (decision 0499)', () => {
    const monthly = { limits: { perMember: 'none' as const, budgetChips: 5_000, budgetPeriod: 'month' as const } };
    const ledger = [entry({ clubDay: '2026-10-31', chips: 4_000 }), entry({ clubDay: '2026-11-01', chips: 1_000 })];
    expect(remainingBudget(monthly, ledger, '2026-11-30')).toBe(4_000);
    expect(remainingBudget(monthly, ledger, '2026-10-31')).toBe(1_000);
    expect(remainingBudget({ limits: { ...monthly.limits, budgetPeriod: undefined } }, ledger, '2026-11-30')).toBe(0);
  });
});

describe('tallyFor', () => {
  it('counts the grants, the club day\'s members and the table\'s grants for one more', () => {
    const ledger = [
      entry({}), entry({ memberId: 'member-1', periodKey: 'day:2026-11-17' }), entry({ clubDay: '2026-11-16', tableId: 'table-1' }),
      entry({ memberId: 'member-3', tableId: 'table-2' }),
    ];
    const tally = tallyFor({ limits: { perMember: 'per_day' } }, ledger, buyIn());
    expect(tally).toEqual({ chipsGiven: 4_000, grantsGiven: 4, membersToday: 3, isMemberGrantedToday: true, periodGiven: 1, grantsAtTableToday: 2 });
  });

  it('counts the member\'s numbered grants in the period, not another\'s or another period\'s', () => {
    const ledger = [
      entry({ memberId: 'member-1', periodKey: 'day:2026-11-17' }), entry({ memberId: 'member-1', periodKey: 'day:2026-11-17#2' }),
      entry({ memberId: 'member-2', periodKey: 'day:2026-11-17' }), entry({ memberId: 'member-1', periodKey: 'day:2026-11-16' }),
      entry({ memberId: 'member-1', periodKey: 'day:2026-11-170' }),
    ];
    expect(tallyFor({ limits: { perMember: 'per_day', timesPerMember: 3 } }, ledger, buyIn()).periodGiven).toBe(2);
  });

  it('counts a monthly budget\'s grants and chips in the event\'s club month, which turns at 06:00 IST', () => {
    const limits = { perMember: 'none' as const, budgetChips: 10_000, maxGrants: 10, budgetPeriod: 'month' as const };
    const ledger = [entry({ clubDay: '2026-10-31', chips: 3_000 }), entry({ clubDay: '2026-11-01', chips: 500 }), entry({ clubDay: '2026-11-30', chips: 50 })];
    const lateNovember = tallyFor({ limits }, ledger, buyIn({ at: '2026-12-01T05:59:00+05:30' }));
    expect([lateNovember.chipsGiven, lateNovember.grantsGiven]).toEqual([550, 2]);
    const december = tallyFor({ limits }, ledger, buyIn({ at: '2026-12-01T06:00:00+05:30' }));
    expect([december.chipsGiven, december.grantsGiven]).toEqual([0, 0]);
  });

  it('has no table count away from a table, and nothing taken for a new member', () => {
    const tally = tallyFor({ limits: { perMember: 'once' } }, [entry({ periodKey: 'once' })], buyIn({ tableId: null }));
    expect(tally.grantsAtTableToday).toBeNull();
    expect(tally.periodGiven).toBe(0);
    expect(tally.isMemberGrantedToday).toBe(false);
  });
});

describe('ledgerEntryFor', () => {
  it('records the grant with the member, club day, period key and table', () => {
    const grant = { ...NO_GRANT, chips: 2_000 };
    expect(ledgerEntryFor({ limits: { perMember: 'per_visit' } }, buyIn(), grant, { periodGiven: 0 })).toEqual({
      ...grant, memberId: 'member-1', clubDay: '2026-11-17', periodKey: 'visit:visit-1', tableId: 'table-1',
    });
  });

  it('keys a second grant in the period as the member\'s second', () => {
    expect(ledgerEntryFor({ limits: { perMember: 'per_day', timesPerMember: 2 } }, buyIn(), NO_GRANT, { periodGiven: 1 }).periodKey).toBe('day:2026-11-17#2');
  });
});

describe('checkLimits', () => {
  it('gives a whole grant up to the last chip of the budget', () => {
    const promo = { reward: BONUS, limits: { perMember: 'none' as const, budgetChips: 2_000 } };
    expect(checkLimits(promo, { ...NO_GRANT, chips: 2_000 }, NOTHING_YET).ok).toBe(true);
    expect(checkLimits(promo, { ...NO_GRANT, chips: 2_050 }, NOTHING_YET)).toEqual({ ok: false, error: 'budget_exhausted' });
  });

  it('names the first limit broken', () => {
    const promo = { reward: { ...BONUS, firstNBuyinsPerTable: 1 }, limits: { perMember: 'once' as const, maxGrants: 1 } };
    expect(checkLimits(promo, NO_GRANT, { ...NOTHING_YET, periodGiven: 1, grantsAtTableToday: 1, grantsGiven: 1 })).toEqual({ ok: false, error: 'already_given' });
    expect(checkLimits(promo, NO_GRANT, { ...NOTHING_YET, grantsAtTableToday: 1, grantsGiven: 1 })).toEqual({ ok: false, error: 'first_n_taken' });
    expect(checkLimits(promo, NO_GRANT, { ...NOTHING_YET, grantsGiven: 1 })).toEqual({ ok: false, error: 'max_grants' });
  });

  it('lets a member have it up to N times in a period, and no more (decision 0499)', () => {
    const twiceADay = { reward: BONUS, limits: { perMember: 'per_day' as const, timesPerMember: 2 } };
    expect(checkLimits(twiceADay, NO_GRANT, { ...NOTHING_YET, periodGiven: 1 }).ok).toBe(true);
    expect(checkLimits(twiceADay, NO_GRANT, { ...NOTHING_YET, periodGiven: 2 })).toEqual({ ok: false, error: 'already_given' });
  });
});

describe('decideGrant', () => {
  const tuesday = buildPromotionTerms({ reward: BONUS, schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' } });

  it('gives what the reward gives when the member qualifies and the limits allow', () => {
    expect(decideGrant(tuesday, buildMemberFacts(), buyIn(), NOTHING_YET)).toEqual({ ok: true, value: { ...NO_GRANT, chips: 2_000 } });
  });

  it('refuses a member who does not qualify, a reward of nothing and a limit reached', () => {
    expect(decideGrant(tuesday, buildMemberFacts(), buyIn({ at: '2026-11-18T21:00:00+05:30' }), NOTHING_YET)).toEqual({ ok: false, error: 'not_eligible' });
    const fromBonus = toPromotionEvent(buildPromotionEvent({ kind: 'buy_in', ownChips: 0, isFirstOfVisit: true }));
    expect(decideGrant(tuesday, buildMemberFacts(), fromBonus, NOTHING_YET)).toEqual({ ok: false, error: 'nothing_earned' });
    expect(decideGrant(tuesday, buildMemberFacts(), buyIn(), { ...NOTHING_YET, periodGiven: 1 })).toEqual({ ok: false, error: 'already_given' });
  });
});
