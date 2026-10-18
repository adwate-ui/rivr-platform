/**
 * Which principle governs a spot, when several of them match it.
 *
 * THE DEFECT THIS REPLACES: nothing decided. Both callers took the first
 * match, which means declaration order decided, which means the answer was a
 * property of where a principle sits in a file rather than of the encoding.
 * Matching on street and hero position alone, every scored hand in a real
 * encoding had many candidates, not two. The 1.2 coordinates cut that down;
 * they do not cut it to one, and nothing ever will, because a source is
 * entitled to state a general rule and a specific one about the same spot.
 *
 * THE RULE: the most SPECIFIC principle governs, where specificity is the
 * number of constrained coordinates in its situation. That is the reading a
 * person applies without being asked — "fold to a turn raise from a nit at
 * 200bb" is about a narrower thing than "fold to a turn raise", so it is the
 * one that should answer when both apply.
 *
 * `street` and `node_path` are excluded from the count. Every principle names
 * a street, so counting it adds one to everybody and discriminates nothing;
 * street belongs in the tie-breaks, where its WIDTH is what matters. `node_path`
 * is a replayed action sequence rather than a coordinate — it does not narrow
 * which spots exist, it describes how one was reached.
 *
 * THIS LIVES HERE, not in the harness, because the drill engine faces exactly
 * the same question every time a generated scenario satisfies more than one
 * principle. Two implementations would drift, and a drifting drill engine
 * grades the user by one rule while showing them feedback from another.
 */

import type { Principle, Situation } from '../ontology/types.ts';
import { situationStreets } from '../ontology/types.ts';
import { abstainsOn, answerKindOf, effectiveRule, type ResolveContext } from './resolve.ts';
import { matchesSituation } from './match.ts';
import type { Scenario } from '../generator/types.ts';

/**
 * Coordinates that make a situation narrower, and are therefore counted.
 *
 * Written out rather than derived from `Object.keys`, so that adding a field to
 * `Situation` is a decision about whether it discriminates rather than a silent
 * change to how every principle ranks.
 */
export const SPECIFICITY_SLOTS: readonly (keyof Situation)[] = [
    // `stakes` counts. Advice often depends on the game, it has been a matched
    // coordinate since 1.4, and a ranker that ignored it would let a rule
    // written without stakes tie with one scoped to them.
    'stakes',
    'hero_position', 'villain_position', 'pot_type', 'player_count', 'stack_bracket', 'spr_bracket',
    'preflop_facing_state', 'postflop_facing_state', 'villain_raise_size', 'villain_types',
    'board_require', 'board_exclude', 'hand_class_any', 'draw_class_any', 'draw_class_exclude',
    'relative_strength_any', 'runout_any', 'runout_exclude',
];

/** Is this slot actually constrained, or present-but-empty? */
const constrains = (situation: Situation, slot: keyof Situation): boolean => {
    const value = situation[slot];
    if (value === undefined) return false;
    return !Array.isArray(value) || value.length > 0;
};

/** How many coordinates this situation pins down. `street` is not one of them. */
export function specificity(situation: Situation): number {
    return SPECIFICITY_SLOTS.filter((slot) => constrains(situation, slot)).length;
}

/**
 * How many streets a situation admits.
 *
 * An unstated street admits all four — it is the widest possible claim, not a
 * neutral one, so it must sort last rather than being treated as absent.
 */
export function streetWidth(situation: Situation): number {
    return situationStreets(situation)?.length ?? 4;
}

/** Constrained coordinates across every branch condition, summed. */
export function branchSpecificity(principle: Principle): number {
    const { rule } = effectiveRule(principle);
    if (rule.kind !== 'predicate') return 0;
    return rule.branches.reduce((total, branch) => total + specificity(branch.when), 0);
}

export interface Ranked {
    readonly principle: Principle;
    readonly specificity: number;
    readonly streetWidth: number;
    readonly branchSpecificity: number;
    /** Position in the source file. The last resort, and only that. */
    readonly declarationIndex: number;
}

/**
 * Negative when `a` should govern, positive when `b` should.
 *
 * Total and antisymmetric: every comparison ends at `declarationIndex`, which
 * is unique per principle. That is what makes the result independent of the
 * order the candidates arrived in, which is the property the original defect
 * violated and which the shuffle test pins.
 */
export function compareRanked(a: Ranked, b: Ranked): number {
    if (a.specificity !== b.specificity) return b.specificity - a.specificity;
    // Tie-break 1: the narrower street set wins. ["turn"] beats ["turn","river"].
    if (a.streetWidth !== b.streetWidth) return a.streetWidth - b.streetWidth;
    // Tie-break 2: more constrained branch conditions.
    if (a.branchSpecificity !== b.branchSpecificity) return b.branchSpecificity - a.branchSpecificity;
    // Tie-break 3, and only now: where it sits in the file.
    return a.declarationIndex - b.declarationIndex;
}

/**
 * Every principle that admits this spot, most specific first.
 *
 * `drillable: false` principles are excluded. Their rule is a placeholder —
 * typically an empty situation defaulting to check — so it matches every spot
 * and answers none of them, and under specificity ranking an empty situation
 * scores zero and would lose anyway. Excluding them says so explicitly rather
 * than relying on that.
 *
 * `declarationIndex` is taken from the position in the ARRAY AS GIVEN, which is
 * the source file's order. Callers must therefore pass principles in source
 * order — every caller here does, and the shuffle test asserts the winner does
 * not depend on it anyway except at an exact three-way tie.
 */
export function rankCandidates(
    scenario: Scenario,
    principles: readonly Principle[],
    context?: ResolveContext,
): Ranked[] {
    const ranked: Ranked[] = [];

    principles.forEach((principle, declarationIndex) => {
        if (principle.drillable === false) return;
        const { rule } = effectiveRule(principle);
        // A rule that answers a different KIND of question is not a candidate,
        // however well its situation fits. Without this a more specific action
        // rule governs a "strong fit or weak fit?" spot and grades the reader
        // against `raise`.
        if (answerKindOf(rule) !== (context?.answerKind ?? 'action')) return;
        if (!matchesSituation(scenario, rule.situation)) return;
        // A rule that declines to answer has not claimed the spot. This is what
        // makes abstention a SCOPE mechanism rather than a third outcome: the
        // spot passes to the next principle, or to nobody, instead of being
        // answered by a catch-all the passage never authorised.
        if (abstainsOn(principle, scenario, context)) return;

        ranked.push({
            principle,
            specificity: specificity(rule.situation),
            streetWidth: streetWidth(rule.situation),
            branchSpecificity: branchSpecificity(principle),
            declarationIndex,
        });
    });

    return ranked.sort(compareRanked);
}

export interface Arbitration {
    /** The principle that governs, or null when nothing matched. */
    readonly governing: Principle | null;
    /** Second place, where there was one. Null when zero or one candidate. */
    readonly runnerUp: Principle | null;
    /** How many principles matched BEFORE arbitration narrowed it to one. */
    readonly candidateCount: number;
    /** Constrained-coordinate count of the winner, or 0 when nothing matched. */
    readonly governingSpecificity: number;
    readonly ranked: readonly Ranked[];
}

/**
 * The single entry point. Both the harness and the drill grader call this.
 *
 * Returns the runner-up alongside the winner because that is what tells you
 * whether arbitration is doing useful work: if the second-ranked principle
 * would have answered identically, the ranking is low-stakes; if it would have
 * answered differently, it is load-bearing.
 */
export function arbitrate(
    scenario: Scenario,
    principles: readonly Principle[],
    context?: ResolveContext,
): Arbitration {
    const ranked = rankCandidates(scenario, principles, context);
    return {
        governing: ranked[0]?.principle ?? null,
        runnerUp: ranked[1]?.principle ?? null,
        candidateCount: ranked.length,
        governingSpecificity: ranked[0]?.specificity ?? 0,
        ranked,
    };
}

/** Just the winner, for callers that do not need the rest. */
export function governingPrinciple(
    scenario: Scenario,
    principles: readonly Principle[],
    context?: ResolveContext,
): Principle | null {
    return arbitrate(scenario, principles, context).governing;
}
