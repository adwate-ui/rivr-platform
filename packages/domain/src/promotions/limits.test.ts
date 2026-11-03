import { buildMemberFacts, buildPromotionEvent, buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { NO_GRANT, toPromotionEvent } from './grant.ts';
import { checkLimits, decideGrant, ledgerEntryFor, periodKey, remainingBudget, tallyFor, type LedgerEntry } from './limits.ts';

const BONUS = { kind: 'buyin_bonus', mode: 'percent', percent: 20 } as const;
const buyIn = (place: Parameters<typeof buildPromotionEvent>[1] = {}) =>
  toPromotionEvent(buildPromotionEvent({ kind: 'buy_in', ownChips: 10_000, isFirstOfVisit: true }, place));
const entry = (more: Partial<LedgerEntry>): LedgerEntry => ({
  ...NO_GRANT, chips: 1_000, memberId: 'member-2', clubDay: '2026-11-17', periodKey: 'event:old', tableId: 'table-1', ...more,
});
const NOTHING_YET = { chipsGiven: 0, grantsGiven: 0, membersToday: 0, isMemberGrantedToday: false, isPeriodTaken: false, grantsAtTableToday: 0 };

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

describe('remainingBudget', () => {
  it('is none with no budget, what is left of one, and never below nothing', () => {
    const terms = buildPromotionTerms();
    expect(remainingBudget(terms, [entry({})])).toBeNull();
    expect(remainingBudget({ limits: { perMember: 'none', budgetChips: 5_000 } }, [entry({}), entry({ chips: 1_500 })])).toBe(2_500);
    expect(remainingBudget({ limits: { perMember: 'none', budgetChips: 1_000 } }, [entry({ chips: 1_500 })])).toBe(0);
  });
});

describe('tallyFor', () => {
  it('counts the grants, the club day\'s members and the table\'s grants for one more', () => {
    const ledger = [
      entry({}), entry({ memberId: 'member-1', periodKey: 'day:2026-11-17' }), entry({ clubDay: '2026-11-16', tableId: 'table-1' }),
      entry({ memberId: 'member-3', tableId: 'table-2' }),
    ];
    const tally = tallyFor({ limits: { perMember: 'per_day' } }, ledger, buyIn());
    expect(tally).toEqual({ chipsGiven: 4_000, grantsGiven: 4, membersToday: 3, isMemberGrantedToday: true, isPeriodTaken: true, grantsAtTableToday: 2 });
  });

  it('has no table count away from a table, and nothing taken for a new member', () => {
    const tally = tallyFor({ limits: { perMember: 'once' } }, [entry({ periodKey: 'once' })], buyIn({ tableId: null }));
    expect(tally.grantsAtTableToday).toBeNull();
    expect(tally.isPeriodTaken).toBe(false);
    expect(tally.isMemberGrantedToday).toBe(false);
  });
});

describe('ledgerEntryFor', () => {
  it('records the grant with the member, club day, period key and table', () => {
    const grant = { ...NO_GRANT, chips: 2_000 };
    expect(ledgerEntryFor({ limits: { perMember: 'per_visit' } }, buyIn(), grant)).toEqual({
      ...grant, memberId: 'member-1', clubDay: '2026-11-17', periodKey: 'visit:visit-1', tableId: 'table-1',
    });
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
    expect(checkLimits(promo, NO_GRANT, { ...NOTHING_YET, isPeriodTaken: true, grantsAtTableToday: 1, grantsGiven: 1 })).toEqual({ ok: false, error: 'already_given' });
    expect(checkLimits(promo, NO_GRANT, { ...NOTHING_YET, grantsAtTableToday: 1, grantsGiven: 1 })).toEqual({ ok: false, error: 'first_n_taken' });
    expect(checkLimits(promo, NO_GRANT, { ...NOTHING_YET, grantsGiven: 1 })).toEqual({ ok: false, error: 'max_grants' });
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
    expect(decideGrant(tuesday, buildMemberFacts(), buyIn(), { ...NOTHING_YET, isPeriodTaken: true })).toEqual({ ok: false, error: 'already_given' });
  });
});
