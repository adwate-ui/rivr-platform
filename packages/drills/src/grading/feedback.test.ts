import { describe, it, expect } from 'vitest';
import { explain, NEUTRAL_FALLBACK } from './feedback.ts';
import { context, principle, resolved, scenario } from './fixtures.ts';

/**
 * The sentence a reader gets after answering: a lookup into authored feedback,
 * never a generation, with a neutral fallback so a wrong answer is never met
 * with silence.
 */

describe('the sentence the reader gets', () => {
    const resolution = () => resolved(principle(), scenario(), context());

    it('uses the source\'s own words when they were written', () => {
        const result = explain(
            principle(),
            { klass: 'too_passive', correct: false, secondary: false },
            resolution(),
        );
        expect(result.text).toBe('Bet it.');
        expect(result.authored).toBe(true);
    });

    it('uses the authored correct text on a right answer', () => {
        expect(explain(principle(), { klass: 'correct', correct: true, secondary: false }, resolution()).text)
            .toBe('Right.');
    });

    it('falls back rather than showing nothing when the key was not authored', () => {
        const result = explain(
            principle(),
            { klass: 'too_loose', correct: false, secondary: false },
            resolution(),
        );
        expect(result.text).toBe(NEUTRAL_FALLBACK.too_loose);
        expect(result.authored).toBe(false);
    });

    it('reads the feedback on the outcome first, so a rule with two right answers gives two reasons', () => {
        // A rule that bets most hands and checks the rest needs a `correct`
        // sentence for each side; one written for the bet would tell a reader
        // who correctly checked why betting was good.
        const checkFeedback = { correct: 'Nothing to bet with.', too_aggressive: 'Not this hand.' };
        const twoSided = principle({
            rule: {
                kind: 'predicate',
                situation: { street: 'flop' },
                branches: [{ when: { hand_class_any: ['no_pair'] }, then: { action: 'check', feedback: checkFeedback } }],
                default: { action: 'bet', sizing: 'medium' },
            },
            feedback: { correct: 'Bet the flop.', too_passive: 'Bet it.', too_aggressive: 'Slow down.' },
        });
        const checkSide = { ...resolution(), outcome: { action: 'check' as const, feedback: checkFeedback } };
        expect(explain(twoSided, { klass: 'correct', correct: true, secondary: false }, checkSide).text).toBe('Nothing to bet with.');
        // An error key the outcome overrides, and one it leaves to the principle.
        expect(explain(twoSided, { klass: 'too_aggressive', correct: false, secondary: false }, checkSide).text).toBe('Not this hand.');
        expect(explain(twoSided, { klass: 'too_passive', correct: false, secondary: false }, checkSide).text).toBe('Bet it.');
        // The other side reads the principle's own.
        const betSide = { ...resolution(), outcome: { action: 'bet' as const, sizing: 'medium' as const } };
        expect(explain(twoSided, { klass: 'correct', correct: true, secondary: false }, betSide).text).toBe('Bet the flop.');
    });

    it('treats blank authored text as absent', () => {
        const blank = principle({ feedback: { correct: 'Right.', too_passive: '   ' } });
        expect(explain(blank, { klass: 'too_passive', correct: false, secondary: false }, resolution()).authored)
            .toBe(false);
    });

    it('always carries the rationale and how the answer was reached', () => {
        const result = explain(principle(), { klass: 'correct', correct: true, secondary: false }, resolution());
        expect(result.rationale).toBe('Because.');
        expect(result.provenance).toContain('branch');
    });

    it('says so when the answer was a secondary line', () => {
        const result = explain(principle(), { klass: 'correct', correct: true, secondary: true }, resolution());
        expect(result.secondaryNote).toContain('acceptable');
    });

    it('has a fallback for every error class', () => {
        Object.values(NEUTRAL_FALLBACK).forEach((text) => expect(text.length).toBeGreaterThan(0));
    });
});
