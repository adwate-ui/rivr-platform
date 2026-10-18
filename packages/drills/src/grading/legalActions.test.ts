import { describe, it, expect } from 'vitest';
import type { Action, Outcome, Position, PreflopFacingState } from '../ontology/types.ts';
import { facesABet, legalActionSets, reachableErrorClasses } from './classifyError.ts';

/**
 * What the pad offers, and therefore which mistakes a reader can make at all.
 */

describe('which actions are even legal', () => {
    it('always has a bet to face preflop, because the blinds are posted', () => {
        // An unopened pot is still one you fold, call or raise into — there is
        // nothing to check behind, and offering Check for a button open is a
        // vocabulary no player uses.
        expect(facesABet({ street: 'preflop', postflopFacingState: undefined })).toBe(true);
    });

    it.each([
        ['facing_bet', true],
        ['facing_raise', true],
        ['facing_donk', true],
        ['facing_check', false],
        ['first_to_act', false],
    ] as const)('reads %s postflop as %s', (postflopFacingState, expected) => {
        expect(facesABet({ street: 'flop', postflopFacingState })).toBe(expected);
    });

    it('faces nothing postflop when no state was recorded', () => {
        expect(facesABet({ street: 'river', postflopFacingState: undefined })).toBe(false);
    });
});

describe('what the big blind is facing preflop', () => {
    /**
     * Nearly every preflop spot faces a bet, because the blinds are posted.
     * The big blind with no raise in front is the exception: a rule that checks
     * its option with the hands it does not raise would be unanswerable on a pad
     * offering only Fold/Call/Raise, and the reader would be marked wrong
     * whichever button they pressed.
     */
    const preflop = (heroPosition: Position, preflopFacingState: PreflopFacingState): boolean => facesABet({
        street: 'preflop',
        postflopFacingState: undefined,
        heroPosition,
        preflopFacingState,
    });

    it('lets the big blind check an unopened or limped pot', () => {
        expect(preflop('BB', 'unopened')).toBe(false);
        expect(preflop('BB', 'facing_limp')).toBe(false);
    });

    it('still faces a bet in the big blind once someone raises', () => {
        expect(preflop('BB', 'facing_raise')).toBe(true);
        expect(preflop('BB', 'facing_3bet')).toBe(true);
    });

    it('faces a bet everywhere else, blinds posted', () => {
        expect(preflop('BTN', 'unopened')).toBe(true);
        expect(preflop('SB', 'facing_limp')).toBe(true);
        expect(preflop('CO', 'unopened')).toBe(true);
    });

    it('faces a bet when the hand never said where the hero sat', () => {
        // Unstated means unknown, so it cannot be the one seat that checks.
        expect(facesABet({ street: 'preflop', postflopFacingState: undefined })).toBe(true);
    });
});

/**
 * Which mistakes a rule can produce, without generating a spot.
 *
 * The validator asks this of every principle and demands the source's own
 * sentence for each answer. That is only fair if the set is SHARP: "at least
 * one error key" would let a principle ship with a mistake the reader could
 * make and nothing to say about it, and "author all six" would be the opposite
 * error, demanding paragraphs nobody will ever be shown.
 */
describe('the mistakes an outcome can produce', () => {
    const facing: readonly Action[] = ['fold', 'call', 'raise'];
    const open: readonly Action[] = ['check', 'bet'];
    const classes = (outcome: Outcome, legal: readonly Action[]): string[] =>
        [...reachableErrorClasses(outcome, legal)].sort();

    it('reaches two mistakes for a call, not six', () => {
        expect(classes({ action: 'call', sizing: 'unspecified' }, facing))
            .toEqual(['too_aggressive', 'too_tight']);
    });

    it('adds wrong_sizing only where the source stated a size', () => {
        expect(classes({ action: 'bet', sizing: 'unspecified' }, open)).toEqual(['too_passive']);
        expect(classes({ action: 'bet', sizing: 'large' }, open))
            .toEqual(['too_passive', 'wrong_sizing']);
    });

    it('does not call a line the source allowed a mistake', () => {
        // A source that lists raising among the acceptable answers has said so,
        // and the engine must not contradict the source it grades against.
        expect(classes({
            action: 'call',
            sizing: 'unspecified',
            acceptable_alternatives: [{ action: 'raise', sizing: 'unspecified' }],
        }, facing)).toEqual(['too_tight']);
    });

    it('asks nothing of an outcome the reader cannot even give', () => {
        // A rule answering `check` while the pad offers fold/call/raise is
        // unwinnable, which is a worse fault with its own gate. Demanding
        // feedback keys for it would be beside the point.
        expect(classes({ action: 'check', sizing: 'unspecified' }, facing)).toEqual([]);
    });
});

describe('every pad a situation can put in front of the reader', () => {
    it('gives one set where the situation pins the spot', () => {
        expect(legalActionSets({ street: 'flop', postflop_facing_state: ['facing_bet'] }))
            .toEqual([['fold', 'call', 'raise']]);
    });

    it('gives both where it pins neither street nor facing state', () => {
        // A rule this loose really can put the reader in front of either pad,
        // so a requirement derived from only one of them would be a
        // requirement about some of the spots.
        const sets = legalActionSets({});
        expect(sets).toContainEqual(['check', 'bet']);
        expect(sets).toContainEqual(['fold', 'call', 'raise']);
    });

    it('finds the pad the big blind gets, which is neither of the other two', () => {
        expect(legalActionSets({
            street: 'preflop', hero_position: ['BB'], preflop_facing_state: ['unopened'],
        })).toEqual([['check', 'raise']]);
    });

    it('admits nothing from a situation that contradicts itself', () => {
        // Stage 4 owns this fault and says so far more clearly than a silence
        // downstream would.
        expect(legalActionSets({ street: 'flop', postflop_facing_state: [] })).toEqual([]);
    });
});
