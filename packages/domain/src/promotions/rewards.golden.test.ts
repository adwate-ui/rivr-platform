import { eligibilitySchema, limitsSchema, memberFactsSchema, promotionEventSchema, rewardSchema, scheduleSchema } from '@rivr/contracts/promotionModel';
import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import rewardsJson from '@rivr/testing/golden/promotionRewards.json';
import { describe, expect, it } from 'vitest';
import { isEligible } from './eligibility.ts';
import { computeGrant, toPromotionEvent, type Grant, type Perk } from './grant.ts';
import { stepsReached } from './hourSteps.ts';
import { checkLimits, periodKey, slotKey, tallyFor, type GrantTally, type LedgerEntry } from './limits.ts';
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
    isMemberGrantedToday: field(json, 'isMemberGrantedToday') === true, periodGiven: numberOf(field(json, 'periodGiven')),
    grantsAtTableToday: typeof atTable === 'number' ? atTable : null,
  };
}

const parse = (text: string): unknown => JSON.parse(text);

/** A ledger entry as the fixture writes it. */
function entryOf(json: unknown): LedgerEntry {
  return {
    ...grantOf(json), memberId: String(field(json, 'memberId')), clubDay: String(field(json, 'clubDay')), periodKey: String(field(json, 'periodKey')),
    tableId: textOrNull(field(json, 'tableId')),
  };
}

/** The fixture's event as the tally reads it: who, when, which event, visit and table; the kind does not count. */
function tallyEvent(text: string) {
  const json = parse(text);
  return toPromotionEvent(promotionEventSchema.parse({
    kind: 'referral', stake: null, key: field(json, 'key'), at: field(json, 'at'), memberId: field(json, 'memberId'),
    visitId: field(json, 'visitId'), tableId: field(json, 'tableId'),
  }));
}

describe('Promotion rewards golden fixtures (packages/testing/golden/promotionRewards.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['eligible', 'grant', 'limits', 'stack', 'tally', 'periodKey', 'steps'])).not.toThrow();
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

  it.each(casesFor(golden, 'tally'))('%s', (_, goldenCase) => {
    const ledger = parse(goldenInput(goldenCase, 'ledger'));
    if (!Array.isArray(ledger)) throw new Error('Golden ledger is not a list');
    const tally = tallyFor({ limits: limitsSchema.parse(parse(goldenInput(goldenCase, 'limits'))) }, ledger.map(entryOf), tallyEvent(goldenInput(goldenCase, 'event')));
    expect([tally.chipsGiven, tally.grantsGiven, tally.membersToday, tally.isMemberGrantedToday, tally.periodGiven, tally.grantsAtTableToday ?? ''].map(String))
      .toEqual(['chipsGiven', 'grantsGiven', 'membersToday', 'isMemberGrantedToday', 'periodGiven', 'grantsAtTableToday'].map((name) => goldenExpected(goldenCase, name)));
  });

  it.each(casesFor(golden, 'periodKey'))('%s', (_, goldenCase) => {
    const event = parse(goldenInput(goldenCase, 'event'));
    const step = field(event, 'stepMinutes');
    const when = {
      key: String(field(event, 'key')), at: new Date(String(field(event, 'at'))), visitId: textOrNull(field(event, 'visitId')),
      ...(typeof step === 'number' ? { stepMinutes: step } : {}),
    };
    const base = periodKey(limitsSchema.parse(parse(goldenInput(goldenCase, 'limits'))), when);
    expect(slotKey(base, Number(goldenInput(goldenCase, 'given')))).toBe(goldenExpected(goldenCase, 'key'));
  });

  it.each(casesFor(golden, 'steps'))('%s', (_, goldenCase) => {
    const reward = rewardSchema.parse(parse(goldenInput(goldenCase, 'reward')));
    if (reward.kind !== 'hours_bonus') throw new Error('Golden steps need a play-time bonus');
    expect(stepsReached(reward, Number(goldenInput(goldenCase, 'minutes'))).join(',')).toBe(goldenExpected(goldenCase, 'steps'));
  });

  it.each(casesFor(golden, 'stack'))('%s', (_, goldenCase) => {
    const candidates: unknown = parse(goldenInput(goldenCase, 'candidates'));
    if (!Array.isArray(candidates)) throw new Error('Golden candidates are not a list');
    const given = stackGrants(candidates.map((candidate: unknown) => ({ promotionId: String(field(candidate, 'promotion')), grant: grantOf(candidate) })));
    expect(given.length === 0 ? 'none' : given.join(' | ')).toBe(goldenExpected(goldenCase, 'given'));
  });
});
