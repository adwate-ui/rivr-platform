import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import { describe, expect, it } from 'vitest';
import { blankForm, formFromTerms, templateForm, type BuilderForm } from './builderForm.ts';
import { readForm } from './formTerms.ts';
import { TUESDAY } from './promotionsTestApi.tsx';
import { allOrPicked } from './WhoWhenSections.tsx';

const TODAY = '2026-11-10';
const named = (more: Partial<BuilderForm> = {}): BuilderForm => ({ ...blankForm(TODAY), name: 'Weekend double points', ...more });

describe('the builder read as terms', () => {
  it('reads a blank promotion as the prototype starts one: 2× points, Friday and Saturday 20:00 to 02:00, once a visit', () => {
    const { terms, errors } = readForm(named());
    expect(errors.size).toBe(0);
    expect(terms).toEqual({
      name: 'Weekend double points', reward: { kind: 'points_multiplier', multiplier: 2 },
      eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
      schedule: { days: [5, 6], from: '20:00', to: '02:00', startsOn: TODAY, timezone: 'Asia/Kolkata' },
      limits: { perMember: 'per_visit' }, channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: [],
    });
  });

  it('reads a seat bonus, on a visit\'s first seat or the first at each table, and every blank as no limit', () => {
    const firstSeat = readForm(named({ kind: 'seat_bonus', chips: '1,000', firstN: '', maxMembersPerDay: '50', budgetChips: '50,000', rulesText: ' Members only \n\n', link: ' ' }));
    expect(firstSeat.terms?.reward).toEqual({ kind: 'seat_bonus', chips: 1_000 });
    expect(firstSeat.terms?.limits).toEqual({ perMember: 'per_visit', maxMembersPerDay: 50, budgetChips: 50_000 });
    expect(firstSeat.terms?.rulesText).toEqual(['Members only']);
    expect(firstSeat.terms).not.toHaveProperty('link');
    expect(readForm(named({ kind: 'seat_bonus', chips: '500', firstN: '5' })).terms?.reward).toEqual({ kind: 'seat_bonus', chips: 500, firstNSeatsPerTable: 5 });
  });

  it('opens a promotion that paid on a buy-in as the seat bonus it became (owner, 8 Nov)', () => {
    const opened = (reward: PromotionTerms['reward']) => {
      const form = formFromTerms({ ...TUESDAY, reward });
      return [form.kind, form.chips, form.firstN];
    };
    expect(opened({ kind: 'buyin_bonus', mode: 'fixed', chips: 500, firstNBuyinsPerTable: 5 })).toEqual(['seat_bonus', '500', '5']);
    expect(opened({ kind: 'buyin_bonus', mode: 'percent', percent: 20, capChips: 2_000 })).toEqual(['seat_bonus', '2000', '']);
    expect(opened({ kind: 'buyin_bonus', mode: 'percent', percent: 20 })).toEqual(['seat_bonus', '1000', '']);
    expect(opened({ kind: 'bonus_chips', chips: 750, on: 'first_buyin' })).toEqual(['seat_bonus', '750', '']);
  });

  it('marks each field the terms refuse, and still reads the four parts when only the words are wrong', () => {
    expect([...readForm(named({ multiplier: '2.1' })).errors]).toEqual(['multiplier']);
    expect([...readForm(named({ kind: 'seat_bonus', chips: '1020' })).errors]).toEqual(['chips']);
    expect([...readForm(named({ kind: 'hours_bonus', chips: '', afterHours: '0.2' })).errors].sort()).toEqual(['afterHours', 'chips']);
    expect([...readForm(named({ days: [], from: '25:00' })).errors].sort()).toEqual(['days', 'from']);
    expect([...readForm(named({ endsOn: '2026-11-01' })).errors]).toEqual(['endsOn']);
    expect([...readForm(named({ kind: 'tournament_entry', tournament: ' ' })).errors]).toEqual(['tournament']);
    const unnamed = readForm(named({ name: '', link: 'http://rivr.club' }));
    expect([...unnamed.errors].sort()).toEqual(['link', 'name']);
    expect(unnamed.terms).toBeNull();
    expect(unnamed.core?.reward).toEqual({ kind: 'points_multiplier', multiplier: 2 });
  });

  it('reads up to N times a member, and a budget each month, leaving either out where it means nothing (decision 0499)', () => {
    const limits = readForm(named({ perMember: 'per_day', timesPerMember: '2', budgetChips: '10,000', budgetPeriod: 'month' })).terms?.limits;
    expect(limits).toEqual({ perMember: 'per_day', timesPerMember: 2, budgetChips: 10_000, budgetPeriod: 'month' });
    expect(readForm(named({ perMember: 'none', timesPerMember: '2', budgetPeriod: 'month' })).terms?.limits).toEqual({ perMember: 'none' });
    expect([...readForm(named({ perMember: 'per_day', timesPerMember: '1' })).errors]).toEqual(['timesPerMember']);
    expect([...readForm(named({ perMember: 'per_day', timesPerMember: '21' })).errors]).toEqual(['timesPerMember']);
    const thrice = readForm(named({ perMember: 'once', timesPerMember: '3', budgetChips: '500', budgetPeriod: 'month' })).terms;
    expect(thrice).not.toBeNull();
    if (thrice === null) return;
    const back = formFromTerms(thrice);
    expect([back.timesPerMember, back.budgetPeriod]).toEqual(['3', 'month']);
  });

  it('gives a version’s terms back as the fields that made them', () => {
    const terms: PromotionTerms = {
      name: 'Four-hour bonus', reward: { kind: 'hours_bonus', chips: 1_000, afterMinutes: 270 },
      eligibility: { stakes: ['nlh_100_200'], tableIds: ['t3'], tiers: ['tier-black'], audience: 'lapsed' },
      schedule: { days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', to: '06:00', startsOn: '2026-11-01', endsOn: '2026-12-31', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'per_day', maxGrants: 400 }, channels: { playerApp: true, tv: false, website: true, whatsapp: false },
      rulesText: ['One a day', 'Members only'], link: 'https://rivr.club/hours',
    };
    const form = formFromTerms(terms);
    expect(form).toMatchObject({ kind: 'hours_bonus', chips: '1000', afterHours: '4.5', rulesText: 'One a day\nMembers only', maxGrants: 400 });
    expect(readForm(form).terms).toEqual(terms);
  });

  it('reads a play-time bonus at set times or every so often, and gives each back as its fields (owner, 8 Nov)', () => {
    const hours = (more: Partial<BuilderForm>) => readForm(named({ kind: 'hours_bonus', chips: '500', afterHours: '2', ...more }));
    expect(hours({}).terms?.reward).toEqual({ kind: 'hours_bonus', chips: 500, afterMinutes: 120 });
    const steps = hours({ moreSteps: [{ afterHours: '4', chips: '1,000' }, { afterHours: '6.5', chips: '1500' }] }).terms;
    expect(steps?.reward).toEqual({
      kind: 'hours_bonus', mode: 'steps', steps: [{ afterMinutes: 120, chips: 500 }, { afterMinutes: 240, chips: 1_000 }, { afterMinutes: 390, chips: 1_500 }],
    });
    const every = hours({ hoursMode: 'every', everyHours: '1.5', timesPerVisit: '3' }).terms;
    expect(every?.reward).toEqual({ kind: 'hours_bonus', mode: 'every', everyMinutes: 90, chips: 500, timesPerVisit: 3 });
    expect(hours({ hoursMode: 'every', everyHours: '2', timesPerVisit: '' }).terms?.reward).toEqual({ kind: 'hours_bonus', mode: 'every', everyMinutes: 120, chips: 500 });
    for (const terms of [steps, every]) {
      if (terms === null || terms === undefined) throw new Error('The terms were not read');
      expect(readForm(formFromTerms(terms)).terms).toEqual(terms);
    }
  });

  it('marks a play-time bonus’s steps out of order, and every so often past 12 hours or 20 times', () => {
    const hours = (more: Partial<BuilderForm>) => readForm(named({ kind: 'hours_bonus', chips: '500', afterHours: '4', ...more })).errors;
    expect([...hours({ moreSteps: [{ afterHours: '2', chips: '500' }] })]).toEqual(['steps']);
    expect([...hours({ hoursMode: 'every', everyHours: '13', timesPerVisit: '21' })].sort()).toEqual(['everyHours', 'timesPerVisit']);
  });

  it('prefills a template over a blank promotion, named, for the tier it is for', () => {
    const tuesday = templateForm('seat_bonus', TODAY, { founders: null });
    expect(readForm(tuesday).terms).toMatchObject({
      name: 'Tuesday seat bonus chips', reward: { kind: 'seat_bonus', chips: 1_000, firstNSeatsPerTable: 5 },
      schedule: { days: [2], from: '06:00', to: '06:00' }, limits: { perMember: 'per_day' },
    });
    expect(readForm(templateForm('founders_priority', TODAY, { founders: 'tier-fc' })).terms).toMatchObject({
      reward: { kind: 'waitlist_priority' }, eligibility: { tiers: ['tier-fc'] },
    });
    expect(templateForm('blank', TODAY, { founders: null })).toEqual(blankForm(TODAY));
  });
});

describe('every stake or the ones picked', () => {
  it('picks every one with All, leaves All when one is picked, and goes back to All when none is left', () => {
    expect(allOrPicked(['*', 'nlh_100_200'], 'all')).toEqual(['nlh_100_200']);
    expect(allOrPicked(['nlh_100_200', '*'], ['nlh_100_200'])).toBe('all');
    expect(allOrPicked([], ['nlh_100_200'])).toBe('all');
    expect(allOrPicked([], 'all')).toBe('all');
    expect(allOrPicked(['nlh_100_200', 'plo_200_400'], ['nlh_100_200'])).toEqual(['nlh_100_200', 'plo_200_400']);
  });
});
