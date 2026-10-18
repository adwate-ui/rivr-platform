import { describe, it, expect } from 'vitest';
import example from '../../fixtures/example-encoding.json' with { type: 'json' };
import { payloadOrThrow } from '../parse/payload.ts';
import { hashSource, toAttemptRow } from './attempt.ts';
import { crosstab, findLeaks, wilsonLowerBound, DIMENSIONS, SET_VALUED, MIN_ATTEMPTS } from './crosstab.ts';
import { many, row, scenario } from './fixtures.ts';

/**
 * Analytics: the attempt row and the cuts made from it.
 *
 * The tests that carry weight are the ones about STATISTICS rather than
 * grouping. Grouping is easy to get right and easy to see wrong; a missing
 * significance floor produces a page that looks perfectly reasonable and is
 * confidently wrong, which is the worse failure by a distance.
 */

/* ── the attempt row ─────────────────────────────────────────────────────── */

describe('an attempt row', () => {
    it('records the scenario attributes, not just a seed to re-derive them', () => {
        const attempt = row();
        expect(attempt.stackBracket).toBe('standard');
        expect(attempt.boardTags).toEqual(['rainbow', 'high']);
        expect(attempt.handClass).toBe('top_pair_good_kicker');
        expect(attempt.relativeStrength).toBe('strong');
    });

    it('records which encoding it was graded against', () => {
        expect(row().sourceHash).toBe('hash');
    });

    it('keeps the seed and node path too, for replay', () => {
        expect(row().seed).toBe(1);
        expect(row().nodePath).toEqual([]);
    });

    it('leaves absent coordinates absent rather than inventing them', () => {
        const preflop = toAttemptRow({
            id: 'x', sessionId: 's', sourceId: 'src', sourceHash: 'h', principleId: 'p',
            scenario: scenario({ street: 'preflop', board: [], boardTags: [], handClass: undefined, draws: undefined, relativeStrength: undefined }),
            submittedAction: 'raise', correctAction: 'raise', provenanceKind: 'range',
            errorClass: 'correct', grade: 3, latencyMs: 1, correct: true, now: 0,
        });
        expect(preflop.handClass).toBeUndefined();
        expect(preflop.drawClasses).toEqual([]);
    });
});

describe('the source fingerprint', () => {
    it('is stable for the same payload', () => {
        expect(hashSource(example)).toBe(hashSource(example));
    });

    it('changes when the encoding changes', () => {
        const encoding = payloadOrThrow(example);
        const edited = { ...encoding, source: { ...encoding.source, title: 'Other' } };
        expect(hashSource(edited)).not.toBe(hashSource(example));
    });

    it('is a fixed-width hex string', () => {
        expect(hashSource({})).toMatch(/^[0-9a-f]{16}$/);
    });
});

/* ── cross-tabulation ────────────────────────────────────────────────────── */

describe('cutting errors by attribute', () => {
    it('groups by a scalar dimension', () => {
        const rows = [
            ...many(3, { stackBracket: 'standard', correct: false, errorClass: 'too_passive' }),
            ...many(2, { stackBracket: 'very_deep', correct: true }),
        ];
        const cells = crosstab(rows, 'stackBracket', 1);
        expect(cells.find((cell) => cell.key === 'standard')?.rate).toBe(1);
        expect(cells.find((cell) => cell.key === 'very_deep')?.rate).toBe(0);
    });

    it('puts one attempt in several cells on a set-valued dimension', () => {
        const cells = crosstab(many(4, { boardTags: ['rainbow', 'high'] }), 'boardTag', 1);
        expect(cells.map((cell) => cell.key).sort()).toEqual(['high', 'rainbow']);
        // Columns sum to more than the attempt total, which is correct and
        // looks like a bug — hence SET_VALUED being exported.
        expect(cells.reduce((total, cell) => total + cell.attempts, 0)).toBe(8);
        expect(SET_VALUED).toContain('boardTag');
    });

    it('groups by draw class, which is set-valued too', () => {
        const cells = crosstab(many(3, { drawClasses: ['flush_draw', 'combo_draw'] }), 'drawClass', 1);
        expect(cells.map((cell) => cell.key).sort()).toEqual(['combo_draw', 'flush_draw']);
        expect(SET_VALUED).toContain('drawClass');
    });

    it('breaks errors down by class', () => {
        const rows = [
            ...many(2, { correct: false, errorClass: 'too_loose' }),
            ...many(1, { correct: false, errorClass: 'wrong_sizing' }),
        ];
        const cell = crosstab(rows, 'principleId', 1)[0];
        expect(cell?.byErrorClass).toEqual({ too_loose: 2, wrong_sizing: 1 });
    });

    it('skips a dimension the attempt has no value for', () => {
        expect(crosstab(many(3, { villainArchetype: undefined }), 'villainArchetype', 1)).toEqual([]);
    });

    it('marks a thin cell as not significant', () => {
        const thin = crosstab(many(2, { correct: false }), 'principleId')[0];
        expect(thin?.attempts).toBe(2);
        expect(thin?.significant).toBe(false);

        const thick = crosstab(many(MIN_ATTEMPTS, { correct: false }), 'principleId')[0];
        expect(thick?.significant).toBe(true);
    });

    it('sorts the worst rate first, deterministically', () => {
        const rows = [
            ...many(4, { id: 'x', heroPosition: 'BTN', correct: false }),
            ...many(4, { id: 'y', heroPosition: 'SB', correct: true }),
        ];
        expect(crosstab(rows, 'heroPosition', 1)[0]?.key).toBe('BTN');
        expect(crosstab(rows, 'heroPosition', 1)).toEqual(crosstab(rows, 'heroPosition', 1));
    });

    it('breaks a dead tie on the key, so the order never wobbles', () => {
        // Same rate, same attempt count: only the key can decide, and it has to
        // decide the same way whichever order the rows arrive in.
        const rows = [
            ...many(2, { id: 'p', heroPosition: 'SB', correct: true }),
            ...many(2, { id: 'q', heroPosition: 'BTN', correct: true }),
        ];
        expect(crosstab(rows, 'heroPosition', 1).map((cell) => cell.key)).toEqual(['BTN', 'SB']);
        expect(crosstab([...rows].reverse(), 'heroPosition', 1).map((cell) => cell.key)).toEqual(['BTN', 'SB']);
    });

    it('handles no attempts at all', () => {
        expect(crosstab([], 'principleId')).toEqual([]);
        expect(DIMENSIONS.length).toBeGreaterThan(0);
    });
});

describe('the Wilson bound', () => {
    it('is zero when nothing was attempted', () => {
        expect(wilsonLowerBound(0, 0)).toBe(0);
    });

    it('discounts a small sample far more than a large one', () => {
        // Two out of two and twenty out of twenty are both a raw 100%.
        expect(wilsonLowerBound(2, 2)).toBeLessThan(wilsonLowerBound(20, 20));
        expect(wilsonLowerBound(2, 2)).toBeLessThan(0.5);
    });

    it('ranks a big sample at a lower rate above a tiny one at a higher rate', () => {
        // This is the whole reason the bound exists rather than the raw rate.
        expect(wilsonLowerBound(20, 30)).toBeGreaterThan(wilsonLowerBound(2, 2));
    });

    it('never goes below zero', () => {
        expect(wilsonLowerBound(0, 40)).toBe(0);
    });

    it('stays under the raw rate', () => {
        expect(wilsonLowerBound(15, 20)).toBeLessThan(15 / 20);
    });
});

describe('finding leaks', () => {
    it('surfaces a cell genuinely worse than the reader\'s own baseline', () => {
        const rows = [
            ...many(20, { id: 'deep', stackBracket: 'very_deep', correct: false, errorClass: 'too_passive' }),
            ...many(60, { id: 'std', stackBracket: 'standard', correct: true }),
        ];
        const leaks = findLeaks(rows, 'stackBracket');
        expect(leaks).toHaveLength(1);
        expect(leaks[0]?.key).toBe('very_deep');
        expect(leaks[0]?.excess).toBeGreaterThan(0);
    });

    it('says nothing when a bad-looking cell is too thin to trust', () => {
        const rows = [
            ...many(2, { id: 'deep', stackBracket: 'very_deep', correct: false }),
            ...many(60, { id: 'std', stackBracket: 'standard', correct: true }),
        ];
        expect(findLeaks(rows, 'stackBracket')).toEqual([]);
    });

    it('compares against the reader rather than an absolute threshold', () => {
        // Everything is 50%, so nothing is a leak even though 50% sounds bad.
        const rows = [
            ...many(30, { id: 'a', stackBracket: 'standard', correct: false }),
            ...many(30, { id: 'b', stackBracket: 'standard', correct: true }),
        ];
        expect(findLeaks(rows, 'stackBracket')).toEqual([]);
    });

    it('has nothing to say about no attempts', () => {
        expect(findLeaks([], 'stackBracket')).toEqual([]);
    });
});

