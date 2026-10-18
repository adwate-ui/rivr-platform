/**
 * Answers a reader would call broken, whatever the encoding says.
 *
 * Two different absurdities, with two different hand lists. Checking first to
 * act with a hand you would bet for value gives up money, and top pair is
 * already too strong for that. Folding to a bet is different: folding top pair
 * or two pair to a large late bet is often right, so folding is only absurd
 * with a hand that beats what a big bet can represent.
 */
import type { Action, HandClass, RelativeStrength } from '../../src/ontology/types.ts';

const TOO_STRONG_TO_CHECK: ReadonlySet<HandClass> = new Set([
    'top_pair_good_kicker', 'overpair', 'two_pair', 'set', 'straight', 'flush', 'full_house_plus',
]);
const TOO_STRONG_TO_FOLD: ReadonlySet<HandClass> = new Set(['set', 'straight', 'flush', 'full_house_plus']);

/** Checking or folding a hand too strong for it, by a rule that never read the hand. */
export const absurdGiveUp = (action: Action, handClass: HandClass): boolean =>
    (action === 'check' && TOO_STRONG_TO_CHECK.has(handClass))
    || (action === 'fold' && TOO_STRONG_TO_FOLD.has(handClass));

/**
 * Folding the nuts, judged on every spot. When the five community cards are the
 * best hand, `hand_class` reads `no_pair` while every player holds the same
 * unbeatable hand, and folding forfeits a share of a pot that cannot be lost.
 * Checking the nuts can be a deliberate disguise; folding them never is.
 */
export const foldsTheNuts = (action: Action, strength: RelativeStrength | undefined): boolean =>
    action === 'fold' && strength === 'nuts';
