/**
 * The constant-rule check: a rule that says one word to every spot it claims.
 */
import type { Principle, Situation } from '../ontology/types.ts';

/**
 * Coordinates that would make a rule's scope narrower than "any spot at all".
 *
 * `street` is deliberately absent: every principle names a street, so counting
 * it would mean nothing ever looks constant.
 */
const DISCRIMINATING_SLOTS: readonly (keyof Situation)[] = [
    'hero_position', 'villain_position', 'pot_type', 'player_count', 'stack_bracket',
    'preflop_facing_state', 'postflop_facing_state', 'villain_raise_size', 'villain_types',
    'board_require', 'board_exclude', 'hand_class_any', 'draw_class_any', 'draw_class_exclude',
    'relative_strength_any', 'runout_any', 'runout_exclude', 'node_path',
];

/**
 * A rule that answers every spot it claims with the same word, and claims
 * nearly every spot.
 *
 * The naive version of this check — "a predicate rule with no branches is
 * suspect" — is wrong, and wrong in a way that punishes a correct repair. A
 * rule that says "fold to aggression on the flop when multiway" is CONSTANT by
 * construction: the discrimination lives in its situation, not in a branch, and
 * inverting it out of a misplaced exception into the situation is exactly how
 * such a rule gets fixed. Flagging the fixed shape would push an author back
 * toward the broken one.
 *
 * So a rule is only suspect when BOTH are true: no branch condition
 * discriminates, and no situation coordinate discriminates either. That is a
 * rule which fires on every spot on its street and always says the same thing —
 * which is not a decision, and drilling it measures nothing.
 */
export function isConstantRule(principle: Principle): boolean {
    const rule = principle.override_rule ?? principle.rule;

    // A range lookup already discriminates: the hero's cards decide it.
    if (rule.kind !== 'predicate') return false;

    // Any branch carrying a real condition makes the outcome depend on
    // something. An empty `when` is a default wearing a branch's clothes.
    if (rule.branches.some((branch) => Object.keys(branch.when).length > 0)) return false;

    // Exceptions and modifiers change the answer too, so a rule with either is
    // not constant even when its own branches are empty.
    if ((principle.exceptions ?? []).length > 0) return false;
    if ((principle.modifiers ?? []).length > 0) return false;

    return !DISCRIMINATING_SLOTS.some((slot) => {
        const value = rule.situation[slot];
        return value !== undefined && (!Array.isArray(value) || value.length > 0);
    });
}
