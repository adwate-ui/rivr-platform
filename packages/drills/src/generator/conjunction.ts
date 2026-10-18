/**
 * Two situations at once: the conjunction, not the override.
 *
 * A branch's `when` and an exception's `when` are each evaluated against a
 * scenario that ALREADY satisfies the rule's own situation: the principle had
 * to be selected before either could be reached. So the spot a branch really
 * describes is `rule.situation AND branch.when`, and asking whether a branch is
 * satisfiable means asking that of the conjunction.
 *
 * Merging by spread instead lets the narrower condition silently REPLACE the
 * broader one. A rule scoped to the flop with a branch keyed on the turn merges
 * to "turn", looks satisfiable, and is dead code: no scenario ever reaches it.
 * Intersecting reports the contradiction.
 */
import type { Situation, Street } from '../ontology/types.ts';

/** Both lists' common members; a side that says nothing leaves the other as it is. */
function meet<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
    if (left === undefined) return right;
    if (right === undefined) return left;
    return left.filter((entry) => right.includes(entry));
}

/**
 * Every member of both lists. `board_require` demands every listed tag and
 * `board_exclude` forbids every listed tag, so both are conjunctions already:
 * requiring `monotone` in a rule and `paired` in its branch means requiring
 * both, where intersecting would call a good branch unsatisfiable.
 */
function join<T>(left: T[] | undefined, right: T[] | undefined): T[] | undefined {
    if (left === undefined) return right;
    if (right === undefined) return left;
    return [...new Set([...left, ...right])];
}

/**
 * `street` is the one slot the schema lets a source write as a bare string, so
 * it is normalised before intersecting, or "preflop" and ["preflop"] would look
 * disjoint.
 */
function meetStreets(left: Situation['street'], right: Situation['street']): Situation['street'] {
    if (left === undefined || right === undefined) return right ?? left;
    const leftList: Street[] = Array.isArray(left) ? left : [left];
    const rightList: Street[] = Array.isArray(right) ? right : [right];
    return leftList.filter((street) => rightList.includes(street));
}

/** Sets a slot only when there is a value, so an unconstrained slot stays absent. */
function put<T>(value: T | undefined, set: (present: T) => void): void {
    if (value !== undefined) set(value);
}

/**
 * The spot both situations describe. Every list slot intersects except the two
 * board slots, which accumulate; any other slot the narrower one states
 * replaces the base's.
 */
export function situationConjunction(base: Situation, narrower: Situation): Situation {
    const merged: Situation = { ...base, ...narrower };
    const b = base;
    const n = narrower;
    put(meetStreets(b.street, n.street), (v) => { merged.street = v; });
    put(meet(b.hero_position, n.hero_position), (v) => { merged.hero_position = v; });
    put(meet(b.villain_position, n.villain_position), (v) => { merged.villain_position = v; });
    put(meet(b.pot_type, n.pot_type), (v) => { merged.pot_type = v; });
    put(meet(b.player_count, n.player_count), (v) => { merged.player_count = v; });
    put(meet(b.stack_bracket, n.stack_bracket), (v) => { merged.stack_bracket = v; });
    put(meet(b.spr_bracket, n.spr_bracket), (v) => { merged.spr_bracket = v; });
    put(meet(b.stakes, n.stakes), (v) => { merged.stakes = v; });
    put(meet(b.preflop_facing_state, n.preflop_facing_state), (v) => { merged.preflop_facing_state = v; });
    put(meet(b.postflop_facing_state, n.postflop_facing_state), (v) => { merged.postflop_facing_state = v; });
    put(meet(b.villain_raise_size, n.villain_raise_size), (v) => { merged.villain_raise_size = v; });
    put(meet(b.villain_types, n.villain_types), (v) => { merged.villain_types = v; });
    put(meet(b.hand_class_any, n.hand_class_any), (v) => { merged.hand_class_any = v; });
    put(meet(b.draw_class_any, n.draw_class_any), (v) => { merged.draw_class_any = v; });
    put(meet(b.relative_strength_any, n.relative_strength_any), (v) => { merged.relative_strength_any = v; });
    put(meet(b.runout_any, n.runout_any), (v) => { merged.runout_any = v; });
    put(join(b.board_require, n.board_require), (v) => { merged.board_require = v; });
    put(join(b.board_exclude, n.board_exclude), (v) => { merged.board_exclude = v; });
    return merged;
}
