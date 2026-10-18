/**
 * The postflop streets of a spot, walked from its line.
 *
 * The authored steps are replayed street by street, growing the pot the way
 * the generator did, so the amounts agree with the pot in the middle. A bet is
 * three-quarters of the pot in front of it; a raise is three times the bet it
 * raises; a call answers a bet, and where the line names the caller but not the
 * bet, the bet was the other player's and is shown — "calls · checks" is not a
 * street anyone has played.
 */
import type { Position, Street } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import type { PathStep } from '../nodePath.ts';
import { BET_FRACTION, roundBb } from './sizing.ts';
import type { HistoryRow } from './types.ts';

/** The state the walk carries from street to street. */
export interface Walk {
    readonly scenario: Scenario;
    /** The pot in front of the current street's first bet, in blinds. */
    pot: number;
    /** The last bet or raise on the record, which a call or a raise answers. */
    lastBet: number;
}

/** One street of the walk: its rows so far, and whether anyone bet on it. */
export interface StreetPass {
    readonly walk: Walk;
    readonly street: Street;
    readonly rows: HistoryRow[];
    betThisStreet: boolean;
}

/** The actions that put a bet in front of the other players. */
export const BET_LIKE: ReadonlySet<string> = new Set(['bets', 'leads', 'raises to', 'moves all in']);

/** The verb for a step that already happened. */
const PAST: Readonly<Record<string, string>> = {
    bet: 'bets', call: 'calls', check: 'checks', raise: 'raises to', fold: 'folds', limp: 'limps',
    '3bet': '3-bets to', all_in: 'moves all in',
};

/**
 * Nothing is bet that is not behind. The effective stack is what the hero has
 * behind at the decision — the shallower of the two stacks — so it caps every
 * amount on either side of the street being answered.
 */
export const cappedBy = (scenario: Scenario, bb: number): number =>
    (scenario.effectiveStackBb === undefined ? bb : Math.min(bb, scenario.effectiveStackBb));

/** An amount that reaches the stack is the stack, and is said so. */
export const betWordFor = (scenario: Scenario, bb: number, word: string): string =>
    (scenario.effectiveStackBb !== undefined && bb >= scenario.effectiveStackBb ? 'moves all in' : word);

/**
 * The stack caps only the street being answered. What is behind is what is
 * behind NOW; a bet on an earlier street went in from a stack bigger by exactly
 * what has gone in since, so it can never have exceeded it. Capping it anyway
 * told a flop "moves all in 20" and then played the turn.
 */
const answering = (pass: StreetPass): boolean => pass.street === pass.walk.scenario.street;
const cap = (pass: StreetPass, bb: number): number => (answering(pass) ? cappedBy(pass.walk.scenario, bb) : bb);
const said = (pass: StreetPass, bb: number, word: string): string =>
    (answering(pass) ? betWordFor(pass.walk.scenario, bb, word) : word);

/** A row for a seat, attributed to whoever sits there. */
export function rowFor(pass: StreetPass, position: Position, action: string, amountBb?: number): HistoryRow {
    const { scenario } = pass.walk;
    const actor = position === scenario.heroPosition ? 'hero' : position === scenario.villainPosition ? 'villain' : 'field';
    return { street: pass.street, actor, seat: position, action, amountBb };
}

function stepRow(pass: StreetPass, step: PathStep, action: string, amountBb?: number): HistoryRow {
    const { scenario } = pass.walk;
    const seat = step.actor === 'hero' ? scenario.heroPosition : step.actor === 'villain' ? scenario.villainPosition : undefined;
    return { street: pass.street, actor: step.actor ?? 'unknown', seat, action, amountBb };
}

function replayBet(pass: StreetPass, step: PathStep): void {
    pass.walk.lastBet = cap(pass, roundBb(pass.walk.pot * BET_FRACTION));
    pass.rows.push(stepRow(pass, step, said(pass, pass.walk.lastBet, 'bets'), pass.walk.lastBet));
    pass.betThisStreet = true;
}

function replayRaise(pass: StreetPass, step: PathStep): void {
    const { walk } = pass;
    walk.lastBet = cap(pass, roundBb(walk.lastBet * 3 || walk.pot * BET_FRACTION * 3));
    pass.rows.push(stepRow(pass, step, said(pass, walk.lastBet, 'raises to'), walk.lastBet));
    pass.betThisStreet = true;
}

/** A call answers a bet; where the line names no bet, the other player made it. */
function replayCall(pass: StreetPass, step: PathStep): void {
    const { walk } = pass;
    const { scenario } = walk;
    const other = step.actor === 'hero' ? scenario.villainPosition : step.actor === 'villain' ? scenario.heroPosition : undefined;
    if (walk.lastBet === 0 && other !== undefined) {
        walk.lastBet = cap(pass, roundBb(walk.pot * BET_FRACTION));
        pass.rows.push(rowFor(pass, other, said(pass, walk.lastBet, 'bets'), walk.lastBet));
        pass.betThisStreet = true;
    }
    pass.rows.push(stepRow(pass, step, 'calls', walk.lastBet || undefined));
}

function replayAllIn(pass: StreetPass, step: PathStep): void {
    pass.walk.lastBet = pass.walk.scenario.effectiveStackBb ?? pass.walk.lastBet;
    pass.rows.push(stepRow(pass, step, 'moves all in', pass.walk.lastBet));
    pass.betThisStreet = true;
}

const REPLAY: ReadonlyMap<string, (pass: StreetPass, step: PathStep) => void> = new Map([
    ['bet', replayBet],
    ['raise', replayRaise],
    ['call', replayCall],
    ['all_in', replayAllIn],
]);

/** One authored step, added to its street's rows. */
export function replayStep(pass: StreetPass, step: PathStep): void {
    const replay = REPLAY.get(step.action);
    if (replay !== undefined) {
        replay(pass, step);
        return;
    }
    pass.rows.push(stepRow(pass, step, PAST[step.action] ?? step.action.replace(/_/g, ' ')));
}
