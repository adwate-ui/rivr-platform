/**
 * The answers a reader can actually give, which is not the ontology's action list.
 *
 * The answer pad offers check/bet when unopened and fold/call/raise when facing
 * a bet, with sizings on the two actions that put chips in. Deriving a floor
 * from that real choice set is the difference between a figure that bounds
 * guessing and one that only sounds like it does.
 */
import type { Action, Outcome, SizingBucket } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { legalActions } from '../grading/classifyError.ts';
import { PAD_SIZINGS, takesSizing } from '../grading/pad.ts';

/** One button press: an action, and a size where the action takes one. */
export interface PadAnswer {
    readonly action: Action;
    readonly sizing?: SizingBucket | undefined;
}

const OPEN_ACTIONS: readonly Action[] = ['check', 'bet'];
const FACING_ACTIONS: readonly Action[] = ['fold', 'call', 'raise'];

/** Actions the pad offers in SOME facing state. Anything else it can never say. */
export const EVER_OFFERED: readonly Action[] = [...OPEN_ACTIONS, ...FACING_ACTIONS];

/** Every distinct answer the pad can produce for this spot. */
export function answerLeaves(scenario: Scenario): PadAnswer[] {
    return legalActions(scenario).flatMap((action) => (takesSizing(action)
        ? PAD_SIZINGS.map((sizing) => ({ action, sizing }))
        : [{ action }]));
}

/**
 * Would this answer be graded correct against the source's? The same rule the
 * harness applies: the action must match, and the sizing only has to match
 * where the source stated one.
 */
export const gradesCorrect = (answer: PadAnswer, author: Outcome): boolean => answer.action === author.action
    && (author.sizing === undefined || author.sizing === 'unspecified' || answer.sizing === author.sizing);
