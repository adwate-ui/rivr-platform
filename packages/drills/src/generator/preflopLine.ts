/**
 * What the hero did preflop, when the path does not say.
 *
 * Two readers need the same answer and must not disagree: the hand history,
 * which has to name a preflop raiser before it can tell the story, and the
 * generator, which has to know whether the hero raised, called or 3-bet
 * before it can deal them a hand the source's own preflop rules would have
 * played that way. For a long time only the history asked, and the
 * generator dealt Q-4 offsuit to a hero the history then showed opening
 * under the gun: a spot that contradicts the source's preflop advice while
 * drilling its postflop advice.
 *
 * The inference is the history's: the path's own preflop steps first, then
 * the first postflop step that implies an aggressor (whoever bet first
 * postflop usually raised first preflop; whoever called first was bet
 * into), then the pending facing state.
 */

import type { PlayerCount, PotType, PostflopFacingState, Street } from '../ontology/types.ts';
import { parseStep, type Actor, type PathStep } from '../nodePath.ts';

/** The hero's preflop action, as the source's range rules name actions. */
export type HeroPreflopAction = 'raise' | '3bet' | 'call' | 'limp' | 'none';

/** The coordinates the inference reads — a Scenario has them all. */
export interface PreflopLineInput {
    readonly street: Street;
    readonly potType?: PotType | undefined;
    readonly playerCount?: PlayerCount | undefined;
    readonly postflopFacingState?: PostflopFacingState | undefined;
    readonly nodePath: readonly string[];
}

/** The hero's own preflop steps, in the order they decide the answer. */
const HERO_STEPS = ['3bet', 'raise', 'limp', 'call'] as const;

/** The first postflop step that names an aggressor, if any. */
function aggressorFromSteps(steps: readonly PathStep[]): Actor | undefined {
    for (const step of steps) {
        if (step.street === 'preflop' || step.actor === undefined) continue;
        if (step.action === 'bet' || step.action === 'raise' || step.action === 'all_in') return step.actor;
        if (step.action === 'call') return step.actor === 'hero' ? 'villain' : 'hero';
    }
    return undefined;
}

/**
 * Who took the initiative preflop, when the path does not say.
 *
 * The first postflop step that implies an aggressor names the likely preflop
 * raiser: whoever BET first postflop usually raised first preflop (a c-bet),
 * and whoever CALLED first was bet into by the other side. Failing that, the
 * pending facing state: a bet or raise arriving at the hero came from the
 * opponent with the initiative; a donk lead is by definition INTO the raiser,
 * so the hero has it; checked to the hero or first to act, the hero is the
 * one deciding whether to continue — the c-bettor's seat.
 */
export function impliedAggressor(
    facing: PostflopFacingState | undefined,
    steps: readonly PathStep[],
): Actor {
    const fromSteps = aggressorFromSteps(steps);
    if (fromSteps !== undefined) return fromSteps;
    return facing === 'facing_bet' || facing === 'facing_raise' ? 'villain' : 'hero';
}

/** The answer the path's own preflop steps give, or undefined where they name none. */
function fromPreflopSteps(steps: readonly PathStep[], potType: PotType | undefined): HeroPreflopAction | undefined {
    const took = (actor: Actor, action: string): boolean =>
        steps.some((step) => step.street === 'preflop' && step.actor === actor && step.action === action);
    const heroAction = HERO_STEPS.find((action) => took('hero', action));
    if (heroAction !== undefined) return heroAction;
    if (took('villain', '3bet')) return 'raise';
    if (took('villain', 'raise')) return potType === 'three_bet' || potType === 'four_bet_plus' ? '3bet' : 'call';
    if (took('villain', 'limp')) return potType === 'limped' ? 'limp' : 'raise';
    return undefined;
}

function fromPotType(potType: PotType | undefined, aggressor: Actor): HeroPreflopAction {
    switch (potType) {
        case 'limped':
            return 'limp';
        case 'single_raised':
            return aggressor === 'hero' ? 'raise' : 'call';
        case 'three_bet':
        case 'four_bet_plus':
            return aggressor === 'hero' ? '3bet' : 'raise';
        default:
            return 'none';
    }
}

/**
 * What the hero did preflop.
 *
 * The path's own preflop steps decide where they exist. Otherwise the pot
 * type and the implied aggressor decide: in a limped pot everyone limped; in
 * a single-raised pot the aggressor opened and the other player called; in a
 * re-raised pot the aggressor is the re-raiser and the other player opened
 * (and called the re-raise — their hand is still one they OPENED with, which
 * is the range that constrains it). Preflop spots and unopened pots have no
 * prior action to name.
 */
export function heroPreflopAction(spot: PreflopLineInput): HeroPreflopAction {
    if (spot.street === 'preflop') return 'none';
    const steps = spot.nodePath.map(parseStep);
    return fromPreflopSteps(steps, spot.potType)
        ?? fromPotType(spot.potType, impliedAggressor(spot.postflopFacingState, steps));
}
