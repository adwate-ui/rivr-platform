/**
 * A turn spot and a compact row format shared by the hand-history test files.
 */
import { cardOrThrow as card } from '../cards/cards.ts';
import type { Scenario } from '../generator/types.ts';
import type { HistoryRow } from './types.ts';


/** The cutoff bet the flop, the big blind called, and the turn is checked to the hero. */
export const scenario = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'turn',
    heroPosition: 'CO',
    villainPosition: 'BB',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    potType: 'single_raised',
    playerCount: 'heads_up',
    stackBracket: 'standard',
    stakes: '2/5',
    postflopFacingState: 'facing_check',
    board: ['Qc', 'Jc', '8c', '2d'].map(card),
    hole: [card('Ac'), card('Tc')],
    holder: 'hero',
    boardTags: [],
    nodePath: ['hero_preflop_raise', 'hero_flop_bet', 'villain_flop_call'],
    potBb: 20,
    seed: 1,
    ...over,
});

/** A row as one line: `street:actor@seat action amount ?` (the `?` marks the action being answered). */
export const line = (row: HistoryRow): string => {
    const seat = row.seat === undefined ? '' : `@${row.seat}`;
    const amount = row.amountBb === undefined ? '' : ` ${row.amountBb}`;
    return `${row.street}:${row.actor}${seat} ${row.action}${amount}${row.pending === true ? ' ?' : ''}`;
};

/** The rows without the blind posts, which every preflop story opens with and which have their own test. */
export const story = (rows: readonly HistoryRow[]): string[] => rows.filter((row) => row.action !== 'posts').map(line);
