/**
 * How the generator draws one value from what a rule allows.
 *
 * Omission means unconstrained: an empty or absent list samples the whole
 * domain, which is what lets sources of different granularity coexist.
 */
import type { Rng } from '../prng.ts';

/** Picks from the constraint if there is one, from the whole domain if not. */
export function sample<T extends string>(rng: Rng, constraint: readonly T[] | undefined, domain: readonly T[]): T {
    const choices = constraint === undefined || constraint.length === 0 ? domain : constraint;
    return rng.pick(choices);
}

/** Whether a rule actually constrains a slot: a present, non-empty list. */
export const constrained = <T>(constraint: readonly T[] | undefined): constraint is readonly T[] =>
    constraint !== undefined && constraint.length > 0;

/**
 * What the rule allows, narrowed to what the session asked for.
 *
 * No session constraint leaves the rule's own list (or, for an unscoped rule,
 * nothing — the caller's domain). A session constraint on an unscoped rule IS
 * the list. Where both exist and share nothing, the rule's list stands: the
 * session should never have drawn it, and the validator is where that is
 * said.
 */
export function narrowedTo<T extends string>(
    allowed: readonly T[] | undefined,
    wanted: readonly T[] | undefined,
): readonly T[] | undefined {
    if (!constrained(wanted)) return allowed;
    if (!constrained(allowed)) return wanted;
    const both = allowed.filter((value) => wanted.includes(value));
    return both.length > 0 ? both : allowed;
}

/**
 * Picks from what the TABLE allows, narrowed by what the rule allows.
 *
 * Where the two agree, sample the intersection. Where the rule insists on
 * something the table cannot produce, the rule wins — it is the author's
 * claim, and a validator's job to call it incoherent, not the generator's to
 * quietly overrule it.
 */
export function sampleCoherent<T extends string>(rng: Rng, constraint: readonly T[], coherent: readonly T[]): T {
    const both = coherent.filter((value) => constraint.includes(value));
    return rng.pick(both.length > 0 ? both : constraint);
}

/**
 * A draw from weighted entries. The weights need not sum to one.
 *
 * The last entry is the remainder rather than a case of the loop, so there is
 * no unreachable fallback to explain away: everything the earlier weights did
 * not claim is the last one's.
 */
export function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng.next() * total;
    const last = entries.at(-1);
    if (last === undefined) throw new Error('weightedPick needs at least one entry');
    for (const [value, weight] of entries.slice(0, -1)) {
        roll -= weight;
        if (roll < 0) return value;
    }
    return last[0];
}
