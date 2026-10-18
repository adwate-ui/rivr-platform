/**
 * Rules and a generation shortcut shared by the generator's test files.
 */
import type { PredicateRule, RangeLookupRule, Rule, Situation } from '../ontology/types.ts';
import type { ComboSet } from '../range/comboSet.ts';
import { generateScenario } from './scenario.ts';
import type { GenerateOptions, Scenario } from './types.ts';

/** A two-sided preflop range rule on the button, overridable field by field. */
export const preflopRule = (over: Partial<RangeLookupRule> = {}): RangeLookupRule => ({
    kind: 'range_lookup',
    situation: { street: 'preflop', hero_position: ['BTN'] },
    range_set_id: 'rs',
    in_range: { action: 'raise', sizing: 'medium' },
    out_of_range: { action: 'fold' },
    ...over,
});

/** A flop predicate that checks every spot its situation admits. */
export const postflopRule = (situation: Situation): PredicateRule => ({
    kind: 'predicate',
    situation: { street: 'flop', ...situation },
    branches: [],
    default: { action: 'check' },
});

/** The spot a rule generates for a seed, or a thrown error naming why it could not. */
export function generated(
    rule: Rule,
    seed: number,
    range?: ComboSet,
    over: Partial<GenerateOptions> = {},
): Scenario {
    const result = generateScenario(rule, { seed, range, ...over });
    if (!result.ok) throw new Error(`generation failed: ${result.reason}`);
    return result.scenario;
}
