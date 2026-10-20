import { promotionConditionsSchema, promotionEffectSchema } from '@rivr/contracts/promotions';
import { assertOperations, casesFor, goldenExpected, goldenInput, readGolden } from '@rivr/testing';
import promotionsJson from '@rivr/testing/golden/promotions.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { promotionApplies, promotionReward, promotionsToGive, type PromotionCandidate, type PromotionFacts } from './promotions.ts';

const golden = readGolden(promotionsJson);

/** Reads a fixture amount such as "₹10,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** One field of a fixture's JSON object, as the database's `->` reads it: missing is undefined. */
function field(record: unknown, key: string): unknown {
  return typeof record === 'object' && record !== null ? Object.entries(record).find(([name]) => name === key)?.[1] : undefined;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const countOr = (value: unknown, otherwise: number): number => (typeof value === 'number' ? value : otherwise);

/** Reads fixture facts; a fact left out is unknown (null), none (0) or no, as the database reads a missing key. */
function facts(text: string): PromotionFacts {
  const json: unknown = JSON.parse(text);
  const days = field(json, 'days_since_last_visit');
  return {
    at: new Date(String(field(json, 'at'))),
    tierId: textOrNull(field(json, 'tier_id')),
    stake: textOrNull(field(json, 'stake')),
    tableId: textOrNull(field(json, 'table_id')),
    visitsInMonth: countOr(field(json, 'visits_in_month'), 0),
    daysSinceLastVisit: typeof days === 'number' ? days : null,
    isCallTimeComplete: field(json, 'call_time_complete') === true,
    grantedToday: countOr(field(json, 'granted_today'), 0),
    grantedTodayAtTable: countOr(field(json, 'granted_today_at_table'), 0),
    hoursPlayed: countOr(field(json, 'hours_played'), 0),
    hand: textOrNull(field(json, 'hand')),
  };
}

const limitOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** Reads fixture candidates; a limit left out is no limit. */
function candidates(text: string): PromotionCandidate[] {
  const json: unknown = JSON.parse(text);
  if (!Array.isArray(json)) throw new Error(`Golden candidates "${text}" are not a list`);
  return json.map((candidate: unknown) => {
    const budget = limitOrNull(field(candidate, 'budget_left_paise'));
    return {
      promotion: String(field(candidate, 'promotion')),
      stacks: field(candidate, 'stacks') === true,
      cost: fromPaise(BigInt(countOr(field(candidate, 'cost_paise'), 0))),
      budgetLeft: budget === null ? null : fromPaise(BigInt(budget)),
      grantsLeft: limitOrNull(field(candidate, 'grants_left')),
      playerLeft: limitOrNull(field(candidate, 'player_left')),
      isGiven: field(candidate, 'is_given') === true,
    };
  });
}

describe('Promotions golden fixtures (packages/testing/golden/promotions.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['applies', 'reward', 'select'])).not.toThrow();
  });

  it.each(casesFor(golden, 'applies'))('%s', (_description, goldenCase) => {
    const conditions = promotionConditionsSchema.parse(JSON.parse(goldenInput(goldenCase, 'conditions')));
    expect(promotionApplies(conditions, facts(goldenInput(goldenCase, 'facts'))) ? 'yes' : 'no').toBe(goldenExpected(goldenCase, 'applies'));
  });

  it.each(casesFor(golden, 'reward'))('%s', (_description, goldenCase) => {
    const effect = promotionEffectSchema.parse(JSON.parse(goldenInput(goldenCase, 'effect')));
    const reward = promotionReward(effect, { amount: amount(goldenInput(goldenCase, 'amount')), points: BigInt(goldenInput(goldenCase, 'points')) });
    const expected = goldenExpected(goldenCase, 'reward');
    if (expected === 'nothing') expect(reward).toBeNull();
    else if (expected.endsWith(' points')) expect(reward).toEqual({ cost: fromPaise(0n), points: BigInt(expected.replace(' points', '')) });
    else expect(reward).toEqual({ cost: amount(expected), points: 0n });
  });

  it.each(casesFor(golden, 'select'))('%s', (_description, goldenCase) => {
    const given = promotionsToGive(candidates(goldenInput(goldenCase, 'candidates')));
    expect(given.length === 0 ? 'none' : given.join(' | ')).toBe(goldenExpected(goldenCase, 'given'));
  });
});
