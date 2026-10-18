/**
 * What the source says here, for every kind of question.
 *
 * The action resolver lives in `resolveAction.ts`; the shapes and the two
 * shared questions (which rule is in force, what kind it answers) live in
 * `resolution.ts`. This module is the import surface for all of it, and holds
 * the classify and count resolvers, which are short because they have less to do.
 */

import type { Principle } from '../ontology/types.ts';
import { countFilter } from '../range/onBoard.ts';
import type { Scenario } from '../generator/types.ts';
import type { ComboSet } from '../range/comboSet.ts';
import { matchesSituation } from './match.ts';
import { resolveOutcome } from './resolveAction.ts';
import {
    effectiveRule, OVERRIDE_PROVENANCE,
    type AnyResolution, type ClassifyResolution, type CountResolution, type Provenance, type Resolution,
    type ResolveContext,
} from './resolution.ts';

export {
    answerKindOf, effectiveRule, isActionResolution,
    type AnyResolution, type ClassifyResolution, type CountResolution, type Provenance, type Resolution,
    type ResolveContext,
} from './resolution.ts';
export { resolveOutcome } from './resolveAction.ts';

/**
 * Resolves a classify rule: branches first, then the default, or abstain.
 *
 * Exceptions, modifiers and range lookups are all forbidden on a classify rule:
 * an "exception" to a question with a closed list of answers is just its first
 * branch, and a modifier that substitutes an action outcome has nothing to
 * substitute here. The validator rejects them rather than this quietly ignoring
 * them.
 */
export function resolveClassify(
    principle: Principle,
    scenario: Scenario,
    _context: ResolveContext,
): ClassifyResolution | null {
    const { rule, overridden } = effectiveRule(principle);
    if (rule.kind !== 'classify') return null;

    const shadowed: Provenance[] = overridden ? [OVERRIDE_PROVENANCE] : [];
    const matched = rule.branches
        .map((branch, index) => ({ branch, index }))
        .filter(({ branch }) => matchesSituation(scenario, branch.when));
    const [first, ...rest] = matched;
    if (first !== undefined) {
        shadowed.push(...rest.map(({ index }): Provenance => ({ kind: 'branch', detail: `branch ${index}` })));
        return {
            kind: 'classify',
            outcome: first.branch.then,
            provenance: { kind: 'branch', detail: `branch ${first.index}` },
            shadowed,
        };
    }
    if (rule.default === undefined) return null;
    return { kind: 'classify', outcome: rule.default, provenance: { kind: 'default', detail: 'no branch matched' }, shadowed };
}

/**
 * Resolves a count rule by doing the arithmetic.
 *
 * Never abstains and has no branches: a range against a board has exactly one
 * answer. A missing range set is the one failure, and it is an authoring fault
 * the validator catches first; here it returns null rather than counting an
 * empty set to zero and reporting that as the source's answer.
 */
export function resolveCount(
    principle: Principle,
    scenario: Scenario,
    context: ResolveContext,
): CountResolution | null {
    const { rule, overridden } = effectiveRule(principle);
    if (rule.kind !== 'count') return null;

    const combos = context.ranges.get(rule.range_set_id);
    if (combos === undefined) return null;

    const outcome = countFilter({
        set: combos, board: scenario.board, dead: rule.dead_cards, filter: rule.filter, hero: scenario.hole,
    });
    return {
        kind: 'count',
        outcome,
        tolerance: rule.tolerance ?? 0,
        provenance: {
            kind: 'computed',
            detail: `${rule.filter.kind} over ${rule.range_set_id}, ${rule.dead_cards} dead`,
        },
        shadowed: overridden ? [OVERRIDE_PROVENANCE] : [],
    };
}

/**
 * Lets a caller reasoning purely about situations skip building ranges. With it
 * a one-sided range rule reports the WRONG side, because an empty map makes
 * every hand look out-of-range, so every caller that grades or generates passes
 * real ranges.
 */
const NO_RANGES: ReadonlyMap<string, ComboSet> = new Map();

/**
 * Does this principle decline to answer this spot? Asked of the resolver for
 * the rule's own kind rather than re-derived, because a second copy of "what
 * wins over what" drifts, and asking the action resolver about a classify rule
 * would get null every time.
 */
export function abstainsOn(
    principle: Principle,
    scenario: Scenario,
    context: ResolveContext = { ranges: NO_RANGES },
): boolean {
    const { rule } = effectiveRule(principle);
    if (rule.kind === 'classify') return resolveClassify(principle, scenario, context) === null;
    if (rule.kind === 'count') return resolveCount(principle, scenario, context) === null;
    return resolveOutcome(principle, scenario, context) === null;
}

/** A resolver's answer for a principle arbitration chose; null there is a bug in the caller. */
function chosen<T>(resolution: T | null, principle: Principle): T {
    if (resolution === null) {
        throw new Error(`Principle ${principle.id} was asked to govern a spot it does not answer`);
    }
    return resolution;
}

/**
 * The action outcome of a principle that arbitration has already chosen.
 *
 * `rankCandidates` drops every principle that abstains on the spot, so anything
 * it hands back is guaranteed to answer. This checks that once, here, instead of
 * every call site handling a null it has already ruled out.
 */
export function resolveGoverning(
    principle: Principle,
    scenario: Scenario,
    context: ResolveContext,
): Resolution {
    return chosen(resolveOutcome(principle, scenario, context), principle);
}

/** The same, for a principle of any kind: arbitration matched its kind to the question asked. */
export function resolveGoverningAny(
    principle: Principle,
    scenario: Scenario,
    context: ResolveContext,
): AnyResolution {
    const { rule } = effectiveRule(principle);
    if (rule.kind === 'classify') return chosen(resolveClassify(principle, scenario, context), principle);
    if (rule.kind === 'count') return chosen(resolveCount(principle, scenario, context), principle);
    return chosen(resolveOutcome(principle, scenario, context), principle);
}
