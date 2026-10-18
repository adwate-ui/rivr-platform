/**
 * Naming the mistake.
 *
 * Deterministic, by table. The point of the whole feature is that feedback is
 * AUTHORED once per principle and keyed by error type — so the only job here is
 * to decide which key, and it must be decidable from the answer alone.
 *
 * **The legal action set depends on what the hero is facing**, which is what
 * collapses the naive 5x5 into two small tables and makes the rest
 * unreachable rather than merely unlikely:
 *
 * Facing no bet — legal {check, bet}:
 *
 *   submitted \ correct   check            bet
 *   check                 correct          too_passive
 *   bet                   too_aggressive   correct / wrong_sizing
 *
 * Facing a bet — legal {fold, call, raise}:
 *
 *   submitted \ correct   fold           call                    raise
 *   fold                  correct        too_tight               too_tight
 *   call                  too_loose      correct / wrong_sizing  too_passive
 *   raise                 too_loose      too_aggressive          correct / wrong_sizing
 *
 * `right_idea_wrong_spot` is deliberately NOT a function of (submitted,
 * correct) alone — see below. Treating it as a sixth synonym for "wrong" wastes
 * the most teachable label available.
 */

import type { Action, Outcome, Principle, SizingBucket } from '../ontology/types.ts';
import { PAD_SIZINGS, takesSizing } from './pad.ts';
import type { Scenario } from '../generator/types.ts';
import { effectiveRule, type Resolution } from './resolution.ts';
import { matchesSituation } from './match.ts';

export { facesABet, legalActionSets, legalActions } from './legalActions.ts';

export type ErrorClass =
    | 'correct'
    | 'too_loose'
    | 'too_tight'
    | 'too_passive'
    | 'too_aggressive'
    | 'wrong_sizing'
    | 'right_idea_wrong_spot'
    /**
     * The reader picked a label the source does not give for this spot (1.9).
     *
     * One class rather than a pair, unlike the action side's too_loose and
     * too_tight: labels are a per-rule partition with no ordering, so there is
     * no direction to be wrong in. A source that wants to say more about one
     * label writes it on that outcome's own feedback.
     */
    | 'wrong_label'
    /**
     * The reader's count was under or over (2.0). A pair, unlike `wrong_label`,
     * because a count does have a direction, and a source can say something
     * useful about each.
     */
    | 'too_few'
    | 'too_many';

/**
 * The verdict, in words.
 *
 * Beside the union so every screen that names an error class uses the same
 * phrase. Six of the seven are failures and several are near-misses, which is
 * why the wording is a phrase rather than a label.
 */
export const ERROR_CLASS_LABEL: Readonly<Record<ErrorClass, string>> = {
    correct: 'Correct',
    too_loose: 'Too loose',
    too_tight: 'Too tight',
    too_passive: 'Too passive',
    too_aggressive: 'Too aggressive',
    wrong_sizing: 'Right action, wrong size',
    right_idea_wrong_spot: 'Right idea, wrong spot',
    wrong_label: 'Not how the source reads it',
    too_few: 'Fewer than the range holds',
    too_many: 'More than the range holds',
};

export interface Answer {
    readonly action: Action;
    readonly sizing?: SizingBucket | undefined;
}

export interface Grade {
    readonly klass: ErrorClass;
    readonly correct: boolean;
    /** True where the answer matched an `acceptable_alternatives` entry. */
    readonly secondary: boolean;
    /** Set when `right_idea_wrong_spot` fires: the one coordinate that differs. */
    readonly confusedWithSlot?: string | undefined;
}

/** Passive to aggressive. Used only for the directional labels. */
const AGGRESSION: Readonly<Record<Action, number>> = {
    fold: 0, check: 1, call: 2, limp: 2, bet: 3, raise: 4, all_in: 5,
};

/** The actions on the pad when the hero faces a bet. */
const FACING_BET_ACTIONS: ReadonlySet<Action> = new Set(['fold', 'call', 'raise']);

/** A size the source actually stated. `unspecified` is an action with no size. */
const isStated = (sizing: SizingBucket | undefined): sizing is Exclude<SizingBucket, 'unspecified'> =>
    sizing !== undefined && sizing !== 'unspecified';

/**
 * Does the answer fit this action and size? Sizing is graded ONLY where the
 * source specified one; grading a size against `unspecified` would invent a
 * standard the source never set. An unanswered size counts as `unspecified`.
 */
const fits = (answer: Answer, target: { readonly action?: Action; readonly sizing?: SizingBucket }): boolean =>
    answer.action === target.action
    && (!isStated(target.sizing) || (answer.sizing ?? 'unspecified') === target.sizing);

/** Does the answer match the outcome, or one the source called acceptable? */
function matchQuality(answer: Answer, outcome: Outcome): 'exact' | 'secondary' | 'wrong-sizing' | 'no' {
    if (fits(answer, outcome)) return 'exact';
    // Checked BEFORE any sizing verdict. A source that lists "bet large" among
    // the acceptable lines has said that line is fine; calling it a sizing
    // error would be the engine contradicting the source it grades against.
    if ((outcome.acceptable_alternatives ?? []).some((alternative) => fits(answer, alternative))) return 'secondary';
    return answer.action === outcome.action ? 'wrong-sizing' : 'no';
}

/** The facing-a-bet table's named cells; undefined where aggression order decides. */
function facingBetClass(submitted: Action, correct: Action): ErrorClass | undefined {
    if (submitted === 'fold') return 'too_tight';
    if (correct === 'fold') return 'too_loose';
    if (submitted === 'call' && correct === 'raise') return 'too_passive';
    if (submitted === 'raise' && correct === 'call') return 'too_aggressive';
    return undefined;
}

/** The directional label, from the two facing-state tables above. */
function directionalClass(submitted: Action, correct: Action): ErrorClass {
    const facingBet = FACING_BET_ACTIONS.has(correct) || FACING_BET_ACTIONS.has(submitted);
    const named = facingBet ? facingBetClass(submitted, correct) : undefined;
    return named ?? (AGGRESSION[submitted] > AGGRESSION[correct] ? 'too_aggressive' : 'too_passive');
}

/**
 * Did the hero play this as if it were a DIFFERENT spot the same rule covers?
 *
 * Cross-scenario, which is why it cannot come from the table. When the answer
 * is wrong, look for another branch of the same rule whose outcome is exactly
 * what was submitted; if there is exactly one and it differs from the branch
 * that fired in at most one coordinate, the reader was right about the rule and
 * wrong about which case they were in. That is the sentence the whole feature
 * exists to produce — "you played this as if it were a three-bet pot" — so it
 * takes precedence over the directional labels when it fires.
 */
function findConfusedSlot(principle: Principle, scenario: Scenario, answer: Answer): string | undefined {
    const { rule } = effectiveRule(principle);
    if (rule.kind !== 'predicate') return undefined;

    const fired = rule.branches.find((branch) => matchesSituation(scenario, branch.when));
    if (fired === undefined) return undefined;

    const candidates = rule.branches.filter((branch) => branch !== fired && branch.then.action === answer.action);
    const [other] = candidates;
    if (candidates.length !== 1 || other === undefined) return undefined;

    const firedSlots = new Map(Object.entries(fired.when));
    const otherSlots = new Map(Object.entries(other.when));
    const keys = new Set([...firedSlots.keys(), ...otherSlots.keys()]);
    const differing = [...keys].filter((key) =>
        JSON.stringify(firedSlots.get(key) ?? null) !== JSON.stringify(otherSlots.get(key) ?? null));

    return differing.length === 1 ? differing[0] : undefined;
}

/**
 * Which mistakes can this outcome actually produce?
 *
 * Written for the validator, which has to demand feedback for every wrong
 * answer a reader can give WITHOUT generating any spots. It answers by running
 * the real grader's own two functions over every button combination the pad
 * offers, so it cannot drift from what the reader will actually be told: change
 * the tables above and this changes with them.
 *
 * Sharp, not blanket. Most outcomes reach one or two of the six — an outcome of
 * `call` facing a bet reaches `too_tight` and `too_aggressive` and nothing
 * else, and `wrong_sizing` is unreachable unless the source stated a size.
 *
 * `right_idea_wrong_spot` is deliberately absent: it depends on the other
 * branches of the rule AND on which one fired, so it is not a property of an
 * outcome. It stays optional — the label that says something extra when it
 * fires, never the only thing a reader gets.
 *
 * An outcome whose own action is not on the pad returns the empty set. That is
 * a rule the reader cannot get right at all, a worse fault with its own gate
 * (the winnable gate); asking it for feedback keys would be beside the point.
 */
export function reachableErrorClasses(
    outcome: Outcome,
    legal: readonly Action[],
): ReadonlySet<ErrorClass> {
    const classes = new Set<ErrorClass>();
    if (!legal.includes(outcome.action)) return classes;

    for (const action of legal) {
        for (const sizing of takesSizing(action) ? PAD_SIZINGS : [undefined]) {
            const quality = matchQuality({ action, sizing }, outcome);
            if (quality === 'exact' || quality === 'secondary') continue;
            classes.add(quality === 'wrong-sizing' ? 'wrong_sizing' : directionalClass(action, outcome.action));
        }
    }

    return classes;
}

/** Grades an action answer against the resolved outcome and names the mistake. */
export function classifyError(
    answer: Answer,
    resolution: Resolution,
    scenario: Scenario,
    principle: Principle,
): Grade {
    const quality = matchQuality(answer, resolution.outcome);

    if (quality === 'exact') return { klass: 'correct', correct: true, secondary: false };
    if (quality === 'secondary') return { klass: 'correct', correct: true, secondary: true };
    if (quality === 'wrong-sizing') return { klass: 'wrong_sizing', correct: false, secondary: false };

    const confusedWithSlot = findConfusedSlot(principle, scenario, answer);
    if (confusedWithSlot !== undefined) {
        return { klass: 'right_idea_wrong_spot', correct: false, secondary: false, confusedWithSlot };
    }

    return {
        klass: directionalClass(answer.action, resolution.outcome.action),
        correct: false,
        secondary: false,
    };
}
