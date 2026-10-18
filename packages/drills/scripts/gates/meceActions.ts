/**
 * What a rule can answer inside a region, for the MECE gate.
 */
import type { Outcome, Principle, Rule } from '../../src/ontology/types.ts';
import { countCombos, intersectCombos, subtractCombos, type ComboSet } from '../../src/range/comboSet.ts';
import { regionsIntersect, type Region, type ScalarDomains } from './meceRegions.ts';

/** Adds an outcome's action and the actions of its acceptable alternatives. */
function addOutcome(actions: Set<string>, outcome: Outcome | undefined): void {
    if (outcome === undefined) return;
    actions.add(outcome.action);
    for (const alternative of outcome.acceptable_alternatives ?? []) {
        if (alternative.action !== undefined) actions.add(alternative.action);
    }
}

/** A rule's own outcomes that can fire inside the region: range sides, or matching branches and the default. */
function ruleOutcomes(rule: Rule, region: Region, scalars: ScalarDomains): (Outcome | undefined)[] {
    if (rule.kind === 'range_lookup') return [rule.in_range, rule.out_of_range];
    if (rule.kind !== 'predicate') return [];
    const branches = rule.branches
        .filter((branch) => regionsIntersect({ ...rule.situation, ...branch.when }, region, scalars))
        .map((branch) => branch.then);
    return [...branches, rule.default];
}

/** The actions a principle can answer inside `region`: exceptions, the rule itself, and modifiers. */
export function reachableActions(principle: Principle, region: Region, scalars: ScalarDomains): Set<string> {
    const rule = principle.rule;
    const exceptions = rule.kind === 'range_lookup' ? [] : (principle.exceptions ?? [])
        .filter((exception) => regionsIntersect({ ...rule.situation, ...exception.when }, region, scalars))
        .map((exception) => exception.then);
    const modifiers = (principle.modifiers ?? []).map((modifier) => modifier.effect.substitute_outcome);
    const actions = new Set<string>();
    [...exceptions, ...ruleOutcomes(rule, region, scalars), ...modifiers].forEach((outcome) => addOutcome(actions, outcome));
    return actions;
}

interface RangeSide {
    readonly combos: ComboSet;
    /** The out-of-range side answers the complement of the set. */
    readonly complement: boolean;
}

function sidesOf(principle: Principle, ranges: ReadonlyMap<string, ComboSet>): RangeSide[] {
    const rule = principle.rule;
    if (rule.kind !== 'range_lookup') return [];
    const combos = ranges.get(rule.range_set_id);
    if (combos === undefined) return [];
    return [
        ...(rule.in_range === undefined ? [] : [{ combos, complement: false }]),
        ...(rule.out_of_range === undefined ? [] : [{ combos, complement: true }]),
    ];
}

function sidesShare(a: RangeSide, b: RangeSide): boolean {
    // Two complements always share hands.
    if (a.complement && b.complement) return true;
    if (!a.complement && !b.complement) return countCombos(intersectCombos(a.combos, b.combos)) > 0;
    return countCombos(a.complement ? subtractCombos(b.combos, a.combos) : subtractCombos(a.combos, b.combos)) > 0;
}

/**
 * Two range lookups can only both answer if some hand sits on an answering side
 * of each: in both sets, or in one and outside the other. Combo arithmetic decides.
 */
export function rangeRulesCanBothAnswer(a: Principle, b: Principle, ranges: ReadonlyMap<string, ComboSet>): boolean {
    return sidesOf(a, ranges).some((sideA) => sidesOf(b, ranges).some((sideB) => sidesShare(sideA, sideB)));
}
