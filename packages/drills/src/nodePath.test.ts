import { describe, it, expect } from 'vitest';
import { describeStep, hasEarlierStep, parseStep, stepsMatch, stripActor } from './nodePath.ts';

/**
 * The `node_path` vocabulary: who acted is part of the step since 1.7, and
 * the matching has to stay lenient enough that every earlier encoding — and
 * every unprefixed quiz-hand action log — still means what it meant.
 */

describe('parsing a step', () => {
    it('reads street and action from an unprefixed token', () => {
        expect(parseStep('flop_bet')).toEqual({ actor: undefined, street: 'flop', action: 'bet', bare: 'flop_bet' });
    });

    it('reads the actor prefix and strips it from the bare form', () => {
        expect(parseStep('hero_turn_call')).toEqual({ actor: 'hero', street: 'turn', action: 'call', bare: 'turn_call' });
        expect(parseStep('villain_river_raise')).toMatchObject({ actor: 'villain', street: 'river', action: 'raise' });
    });

    it('keeps an action with its own underscore whole', () => {
        expect(parseStep('hero_preflop_3bet').action).toBe('3bet');
        expect(parseStep('river_all_in').action).toBe('all_in');
    });

    it('leaves a token that names no street as a bare action, never throwing', () => {
        expect(parseStep('limp')).toEqual({ actor: undefined, street: undefined, action: 'limp', bare: 'limp' });
        expect(stripActor('villain_limp')).toBe('limp');
    });
});

describe('matching a required step against a recorded one', () => {
    it('matches the same action on the same street', () => {
        expect(stepsMatch('flop_bet', 'flop_bet')).toBe(true);
        expect(stepsMatch('flop_bet', 'flop_call')).toBe(false);
        expect(stepsMatch('flop_bet', 'turn_bet')).toBe(false);
    });

    it('lets an unprefixed side match either actor — silence is not a contradiction', () => {
        expect(stepsMatch('flop_bet', 'hero_flop_bet')).toBe(true);
        expect(stepsMatch('villain_flop_bet', 'flop_bet')).toBe(true);
    });

    it('refuses two different actors once both are named', () => {
        expect(stepsMatch('hero_flop_bet', 'villain_flop_bet')).toBe(false);
        expect(stepsMatch('hero_flop_bet', 'hero_flop_bet')).toBe(true);
    });
});

describe('saying a step aloud', () => {
    it('gives a prefixed step a subject and the past tense', () => {
        expect(describeStep('hero_flop_bet')).toEqual({ street: 'flop', text: 'you bet' });
        expect(describeStep('villain_flop_call')).toEqual({ street: 'flop', text: 'they called' });
        expect(describeStep('hero_preflop_3bet').text).toBe('you 3-bet');
        expect(describeStep('villain_river_all_in').text).toBe('they went all in');
    });

    it('leaves an unprefixed step as the bare action it always was', () => {
        expect(describeStep('flop_bet')).toEqual({ street: 'flop', text: 'bet' });
        expect(describeStep('preflop_raise_and_call').text).toBe('raise and call');
    });
});

/**
 * "Is there an earlier decision of the hero's own to check?" — the question
 * the generator asks once per rule so that the rules with no earlier hero
 * action pay nothing for the line check that follows it.
 */
describe('an earlier step of one actor', () => {
    const line = ['hero_preflop_raise', 'hero_flop_bet', 'villain_flop_call', 'villain_turn_bet'];

    it('finds the hero on a street before the decision', () => {
        expect(hasEarlierStep(line, 'hero', 'turn')).toBe(true);
        expect(hasEarlierStep(line, 'hero', 'river')).toBe(true);
    });

    it('does not count the decision street itself', () => {
        expect(hasEarlierStep(line, 'hero', 'flop')).toBe(false);
    });

    it('does not count preflop, which has its own check', () => {
        expect(hasEarlierStep(['hero_preflop_raise'], 'hero', 'river')).toBe(false);
    });

    it('does not count the other actor', () => {
        expect(hasEarlierStep(['villain_flop_bet'], 'hero', 'turn')).toBe(false);
        expect(hasEarlierStep(['villain_flop_bet'], 'villain', 'turn')).toBe(true);
    });

    it('does not count a step that names no actor or no street', () => {
        expect(hasEarlierStep(['flop_bet'], 'hero', 'turn')).toBe(false);
        expect(hasEarlierStep(['hero_folds_a_lot'], 'hero', 'turn')).toBe(false);
    });

    it('is false for an empty line', () => {
        expect(hasEarlierStep([], 'hero', 'river')).toBe(false);
    });
});
