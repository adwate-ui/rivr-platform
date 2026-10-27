import { promotionBuilderSchema } from '@rivr/contracts/promotions';
import { assertOperations, casesFor, goldenInput, readGolden, type GoldenCase } from '@rivr/testing';
import simulationJson from '@rivr/testing/golden/promotionSimulation.json';
import { describe, expect, it } from 'vitest';
import { fromPaise, type Paise } from '../money/index.ts';
import { parseRupees } from '../money/parse-rupees.ts';
import { promotionDraft } from './builder.ts';
import { NO_BUDGET, simulatePromotion, type ReplayEvent, type SimulationBudget } from './simulate.ts';

const golden = readGolden(simulationJson);

/** Reads a fixture amount such as "₹10,000"; "₹0" is nothing. The fixture is wrong if it does not parse. */
function amount(text: string): Paise {
  if (text === '₹0') return fromPaise(0n);
  const parsed = parseRupees(text);
  if (!parsed.ok) throw new Error(`Golden amount "${text}" does not parse: ${parsed.error}`);
  return parsed.value;
}

/** One field of a fixture's JSON object: missing is undefined. */
function field(record: unknown, key: string): unknown {
  return typeof record === 'object' && record !== null ? Object.entries(record).find(([name]) => name === key)?.[1] : undefined;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const numberOr = (value: unknown, otherwise: number): number => (typeof value === 'number' ? value : otherwise);

/** Reads fixture events; one with "times": N is N such events by members m1 to mN. */
function events(text: string): ReplayEvent[] {
  const json: unknown = JSON.parse(text);
  if (!Array.isArray(json)) throw new Error(`Golden events "${text}" are not a list`);
  return json.flatMap((event: unknown) => {
    const one = {
      at: new Date(String(field(event, 'at'))),
      memberId: String(field(event, 'member')),
      tierId: null,
      tableId: textOrNull(field(event, 'table')),
      stake: textOrNull(field(event, 'stake')),
      amount: amount(textOrNull(field(event, 'amount')) ?? '₹0'),
      points: BigInt(numberOr(field(event, 'points'), 0)),
      hoursPlayed: numberOr(field(event, 'hours_played'), 0),
    };
    const times = numberOr(field(event, 'times'), 0);
    return times === 0 ? [one] : Array.from({ length: times }, (_unused, index) => ({ ...one, memberId: `m${index + 1}` }));
  });
}

/** Reads a fixture budget: "none", or a rupee cap and a count of grants. */
function budget(text: string): SimulationBudget {
  if (text === 'none') return NO_BUDGET;
  const json: unknown = JSON.parse(text);
  const cap = textOrNull(field(json, 'cap'));
  const count = field(json, 'count');
  return { cap: cap === null ? null : amount(cap), count: typeof count === 'number' ? count : null };
}

/** Writes paise as the fixtures do: "₹8,200". */
function rupees(value: Paise): string {
  return `₹${(value / 100n).toLocaleString('en-IN')}`;
}

function simulate(goldenCase: GoldenCase) {
  const choices = promotionBuilderSchema.parse(JSON.parse(goldenInput(goldenCase, 'choices')));
  const result = simulatePromotion(promotionDraft(choices), events(goldenInput(goldenCase, 'events')), budget(goldenInput(goldenCase, 'budget')));
  if (!result.ok) throw new Error(`Golden case "${goldenCase.description}" was not replayable`);
  return result.value;
}

describe('Promotion simulation golden fixtures (packages/testing/golden/promotionSimulation.json)', () => {
  it('tests every operation in the file', () => {
    expect(() => assertOperations(golden, ['simulate'])).not.toThrow();
  });

  it.each(casesFor(golden, 'simulate'))('%s', (_description, goldenCase) => {
    const simulation = simulate(goldenCase);
    expect({
      grants: String(simulation.grants),
      members: String(simulation.members),
      cost: rupees(simulation.cost),
      points: String(simulation.points),
      budget_left: simulation.budgetLeft === null ? 'no cap' : rupees(simulation.budgetLeft),
      budget_reached: simulation.isBudgetReached ? 'yes' : 'no',
    }).toEqual(goldenCase.expected);
  });
});
