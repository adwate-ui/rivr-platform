/**
 * Stage 5: can two branches of one rule both match, and disagree?
 *
 * Branches are ordered and first-match-wins, so a runtime answer is never
 * genuinely ambiguous. This stage refuses the overlap anyway, and the reason is
 * editorial rather than mechanical: **a rule you can only understand by reading
 * it top to bottom is a rule its author will eventually mis-edit.** Inserting a
 * branch in the middle of one silently changes the answer for spots nobody was
 * thinking about.
 *
 * **The algorithm.** A `situation` is a strict conjunction of per-slot
 * memberships — every field is a set of allowed values, and an absent field
 * means the whole domain. That makes each branch a hyperrectangle over finite
 * domains, and two of them can co-fire exactly when EVERY slot's allowed sets
 * intersect. Exact, complete, and O(slots x domain) rather than a search.
 *
 * Set-valued slots need different algebra: a board carries several tags at
 * once, so two branches requiring different tags can both match one board. What
 * stops them is joint realisability, which is asked of the board enumeration
 * rather than asserted here.
 */

import { situationStreets, type BoardTag, type Outcome, type PredicateRule, type Situation } from '../ontology/types.ts';
import { SCALAR_SLOTS, allowedValues } from '../generator/slots.ts';
import { jointRealisability, type Realisability } from './tagCompatibility.ts';

export interface Overlap {
    readonly first: number;
    readonly second: number;
    /** How sure we are the two can genuinely co-occur. */
    readonly confidence: Realisability;
    /** One concrete assignment both branches accept. */
    readonly witness: Record<string, string>;
    readonly sameOutcome: boolean;
}

/** The hand slots a branch can narrow by listing values, compared as plain sets. */
const LISTED_HAND_SLOTS = ['hand_class_any', 'draw_class_any', 'relative_strength_any'] as const;

/** Canonical text for an outcome, so two are compared by value not by identity. */
export function outcomeKey(outcome: Outcome): string {
    const alternatives = [...(outcome.acceptable_alternatives ?? [])]
        .map((alternative) => `${alternative.action ?? ''}:${alternative.sizing ?? ''}`)
        .sort()
        .join('|');
    return `${outcome.action}:${outcome.sizing ?? 'unspecified'}${alternatives === '' ? '' : `+${alternatives}`}`;
}

/** The streets two situations share: undefined for "any", empty when disjoint. */
function sharedStreets(a: Situation, b: Situation): readonly string[] | undefined {
    const streetsA = situationStreets(a);
    const streetsB = situationStreets(b);
    if (streetsA === undefined) return streetsB;
    if (streetsB === undefined) return streetsA;
    return streetsA.filter((street) => streetsB.includes(street));
}

/** Writes one shared value per scalar slot into `witness`, or returns false when a slot is disjoint. */
function scalarSlotsOverlap(a: Situation, b: Situation, witness: Record<string, string>): boolean {
    for (const slot of SCALAR_SLOTS) {
        const right = new Set(allowedValues(b, slot));
        const [shared] = allowedValues(a, slot).filter((value) => right.has(value));
        if (shared === undefined) return false;
        witness[slot] = shared;
    }
    return true;
}

/** Writes one shared value per listed hand slot into `witness`, or returns false when one is disjoint. */
function handSlotsOverlap(a: Situation, b: Situation, witness: Record<string, string>): boolean {
    for (const slot of LISTED_HAND_SLOTS) {
        const left: readonly string[] | undefined = a[slot];
        const right: readonly string[] | undefined = b[slot];
        if (left === undefined || right === undefined) continue;
        const [shared] = left.filter((value) => right.includes(value));
        if (shared === undefined) return false;
        witness[slot] = shared;
    }
    return true;
}

/** Do the two situations agree on every scalar slot? Returns a witness if so. */
function scalarOverlap(a: Situation, b: Situation): Record<string, string> | null {
    const witness: Record<string, string> = {};
    if (!scalarSlotsOverlap(a, b, witness)) return null;

    // Streets intersect like every other slot now that 1.1 allows a list.
    const streets = sharedStreets(a, b);
    if (streets !== undefined) {
        const [street] = streets;
        if (street === undefined) return null;
        witness.street = street;
    }

    return handSlotsOverlap(a, b, witness) ? witness : null;
}

/**
 * Can one board satisfy both branches' tag requirements and exclusions?
 *
 * Texture is the flop's on every street, so the street the branches share is
 * not part of the question — see `tagCompatibility.ts`.
 */
function boardOverlap(a: Situation, b: Situation): Realisability {
    const required: BoardTag[] = [...new Set([...(a.board_require ?? []), ...(b.board_require ?? [])])];
    const excluded = new Set([...(a.board_exclude ?? []), ...(b.board_exclude ?? [])]);

    if (required.some((tag) => excluded.has(tag))) return 'impossible';
    return jointRealisability(required);
}

/**
 * Every pair of branches that can both fire.
 *
 * O(branches squared), which is free at the ~20 branches a hand-authored rule
 * ever has.
 */
export function findOverlaps(rule: PredicateRule): Overlap[] {
    const overlaps: Overlap[] = [];

    rule.branches.forEach((earlier, first) => {
        rule.branches.slice(first + 1).forEach((later, offset) => {
            const a = { ...rule.situation, ...earlier.when };
            const b = { ...rule.situation, ...later.when };

            const witness = scalarOverlap(a, b);
            if (witness === null) return;

            const confidence = boardOverlap(a, b);
            if (confidence === 'impossible') return;

            overlaps.push({
                first,
                second: first + 1 + offset,
                confidence,
                witness,
                sameOutcome: outcomeKey(earlier.then) === outcomeKey(later.then),
            });
        });
    });

    return overlaps;
}

/** Does `earlier` allow every street `later` allows? */
function coversStreets(earlier: Situation, later: Situation): boolean {
    const covering = situationStreets(earlier);
    if (covering === undefined) return true;
    const covered = situationStreets(later);
    return covered !== undefined && covered.every((street) => covering.includes(street));
}

/** Does `earlier` constrain a set slot in a way that can refuse spots `later` admits? */
function narrowsBySetSlot(earlier: Situation): boolean {
    // An earlier branch demanding tags cannot cover a later one that does not.
    return (earlier.board_require ?? []).length > 0
        || (earlier.board_exclude ?? []).length > 0
        || (earlier.draw_class_exclude ?? []).length > 0
        || (earlier.runout_exclude ?? []).length > 0;
}

/** Does every listed-value slot `earlier` constrains cover what `later` allows? */
function coversListedSlots(earlier: Situation, later: Situation): boolean {
    for (const slot of [...LISTED_HAND_SLOTS, 'runout_any'] as const) {
        const covering: readonly string[] | undefined = earlier[slot];
        if (covering === undefined) continue;
        const covered: readonly string[] | undefined = later[slot];
        if (covered === undefined) return false;
        if (!covered.every((value) => covering.includes(value))) return false;
    }
    return true;
}

/**
 * Is `later` entirely covered by `earlier`?
 *
 * A branch that can never be reached because an earlier one always wins first
 * is dead weight in the encoding, and almost always means the author meant to
 * narrow it and did not.
 */
export function isShadowed(earlier: Situation, later: Situation): boolean {
    for (const slot of SCALAR_SLOTS) {
        const covering = new Set(allowedValues(earlier, slot));
        if (!allowedValues(later, slot).every((value) => covering.has(value))) return false;
    }
    if (!coversStreets(earlier, later)) return false;
    if (narrowsBySetSlot(earlier)) return false;
    return coversListedSlots(earlier, later);
}
