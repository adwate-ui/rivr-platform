import { describe, it, expect } from 'vitest';
import { describeAnswer, describeOutcome, labelText, sizingHints } from './pad.ts';

/**
 * How an answer is written where a reader can see it.
 *
 * Worth its own file because the failure is a slow one: three screens each
 * formatting an answer themselves is how "Raise (large)" on the pad becomes
 * "raise_large" on the review page, and nobody notices until somebody reads
 * both in the same minute.
 */

const LABELS = [
    { id: 'strong_fit', label: 'Strong fit' },
    { id: 'weak_fit', label: 'Weak fit' },
];

describe('naming a label', () => {
    it('shows the source\'s words, not the id that is stored', () => {
        // The split exists so a source can reword a label without invalidating
        // every attempt already recorded under the old words.
        expect(labelText('strong_fit', LABELS)).toBe('Strong fit');
        expect(labelText('weak_fit', LABELS)).toBe('Weak fit');
    });

    it('falls back to the id when no label matches it', () => {
        // A validator error (UNKNOWN_LABEL) rather than a normal state. This is
        // what a reader sees between a bad encoding shipping and the gate
        // catching it: ugly, and better than an empty button.
        expect(labelText('missing', LABELS)).toBe('missing');
        expect(labelText('strong_fit', [])).toBe('strong_fit');
    });
});

describe('naming any answer', () => {
    it('writes an action the way the pad writes it', () => {
        expect(describeAnswer({ kind: 'action', action: 'raise', sizing: 'large' }))
            .toBe(describeOutcome({ action: 'raise', sizing: 'large' }));
        expect(describeAnswer({ kind: 'action', action: 'fold' }))
            .toBe(describeOutcome({ action: 'fold' }));
    });

    it('drops a sizing that says nothing', () => {
        expect(describeAnswer({ kind: 'action', action: 'bet', sizing: 'unspecified' }))
            .not.toContain('(');
        expect(describeAnswer({ kind: 'action', action: 'check' })).not.toContain('(');
    });

    it('writes a label in the source\'s words', () => {
        expect(describeAnswer({ kind: 'classify', label: 'strong_fit', labels: LABELS }))
            .toBe('Strong fit');
    });

    it('writes a count with what it is out of, where that is known', () => {
        // A bare "24" says nothing about whether that is most of the range or a
        // corner of it.
        expect(describeAnswer({ kind: 'count', value: 24, of: 40 })).toBe('24 of 40');
    });

    it('writes a bare count when the denominator is not in hand', () => {
        // The reader's own answer has no denominator: they said a number.
        expect(describeAnswer({ kind: 'count', value: 21 })).toBe('21');
        expect(describeAnswer({ kind: 'count', value: 0 })).toBe('0');
    });

    it('never leaves an answer blank, whichever kind it is', () => {
        const written = [
            describeAnswer({ kind: 'action', action: 'call' }),
            describeAnswer({ kind: 'classify', label: 'nope', labels: LABELS }),
            describeAnswer({ kind: 'count', value: 0 }),
        ];
        expect(written.every((text) => text.trim().length > 0)).toBe(true);
    });
});

describe('what the sizes on the pad mean', () => {
    const source = {
        bet_size_brackets: { small_max: 0.5, standard_max: 0.64 },
        raise_size_brackets: { small_max: 2.5, standard_max: 4 },
    };

    it('reads pot fractions off the source postflop and pot multiples preflop', () => {
        expect(sizingHints('flop', source)).toEqual({
            small: 'up to 50% of the pot', medium: '51–64%', large: 'over 64%',
        });
        // Multiples of THE POT, not of the blind. A live open of several big
        // blinds would read as large against the blind; against the pot it
        // raises into it is standard, which is what the source means.
        expect(sizingHints('preflop', source)).toEqual({
            small: 'up to 2.5× the pot', medium: '2.5–4× the pot', large: 'over 4× the pot',
        });
    });

    it('says nothing for a source that states no brackets, rather than inventing them', () => {
        expect(sizingHints('turn', {})).toEqual({});
        expect(sizingHints('preflop', { raise_size_brackets: { small_max: 3 } })).toEqual({});
        expect(sizingHints('river', { bet_size_brackets: { standard_max: 0.7 } })).toEqual({});
    });
});
