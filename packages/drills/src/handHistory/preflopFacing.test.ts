import { describe, it, expect } from 'vitest';
import type { Scenario } from '../generator/types.ts';
import { handHistory, smallBlindBb } from '../handHistory.ts';
import { line, scenario, story } from './fixtures.ts';

/**
 * A preflop spot's history: the blinds, what the hero is facing, and what each
 * seat has in front of it.
 */

describe('a preflop spot', () => {
    const preflop = (state: Scenario['preflopFacingState'], size?: Scenario['villainRaiseSize'], over: Partial<Scenario> = {}) => handHistory(scenario({
        street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState: state,
        villainRaiseSize: size, nodePath: [], potBb: undefined, heroPosition: 'BB', villainPosition: 'UTG1', villainPositions: ['UTG1'],
        ...over,
    }));

    it('says what the hero is facing as the pending action, sized by the bucket', () => {
        expect(story(preflop('unopened', undefined, { villainPosition: undefined, villainPositions: [] }).rows)).toEqual(['preflop:field fold to you ?', 'preflop:field@SB folds']);
        expect(story(preflop('facing_limp').rows)).toEqual(['preflop:villain@UTG1 limps 1 ?', 'preflop:field@SB folds']);
        expect(story(preflop('facing_raise', 'small').rows)).toEqual(['preflop:villain@UTG1 raises to 2.5 ?', 'preflop:field@SB folds']);
        expect(story(preflop('facing_steal', 'large').rows)).toEqual(['preflop:villain@UTG1 raises to 5 ?', 'preflop:field@SB folds']);
        expect(story(preflop('facing_raise', 'all_in').rows)).toEqual(['preflop:villain@UTG1 raises to 3 ?', 'preflop:field@SB folds']);
        // The small blind folds at their turn: to the open, before the 3-bet
        // lands; to the 3-bet, before the 4-bet lands.
        expect(story(preflop('facing_3bet', undefined, { heroPosition: 'CO', villainPosition: 'BB', villainPositions: ['BB'] }).rows)).toEqual([
            'preflop:hero@CO raises to 3', 'preflop:field@SB folds', 'preflop:villain@BB 3-bets to 9 ?',
        ]);
        expect(story(preflop('facing_4bet', undefined, { heroPosition: 'CO', villainPosition: 'BB', villainPositions: ['BB'] }).rows)).toEqual([
            'preflop:villain@BB raises to 3', 'preflop:hero@CO 3-bets to 9', 'preflop:field@SB folds', 'preflop:villain@BB 4-bets to 22 ?',
        ]);
        // No facing state is a degenerate, hand-built spot; the folded small
        // blind is still on the record.
        expect(story(preflop(undefined).rows)).toEqual(['preflop:field@SB folds']);
    });

    it('names every caller behind the raise, one row each, the last of them the action being answered', () => {
        const { rows, bets, potBb } = preflop('facing_raise_and_call', 'standard', { villainPositions: ['UTG1', 'LJ', 'UTG2', 'SB'] });
        expect(story(rows)).toEqual([
            'preflop:villain@UTG1 raises to 3',
            'preflop:field@UTG2 calls 3',
            'preflop:field@LJ calls 3',
            'preflop:field@SB calls 3 ?',
        ]);
        // Every chip is in front of somebody — the raise, the calls, and the
        // blinds posted; the hero's own big blind stays in front of the hero —
        // and the middle reads all of it.
        expect(bets).toEqual({ UTG1: 3, UTG2: 3, LJ: 3, SB: 3, BB: 1 });
        expect(potBb).toBe(13);
    });

    it('lists the limpers ahead of the limp being answered, and the callers of a raise the hero is 3-bet over', () => {
        expect(story(preflop('facing_limp', undefined, { villainPositions: ['UTG1', 'UTG'] }).rows)).toEqual([
            'preflop:field@UTG limps 1', 'preflop:villain@UTG1 limps 1 ?', 'preflop:field@SB folds',
        ]);
        expect(story(preflop('facing_3bet', undefined, { heroPosition: 'CO', villainPosition: 'BB', villainPositions: ['BB', 'BTN'] }).rows)).toEqual([
            'preflop:hero@CO raises to 3', 'preflop:field@BTN calls 3', 'preflop:field@SB folds', 'preflop:villain@BB 3-bets to 9 ?',
        ]);
    });

    it('puts the pending raise in front of the raiser and the blinds in front of the blinds', () => {
        const { bets, potBb } = preflop('facing_raise', 'standard');
        expect(bets).toEqual({ UTG1: 3, SB: 0.4, BB: 1 });
        expect(potBb).toBe(4.4);
        expect(preflop('unopened', undefined, { villainPosition: undefined, villainPositions: [] }).bets).toEqual({ SB: 0.4, BB: 1 });
    });
});

describe('the blinds', () => {
    it('are always posted — at what the stakes actually take — and a folded blind folds on the record', () => {
        const preflop = handHistory(scenario({
            street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState: 'facing_raise',
            heroPosition: 'BB', villainPosition: 'UTG1', villainPositions: ['UTG1'], nodePath: [], potBb: undefined,
        }));
        // At 2/5 the small blind is two of five — 0.4 of the big blind, not half.
        expect(preflop.rows.slice(0, 2).map(line)).toEqual(['preflop:field@SB posts 0.4', 'preflop:hero@BB posts 1']);
        // Postflop both posts are still the start of the story: a blind who
        // folded left dead money in the pot, and the fold is on the record.
        const postflop = handHistory(scenario());
        expect(postflop.rows.slice(0, 2).map(line)).toEqual(['preflop:field@SB posts 0.4', 'preflop:villain@BB posts 1']);
        expect(postflop.rows.some((row) => row.seat === 'SB' && row.action === 'folds')).toBe(true);
        const neither = handHistory(scenario({ villainPosition: 'BTN', villainPositions: ['BTN'] }));
        expect(neither.rows.filter((row) => row.action === 'posts')).toHaveLength(2);
        expect(neither.rows.filter((row) => row.action === 'folds').map((row) => row.seat)).toEqual(['SB', 'BB']);
    });

    it('post half a blind only where the spot states no stakes at all', () => {
        expect(smallBlindBb(undefined)).toBe(0.5);
        expect(smallBlindBb('2/5')).toBe(0.4);
        expect(smallBlindBb('1/2')).toBe(0.5);
        expect(smallBlindBb('5/10')).toBe(0.5);
        expect(smallBlindBb('nonsense')).toBe(0.5);
    });
});
