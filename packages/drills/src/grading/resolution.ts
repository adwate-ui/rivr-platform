/**
 * The shapes a resolved answer takes, and the two questions every resolver asks
 * first: which rule is in force, and what kind of answer it gives.
 */

import type { AnswerKind, ClassifyOutcome, Outcome, Principle, Rule } from '../ontology/types.ts';
import type { CountOutcome } from '../range/onBoard.ts';
import type { ComboSet } from '../range/comboSet.ts';

export type Provenance =
    | { readonly kind: 'override'; readonly detail: string }
    | { readonly kind: 'modifier'; readonly detail: string }
    | { readonly kind: 'exception'; readonly detail: string }
    | { readonly kind: 'branch'; readonly detail: string }
    | { readonly kind: 'range'; readonly detail: string }
    | { readonly kind: 'default'; readonly detail: string }
    /** A count, worked out from the range and the board rather than authored. */
    | { readonly kind: 'computed'; readonly detail: string };

/** Recorded in `shadowed` whenever a user override replaced the base rule. */
export const OVERRIDE_PROVENANCE: Provenance = { kind: 'override', detail: 'base rule replaced by your override' };

/**
 * A resolved ACTION answer.
 *
 * The `kind` discriminant is what makes every reader of
 * `resolution.outcome.action` say which kind of answer it meant, so a classify
 * or count resolution can never be read as an action by accident.
 */
export interface Resolution {
    readonly kind: 'action';
    readonly outcome: Outcome;
    readonly provenance: Provenance;
    /** Matched but did not win, in precedence order. */
    readonly shadowed: readonly Provenance[];
}

/**
 * A resolved CLASSIFY answer.
 *
 * Deliberately not reachable through `resolveOutcome`: the two kinds have
 * different outcome shapes, and a function that could return either would push
 * the narrowing onto every caller, including the many that only ever want an
 * action. Arbitration already refuses to hand a classify rule to an action
 * caller, so the split is enforced a step earlier than the type system.
 */
export interface ClassifyResolution {
    readonly kind: 'classify';
    readonly outcome: ClassifyOutcome;
    readonly provenance: Provenance;
    readonly shadowed: readonly Provenance[];
}

/**
 * A resolved COUNT answer.
 *
 * The outcome is COMPUTED, not authored: it is what the range actually holds
 * against this board, which is why `provenance` is `computed` and why a count
 * rule can never be wrong about its own answer, only about the range it was
 * pointed at.
 */
export interface CountResolution {
    readonly kind: 'count';
    readonly outcome: CountOutcome;
    readonly tolerance: number;
    readonly provenance: Provenance;
    readonly shadowed: readonly Provenance[];
}

export type AnyResolution = Resolution | ClassifyResolution | CountResolution;

/** Whether a resolution answers with an action. */
export const isActionResolution = (resolution: AnyResolution): resolution is Resolution =>
    resolution.kind === 'action';

export interface ResolveContext {
    /** Expanded ranges by id, so a lookup costs nothing at drill time. */
    readonly ranges: ReadonlyMap<string, ComboSet>;
    /** The table's texture, where the user has told us. Drives modifiers. */
    readonly gameTexture?: string | undefined;
    /**
     * Which kind of answer is being asked for. Omitted means `action`, so every
     * caller written before answer kinds existed keeps asking what it asked.
     */
    readonly answerKind?: AnswerKind | undefined;
}

/**
 * The kind of answer a rule asks for.
 *
 * A `switch` with no default on purpose: when `Rule` grows a member, this stops
 * compiling, and every place that has to learn about the new kind is found by
 * the compiler rather than by a reader.
 */
export function answerKindOf(rule: Rule): AnswerKind {
    switch (rule.kind) {
        case 'range_lookup':
        case 'predicate':
            return 'action';
        case 'classify':
            return 'classify';
        case 'count':
            return 'count';
    }
}

/** The rule actually in force: an override replaces the base rule wholesale. */
export function effectiveRule(principle: Principle): { rule: Rule; overridden: boolean } {
    if (principle.status === 'overridden' && principle.override_rule !== undefined) {
        return { rule: principle.override_rule, overridden: true };
    }
    return { rule: principle.rule, overridden: false };
}
