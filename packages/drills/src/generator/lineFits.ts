/**
 * Did the hero's OWN earlier streets follow the source's own principles?
 *
 * `playable` answers this for preflop: a hero the story shows opening under
 * the gun is dealt a hand that seat opens. Nothing answered it for the flop or
 * the turn. So a turn spot whose line reads "you bet the flop and they called"
 * dealt any hand the TURN rule wanted, including hands the source's own flop
 * rules say to check or give up: the drill taught one piece of the source's
 * advice over a flop that contradicted another.
 *
 * The check is the same question the drill asks the reader, asked of the hero:
 * rewind the spot to the hero's earlier decision, arbitrate, and require the
 * recorded action to be the answer the source gives. That is deliberately
 * strict — the recorded action must BE the source's answer, or one of the
 * alternatives the source itself calls acceptable — and it is strict in the
 * only direction that matters: a hand rejected here is a hand the reader would
 * have been asked about after a street the source would not have played that
 * way.
 *
 * **Silence imposes nothing.** Where nothing governs the rewound spot there is
 * no answer to agree with, and inventing one would be the same fault this
 * module exists to fix. Same doctrine as `playable`, where a seat and action
 * the source never speaks for gets no filter.
 *
 * Kept out of `generator/scenario.ts` and passed in as a function, the way
 * `Playable` is, so the generator keeps no import of the grading layer.
 */

import type { Action, Principle, Street } from '../ontology/types.ts';
import { STREETS } from '../ontology/types.ts';
import { parseStep, type PathStep } from '../nodePath.ts';
import { arbitrate } from '../grading/arbitrate.ts';
import { resolveGoverning, type ResolveContext } from '../grading/resolve.ts';
import { classifyMadeHand } from '../handClass.ts';
import { classifyRelativeStrength } from '../relativeStrength.ts';
import { classifyRunout } from '../runout.ts';
import { POSTFLOP_ORDER } from './seating.ts';
import { boardSizeFor } from './deal.ts';
import { bracketForSpr, potBbAt, DEFAULT_SPR_BRACKETS } from './potAndStack.ts';
import type { LineFits, Scenario, SprThresholds } from './types.ts';

/**
 * What a `node_path` verb and a pad answer have to share to be the same act.
 *
 * The line's vocabulary is coarser than the answer's: an all-in is a bet, and
 * a story that says the hero bet is told by a rule that says shove. The
 * mapping is written out rather than implied by a string compare so that the
 * one place the two vocabularies meet is visible.
 */
const SAME_ACT: Readonly<Record<string, readonly Action[]>> = {
    bet: ['bet', 'all_in'],
    raise: ['raise', 'all_in'],
    all_in: ['all_in', 'bet', 'raise'],
    call: ['call'],
    check: ['check'],
    fold: ['fold'],
};

/**
 * What the hero was facing when they took this step, read off the steps in
 * front of it on the same street.
 *
 * The last thing the other player did IS the facing state. Nothing in front of
 * the hero at all means nobody has acted this street, so the hero either opens
 * it or was checked to — decided by the seating order, the same way the
 * generator decides it.
 */
function facingAt(
    scenario: Scenario,
    street: Street,
    before: readonly PathStep[],
): Scenario['postflopFacingState'] {
    const onStreet = before.filter((step) => step.street === street);
    const lastVillain = [...onStreet].reverse().find((step) => step.actor === 'villain');
    if (lastVillain !== undefined) {
        // A bet or a raise is what the hero is answering. Anything else the
        // other player did — a check, a call — leaves the hero acting into a
        // street nobody has bet, which is the same question as a check.
        if (lastVillain.action === 'bet') return 'facing_bet';
        if (lastVillain.action === 'raise' || lastVillain.action === 'all_in') return 'facing_raise';
        return 'facing_check';
    }
    if (onStreet.length > 0) return 'facing_check';
    const inPot = [scenario.heroPosition, ...scenario.villainPositions];
    const earliest = POSTFLOP_ORDER.find((seat) => inPot.includes(seat));
    return earliest === scenario.heroPosition ? 'first_to_act' : 'facing_check';
}

/**
 * The spot as it stood at an earlier decision — the same object the generator
 * builds, on a shorter board.
 *
 * Everything the cards decide is re-derived from the shorter board rather than
 * carried over: the hand that is two pair on the river was one pair on the
 * flop, and grading the flop decision on the river's classification is the
 * hindsight this whole module is against. Everything the TABLE decided —
 * seats, stakes, stack, pot type — is carried, because it did not change.
 *
 * `villainRaiseSize` is dropped: the spot states the size of the bet in front
 * of the hero NOW, and it says nothing about the one on the flop. A rule
 * scoped to a bet size therefore does not match the rewound spot, which is
 * silence rather than a guess.
 */
function rewind(
    scenario: Scenario,
    street: Street,
    before: readonly string[],
    sprBrackets: SprThresholds,
): Scenario {
    const board = scenario.board.slice(0, boardSizeFor(street));
    const made = classifyMadeHand(scenario.hole, board);
    const steps = before.map(parseStep);
    const turnCard = board.length === 4 ? board[3] : undefined;
    const pot = scenario.potType === undefined
        ? undefined
        : potBbAt(street, scenario.potType, scenario.playerCount, before);
    return {
        ...scenario,
        street,
        postflopFacingState: facingAt(scenario, street, steps),
        villainRaiseSize: undefined,
        potBb: pot === undefined ? undefined : Math.round(pot),
        sprBracket: pot === undefined || scenario.effectiveStackBb === undefined
            ? undefined
            : bracketForSpr(scenario.effectiveStackBb / pot, sprBrackets),
        board,
        handClass: made.handClass,
        draws: made.draws,
        relativeStrength: classifyRelativeStrength(scenario.hole, board),
        // A rewind always targets a street BEFORE the decision, so the board
        // here is three cards or four and never the river's five — which is
        // why `priorRunouts`, a river-only reading, is always absent.
        runouts: turnCard === undefined ? undefined : classifyRunout(board.slice(0, 3), turnCard, scenario.hole),
        priorRunouts: undefined,
        nodePath: [...before],
    };
}

interface StepCheck {
    readonly candidate: Scenario;
    readonly step: PathStep;
    readonly index: number;
    readonly principles: readonly Principle[];
    readonly context: ResolveContext;
    readonly thresholds: SprThresholds;
}

/** The answers the source gives on a rewound spot: its outcome and every alternative it accepts. */
function answersOn(governing: Principle, rewound: Scenario, context: ResolveContext): readonly Action[] {
    const { outcome } = resolveGoverning(governing, rewound, context);
    return [
        outcome.action,
        ...(outcome.acceptable_alternatives ?? [])
            .map((alternative) => alternative.action)
            .filter((action): action is Action => action !== undefined),
    ];
}

/** Does one step of the line agree with what the source says at that earlier decision? */
function stepHoldsUp({ candidate, step, index, principles, context, thresholds }: StepCheck): boolean {
    if (step.actor !== 'hero' || step.street === undefined || step.street === 'preflop') return true;
    if (STREETS.indexOf(step.street) >= STREETS.indexOf(candidate.street)) return true;
    const acts = SAME_ACT[step.action];
    if (acts === undefined) return true;
    const rewound = rewind(candidate, step.street, candidate.nodePath.slice(0, index), thresholds);
    const governing = arbitrate(rewound, principles, context).governing;
    // Nothing governs the earlier decision, so the source states no answer
    // there and there is nothing for the story to contradict.
    if (governing === null) return true;
    return answersOn(governing, rewound, context).some((action) => acts.includes(action));
}

/**
 * Builds the check from a source's principles.
 *
 * `sprBrackets` is the source's own, for the same reason the generator takes
 * them: the rewound spot's stack-to-pot has to be bucketed by the boundaries
 * the rules were written against.
 */
export function lineFits(
    principles: readonly Principle[],
    context: ResolveContext,
    sprBrackets: Partial<SprThresholds> = {},
): LineFits {
    const thresholds = { ...DEFAULT_SPR_BRACKETS, ...sprBrackets };
    return (candidate) => candidate.nodePath.map(parseStep).every((step, index) =>
        stepHoldsUp({ candidate, step, index, principles, context, thresholds }));
}
