/**
 * What the source says to DO here: the action resolver.
 *
 * The precedence is fixed and each layer can silently mask the one beneath it,
 * so it is written once, here, and tested at every boundary:
 *
 *   1. `override_rule`  — where the user concluded the source is wrong, this
 *                         REPLACES the base rule entirely, exceptions included
 *   2. `modifiers`      — substitute a range set or an outcome
 *   3. `exceptions`     — first match wins, short-circuits the rule
 *   4. rule branches    — first match wins
 *   5. `default`        — fallback, or ABSTAIN where the rule has none
 *
 * `shadowed` records what else matched but did not win. It is what the "why?"
 * panel shows, and it is what lets a test assert that the static determinacy
 * check did not miss anything the runtime hits.
 */

import type { Modifier, PredicateRule, Principle, RangeLookupRule } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { hasCombo, comboIndex, type ComboSet } from '../range/comboSet.ts';
import { matchesSituation } from './match.ts';
import {
    effectiveRule, OVERRIDE_PROVENANCE, type Provenance, type Resolution, type ResolveContext,
} from './resolution.ts';

/** Modifiers substitute; they do not transform. The first whose `when` holds applies. */
function activeModifier(principle: Principle, scenario: Scenario, context: ResolveContext): Modifier | undefined {
    return (principle.modifiers ?? []).find((modifier) => {
        const textureMatches = modifier.when.game_texture === undefined
            || modifier.when.game_texture === context.gameTexture;
        const stackMatches = modifier.when.stack_bracket === undefined
            || modifier.when.stack_bracket.includes(scenario.stackBracket);
        return textureMatches && stackMatches;
    });
}

/** Exceptions run BEFORE the rule and short-circuit it. */
function exceptionAnswer(principle: Principle, scenario: Scenario, shadowed: Provenance[]): Resolution | null {
    const exceptions = principle.exceptions ?? [];
    const index = exceptions.findIndex((exception) => matchesSituation(scenario, exception.when));
    const exception = exceptions[index];
    if (exception === undefined) return null;
    return {
        kind: 'action',
        outcome: exception.then,
        provenance: { kind: 'exception', detail: exception.note ?? `exception ${index}` },
        shadowed,
    };
}

/** The applied modifier's substitute outcome as the answer, or null where it substitutes none. */
function substitutedAnswer(applied: Modifier | undefined, shadowed: Provenance[]): Resolution | null {
    const outcome = applied?.effect.substitute_outcome;
    if (applied === undefined || outcome === undefined) return null;
    return { kind: 'action', outcome, provenance: { kind: 'modifier', detail: applied.id }, shadowed };
}

/** Whether the hero's hand is in a range; a range that was never expanded holds nothing. */
const holdsHand = (combos: ComboSet | undefined, scenario: Scenario): boolean =>
    combos !== undefined && hasCombo(combos, comboIndex(scenario.hole[0], scenario.hole[1]));

function rangeAnswer(
    rule: RangeLookupRule,
    scenario: Scenario,
    context: ResolveContext,
    modifier: { readonly applied: Modifier | undefined; readonly shadowed: Provenance[] },
): Resolution | null {
    const { applied, shadowed } = modifier;
    const rangeSetId = applied?.effect.substitute_range_set_id ?? rule.range_set_id;
    const inRange = holdsHand(context.ranges.get(rangeSetId), scenario);
    // A substituted outcome replaces the IN-range answer only. The hands a range
    // rule folds are folded whatever the game is like; what a loose-game
    // modifier changes is what you do with the hands you play, such as raising
    // bigger. Substituting both sides would answer every hand in the deck with
    // the substitute the moment a modifier fired.
    const substituted = inRange ? substitutedAnswer(applied, shadowed) : null;
    if (substituted !== null) return substituted;
    // An omitted side is an abstention (1.5), same contract as a predicate with
    // no default: null, and the spot passes to the next candidate.
    const side = inRange ? rule.in_range : rule.out_of_range;
    if (side === undefined) return null;
    return {
        kind: 'action',
        outcome: side,
        provenance: { kind: 'range', detail: `${inRange ? 'in' : 'out of'} ${rangeSetId}` },
        shadowed,
    };
}

/** Branches, first match wins; later matches are recorded as shadowed, not applied. */
function branchAnswer(rule: PredicateRule, scenario: Scenario, shadowed: Provenance[]): Resolution | null {
    const matched = rule.branches
        .map((branch, index) => ({ branch, index }))
        .filter(({ branch }) => matchesSituation(scenario, branch.when));
    const [first, ...rest] = matched;
    if (first !== undefined) {
        shadowed.push(...rest.map(({ index }): Provenance => ({ kind: 'branch', detail: `branch ${index}` })));
        return {
            kind: 'action',
            outcome: first.branch.then,
            provenance: { kind: 'branch', detail: `branch ${first.index}` },
            shadowed,
        };
    }
    // Default, or ABSTAIN where the rule declines to have one. A rule reaching
    // this point matched a spot none of its branches covers; without a default
    // the honest reading is that the source says nothing about this spot, and
    // returning null lets arbitration hand it to the next principle.
    if (rule.default === undefined) return null;
    return { kind: 'action', outcome: rule.default, provenance: { kind: 'default', detail: 'no branch matched' }, shadowed };
}

/** Resolves a principle's ACTION answer for a spot, or null where it abstains or answers another kind. */
export function resolveOutcome(
    principle: Principle,
    scenario: Scenario,
    context: ResolveContext,
): Resolution | null {
    const { rule, overridden } = effectiveRule(principle);
    // A rule that answers with a label or a number has no action to resolve.
    // Null means the same as abstaining: this principle does not claim the spot
    // as an action question.
    if (rule.kind === 'classify' || rule.kind === 'count') return null;

    const applied = activeModifier(principle, scenario, context);
    const shadowed: Provenance[] = overridden ? [OVERRIDE_PROVENANCE] : [];

    const exception = exceptionAnswer(principle, scenario, shadowed);
    if (exception !== null) return exception;
    if (rule.kind === 'range_lookup') return rangeAnswer(rule, scenario, context, { applied, shadowed });

    return substitutedAnswer(applied, shadowed) ?? branchAnswer(rule, scenario, shadowed);
}
