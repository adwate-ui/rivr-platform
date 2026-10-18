/**
 * Turning a rule into a concrete spot.
 *
 * ONE generator, parameterised by rule kind rather than one per principle —
 * a per-principle generator is a second encoding of the same rule, and the two
 * drift. `rule.kind` selects only how the hero's hand is drawn: from an
 * expanded range for a preflop lookup, from a hand-class filter for a postflop
 * predicate.
 *
 * Two properties everything downstream depends on:
 *
 * **Sample every coordinate the situation constrains; sample FREELY on every
 * one it omits.** Omission means unconstrained, and that is precisely what lets
 * a source that never mentions stack depth coexist with one that keys
 * everything on it. It is also where the analytics come from: attributes nobody
 * authored get varied anyway, so a leak at very deep stacks can surface even
 * though no rule mentions stacks.
 *
 * **Replay `node_path` verbatim and never invent an action.** The generator
 * copies the authored sequence and stops. That is the whole reason an
 * all-streets scope stays bounded — without it, "what happened before this
 * decision" is an infinite tree.
 *
 * The steps run in a fixed order from one seeded generator: seat the table
 * (`table.ts`), size the stacks (`potAndStack.ts`), name the opponent's type
 * and bet size, then deal (`deal.ts`). The order is part of the contract: the
 * same seed must always produce the same spot.
 */

import type { Rule, Situation } from '../ontology/types.ts';
import { makeRng, type Rng } from '../prng.ts';
import { dealScenario, type Coordinates } from './deal.ts';
import { sizeStacks } from './potAndStack.ts';
import { constrained } from './sampling.ts';
import { seatTable } from './table.ts';
import type { GenerateOptions, GenerateResult } from './types.ts';

/**
 * Which side of its range to deal a rule this time.
 *
 * One definition, because every caller that gets this wrong gets it wrong
 * silently. The first version of it lived inline in the session and dealt
 * in-range whenever `in_range` was authored — so for a two-sided rule the
 * `out_of_range` half was never drilled once. On an opening rule that is the
 * more common decision by a wide margin: the reader practised raising the
 * few hands an opening range holds and never practised folding the rest.
 *
 * A one-sided rule gets its authored side, because the other one abstains. A
 * two-sided rule alternates by seed, so both halves come up and neither is
 * predictable from the last spot.
 */
export function rangeSideFor(rule: Rule, seed: number): 'in' | 'out' | undefined {
    if (rule.kind !== 'range_lookup') return undefined;
    if (rule.in_range === undefined) return 'out';
    if (rule.out_of_range === undefined) return 'in';
    return seed % 2 === 0 ? 'in' : 'out';
}

/** The opponent's type and the size of the bet in front of the hero, where the rule names them. */
function opponentDetails(situation: Situation, rng: Rng): Pick<Coordinates, 'villainType' | 'villainRaiseSize'> {
    const villainType = constrained(situation.villain_types) ? rng.pick(situation.villain_types) : undefined;
    const villainRaiseSize = constrained(situation.villain_raise_size) ? rng.pick(situation.villain_raise_size) : undefined;
    return { villainType, villainRaiseSize };
}

/**
 * Generates one scenario, or explains why it could not.
 *
 * **Never throws and never loops unbounded.** This runs on a phone, and a rule
 * whose board can only be found one time in a million must cost a banner rather
 * than a locked tab. The session drops that card and carries on.
 */
export function generateScenario(rule: Rule, options: GenerateOptions): GenerateResult {
    const rng = makeRng(options.seed);
    const table = seatTable(rule.situation, options, rng);
    // A rule that names a hero seat leaving nobody who could have done what the
    // hero is facing describes no table; say so rather than shuffle boards.
    if (table === null) return { ok: false, reason: 'spot-impossible', attempts: 0 };
    const sizing = sizeStacks(rule.situation, table, options, rng);
    const coordinates: Coordinates = { ...table, ...sizing, ...opponentDetails(rule.situation, rng) };
    return dealScenario(rule, coordinates, options, rng);
}
