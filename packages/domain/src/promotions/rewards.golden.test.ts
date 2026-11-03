import { eligibilitySchema, limitsSchema, memberFactsSchema, promotionEventSchema, rewardSchema, scheduleSchema } from '@rivr/contracts/promotionModel';
import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import rewardsJson from '@rivr/testing/golden/promotionRewards.json';
import { describe, expect, it } from 'vitest';
import { isEligible } from './eligibility.ts';
import { computeGrant, toPromotionEvent, type Grant, type Perk } from './grant.ts';
import { checkLimits, type GrantTally } from './limits.ts';
import { stackGrants } from './stacking.ts';

const golden = readGolden(rewardsJson);

/** One field of a fixture's JSON object, as the database's `->` reads it: missing is undefined. */
function field(record: unknown, key: string): unknown {
  return typeof record === 'object' && record !== null ? Object.entries(record).find(([name]) => name === key)?.[1] : undefined;
}

const numberOf = (value: unknown): number => (typeof value === 'number' ? value : 0);
const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const PERKS: readonly Perk[] = ['cab_home', 'tournament_entry', 'waitlist_priority'];
const perkOf = (value: unknown): Perk | null => PERKS.find((perk) => perk === value) ?? null;

function grantOf(json: unknown): Grant {
  return { points: numberOf(field(json, 'points')), chips: numberOf(field(json, 'chips')), spins: numberOf(field(json, 'spins')), perk: perkOf(field(json, 'perk')) };
}

function tallyOf(text: string): GrantTally {
  const json: unknown = JSON.parse(text);
  const atTable = field(json, 'grantsAtTableToday');
  return {
    chipsGiven: numberOf(field(json, 'chipsGiven')), grantsGiven: numberOf(field(json, 'grantsGiven')), membersToday: numberOf(field(json, 'membersToday')),
    isMemberGrantedToday: field(json, 'isMemberGrantedToday') === true, isPeriodTaken: field(json, 'isPeriodTaken') === true,
    grantsAtTableToday: typeof atTable === 'number' ? atTable : null,
  };
}

const parse = (text: string): unknown => JSON.parse(text);

describe('Promotion rewards golden fixtures (packages/testing/golden/promotionRewards.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['eligible', 'grant', 'limits', 'stack'])).not.toThrow();
  });

  it.each(casesFor(golden, 'eligible'))('%s', (_, goldenCase) => {
    const terms = parse(goldenInput(goldenCase, 'terms'));
    const promo = {
      reward: rewardSchema.parse(field(terms, 'reward')), eligibility: eligibilitySchema.parse(field(terms, 'eligibility')),
      schedule: scheduleSchema.parse(field(terms, 'schedule')),
    };
    const context = parse(goldenInput(goldenCase, 'context'));
    const at = new Date(String(field(context, 'at')));
    const eligible = isEligible(promo, memberFactsSchema.parse(parse(goldenInput(goldenCase, 'member'))), {
      at, stake: textOrNull(field(context, 'stake')), tableId: textOrNull(field(context, 'tableId')),
    });
    expect(eligible ? 'yes' : 'no').toBe(goldenExpected(goldenCase, 'eligible'));
  });

  it.each(casesFor(golden, 'grant'))('%s', (_, goldenCase) => {
    const reward = rewardSchema.parse(parse(goldenInput(goldenCase, 'reward')));
    const result = computeGrant({ reward }, toPromotionEvent(promotionEventSchema.parse(parse(goldenInput(goldenCase, 'event')))));
    if (!result.ok) {
      expect(result.error).toBe(goldenExpected(goldenCase, 'refusal'));
      return;
    }
    const { points, chips, spins, perk } = result.value;
    expect([String(points), String(chips), String(spins), perk ?? '']).toEqual(
      ['points', 'chips', 'spins', 'perk'].map((name) => goldenExpected(goldenCase, name)),
    );
  });

  it.each(casesFor(golden, 'limits'))('%s', (_, goldenCase) => {
    const promo = { reward: rewardSchema.parse(parse(goldenInput(goldenCase, 'reward'))), limits: limitsSchema.parse(parse(goldenInput(goldenCase, 'limits'))) };
    const result = checkLimits(promo, grantOf(parse(goldenInput(goldenCase, 'grant'))), tallyOf(goldenInput(goldenCase, 'tally')));
    expect([result.ok ? 'yes' : 'no', result.ok ? '' : result.error]).toEqual([goldenExpected(goldenCase, 'given'), goldenExpected(goldenCase, 'refusal')]);
  });

  it.each(casesFor(golden, 'stack'))('%s', (_, goldenCase) => {
    const candidates: unknown = parse(goldenInput(goldenCase, 'candidates'));
    if (!Array.isArray(candidates)) throw new Error('Golden candidates are not a list');
    const given = stackGrants(candidates.map((candidate: unknown) => ({ promotionId: String(field(candidate, 'promotion')), grant: grantOf(candidate) })));
    expect(given.length === 0 ? 'none' : given.join(' | ')).toBe(goldenExpected(goldenCase, 'given'));
  });
});
