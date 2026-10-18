import { describe, it, expect } from 'vitest';
import { ERROR_CLASS_LABEL } from '../grading/classifyError.ts';
import schema from '../ontology/poker-ontology-v1.schema.json' with { type: 'json' };
import {
    crosstab, crosstab2, leakiestDimension, secondsLabel, summarise, topLeaks, LEAK_DIMENSIONS, DIMENSIONS, orderValues,
} from './crosstab.ts';
import { many, row } from './fixtures.ts';

/**
 * One definition, because the verdict prints a spot's own time against the
 * reader's median and Review prints the median alone. Two screens rounding the
 * same measurement differently would make the comparison uncheckable.
 */
describe('a latency as a reader reads it', () => {
    it('is one decimal of a second, everywhere', () => {
        expect(secondsLabel(13_800)).toBe('13.8s');
        expect(secondsLabel(600)).toBe('0.6s');
        expect(secondsLabel(0)).toBe('0.0s');
    });
});

describe('which dimension holds the leak', () => {
    const lopsided = () => [
        ...many(20, { id: 'turn', street: 'turn', correct: false, errorClass: 'too_passive' }),
        ...many(60, { id: 'flop', street: 'flop', correct: true }),
    ];

    it('names the worst cut and the cell inside it', () => {
        const worst = leakiestDimension(lopsided());
        expect(worst?.dimension).toBe('street');
        expect(worst?.leak.key).toBe('turn');
    });

    it('answers for every cut that has one, and only those', () => {
        const found = topLeaks(lopsided());
        expect(found.get('street')?.key).toBe('turn');
        // One stake, one position, one hand class — nothing to be worse AT.
        expect(found.has('stakes')).toBe(false);
    });

    /**
     * `errorClass` is excluded, and it is not a preference. A cell's rate is
     * errors over attempts, so on that dimension every value except `correct`
     * is 100% wrong by construction — it would report a confident leak on every
     * mistake ever made and out-score every real finding.
     */
    it('refuses to call a mistake a leak in being a mistake', () => {
        expect(LEAK_DIMENSIONS).not.toContain('errorClass');
        expect(topLeaks(lopsided()).has('errorClass')).toBe(false);
        expect(leakiestDimension(lopsided())?.dimension).not.toBe('errorClass');
    });

    it('says nothing at all below the significance floor', () => {
        expect(leakiestDimension(many(4, { correct: false, errorClass: 'too_loose' }))).toBeNull();
        expect(leakiestDimension([])).toBeNull();
    });

    it('keeps the earlier dimension on a tie, so the page opens the same way twice', () => {
        // Position and street move together here, so both cuts hold the same
        // confidence and the order of DIMENSIONS decides.
        const rows = [
            ...many(20, { id: 'a', street: 'turn', heroPosition: 'SB', correct: false, errorClass: 'too_passive' }),
            ...many(60, { id: 'b', street: 'flop', heroPosition: 'BTN', correct: true }),
        ];
        const first = leakiestDimension(rows)?.dimension;
        expect(first).toBe(leakiestDimension(rows)?.dimension);
        expect(DIMENSIONS.findIndex((dimension) => dimension === first))
            .toBeLessThan(DIMENSIONS.indexOf('heroPosition'));
    });
});

describe('two dimensions at once', () => {
    it('crosses them, and marks thin cells', () => {
        const rows = [
            ...many(3, { id: 'a', stackBracket: 'very_deep', street: 'turn', correct: false }),
            ...many(3, { id: 'b', stackBracket: 'standard', street: 'turn', correct: true }),
        ];
        const matrix = crosstab2(rows, 'stackBracket', 'street', 2);
        expect(matrix).toHaveLength(2);
        expect(matrix.find((cell) => cell.row === 'very_deep')?.rate).toBe(1);
        expect(matrix.every((cell) => cell.significant)).toBe(true);
    });

    it('breaks the crossed cell down by error class too', () => {
        const rows = many(2, { correct: false, errorClass: 'too_tight' });
        expect(crosstab2(rows, 'stackBracket', 'street', 1)[0]?.byErrorClass).toEqual({ too_tight: 2 });
    });
});

describe('the headline summary', () => {
    it('counts attempts, accuracy and a median latency', () => {
        const rows = [
            ...many(3, { id: 'a', correct: true, latencyMs: 1_000 }),
            ...many(1, { id: 'b', correct: false, latencyMs: 9_000 }),
        ];
        const summary = summarise(rows);
        expect(summary).toEqual({ attempts: 4, correct: 3, rate: 0.75, medianLatencyMs: 1_000 });
    });

    it('takes the middle value for an odd count', () => {
        const rows = [
            row({ id: 'a', latencyMs: 1_000 }),
            row({ id: 'b', latencyMs: 5_000 }),
            row({ id: 'c', latencyMs: 9_000 }),
        ];
        expect(summarise(rows).medianLatencyMs).toBe(5_000);
    });

    it('handles no attempts', () => {
        expect(summarise([])).toEqual({ attempts: 0, correct: 0, rate: 0, medianLatencyMs: 0 });
    });
});

/**
 * The order a dimension's values belong in.
 *
 * Almost every dimension here is an ORDERED SCALE and both cross-tab axes used
 * a bare `.sort()`, so streets read "flop, preflop, river" and stack depths ran
 * "deep, short, very deep". Alphabetical order on an ordinal scale is not a
 * neutral default: it destroys the one thing an axis is for.
 */
describe('orderValues', () => {
    it('puts an ordinal dimension in its own order, not the alphabetical one', () => {
        expect(orderValues('street', ['river', 'flop', 'preflop', 'turn']))
            .toEqual(['preflop', 'flop', 'turn', 'river']);
        expect(orderValues('stackBracket', ['deep', 'short', 'very_deep', 'standard']))
            .toEqual(['short', 'standard', 'deep', 'very_deep']);
        expect(orderValues('heroPosition', ['BB', 'BTN', 'UTG']))
            .toEqual(['UTG', 'BTN', 'BB']);
    });

    it('orders a dimension with no scale by the name actually on screen', () => {
        // Principle keys are ids and the cells display names, so sorting the
        // keys produced an order with no relationship to anything visible.
        const names: Record<string, string> = { p_zulu: 'Apply pressure early', p_alpha: 'Zero in on value' };
        expect(orderValues('principleId', ['p_alpha', 'p_zulu'], (key) => names[key] ?? key))
            .toEqual(['p_zulu', 'p_alpha']);
    });

    it('falls back to the key itself when nothing supplies a label', () => {
        expect(orderValues('principleId', ['b', 'a'])).toEqual(['a', 'b']);
    });

    it('keeps a value the enum has never heard of, at the end, in a stable order', () => {
        // An attempt row recorded under an older ontology still has to appear;
        // silently dropping a column would be worse than an odd one. Two of
        // them rank equal, so the label breaks the tie rather than leaving the
        // order to the sort's own whim.
        expect(orderValues('street', ['river', 'sixth_street', 'fourth_street', 'preflop']))
            .toEqual(['preflop', 'river', 'fourth_street', 'sixth_street']);
    });
});

describe('the lists the compiler cannot check', () => {
    /*
     * `ERROR_CLASS_LABEL` is a `Record<ErrorClass, string>`, so adding an error
     * class is a compile error there until it is named. Two other lists hold
     * the same vocabulary and are NOT typed that way: the review's column order
     * and the schema's feedback keys. When the label and count classes arrived,
     * the order list was a hand-typed array that knew about none of them, and
     * nothing complained. These tests are what complains now.
     */
    it('orders the error-class axis over exactly the classes that exist', () => {
        const keys = Object.keys(ERROR_CLASS_LABEL);
        expect(orderValues('errorClass', [...keys].reverse())).toEqual(keys);
    });

    it('puts a correct answer first on that axis', () => {
        expect(orderValues('errorClass', ['too_many', 'wrong_label', 'correct'])[0]).toBe('correct');
    });

    it('has a feedback key in the schema for every mistake a reader can make', () => {
        // The schema is what an encoder writes against. An error class with no
        // feedback key there is a mistake the drill can grade and no source
        // can ever explain.
        const feedbackKeys = Object.keys(schema.$defs.principle.properties.feedback.properties);
        const mistakes = Object.keys(ERROR_CLASS_LABEL).filter((key) => key !== 'correct');
        expect(mistakes.filter((key) => !feedbackKeys.includes(key))).toEqual([]);
    });
});

describe('what kind of question it was', () => {
    it('is a dimension a reader can cut their errors by', () => {
        expect(DIMENSIONS).toContain('answerKind');
    });

    it('reads a row written before answer kinds existed as an action', () => {
        // Rows are never migrated. A row with no kind was an action, because
        // that was the only kind there was, and the default is applied where
        // the row is read rather than by rewriting stored history.
        const cells = crosstab([row(), row({ answerKind: undefined })], 'answerKind', 1);
        expect(cells).toEqual([expect.objectContaining({ key: 'action', attempts: 2 })]);
    });

    it('keeps the three kinds apart, so a weak one shows up on its own', () => {
        const rows = [
            row({ answerKind: 'action', correct: true }),
            row({ answerKind: 'classify', correct: false, errorClass: 'wrong_label' }),
            row({ answerKind: 'count', correct: false, errorClass: 'too_few' }),
            row({ answerKind: 'count', correct: false, errorClass: 'too_many' }),
        ];
        const cells = crosstab(rows, 'answerKind', 1);
        const byKind = Object.fromEntries(cells.map((cell) => [cell.key, cell]));
        expect(byKind['action']?.rate).toBe(0);
        expect(byKind['classify']?.byErrorClass).toEqual({ wrong_label: 1 });
        expect(byKind['count']?.byErrorClass).toEqual({ too_few: 1, too_many: 1 });
    });

    it('lists the kinds in the order a reader meets them', () => {
        expect(orderValues('answerKind', ['count', 'action', 'classify']))
            .toEqual(['action', 'classify', 'count']);
    });
});
