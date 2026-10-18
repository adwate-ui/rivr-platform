import { describe, it, expect } from 'vitest';
import { intervalDays } from './fsrs.ts';
import {
    DAY_MS, ERROR_CLASS_GRADE, FAST_ANSWER_MS, gradeFor, newCard, review, isDue,
    overdueDays, currentRetrievability, type CardState,
} from './schedule.ts';

/**
 * Reviewing cards against an injected clock.
 *
 * Every test here passes its own time. That is the whole reason this package
 * may not call `Date.now()`: "this card is due in nine days" is otherwise a
 * claim you can only verify by waiting nine days.
 */

const T0 = 1_760_000_000_000;
const at = (days: number): number => T0 + days * DAY_MS;

/** The stability of a card the test has already reviewed. */
function stabilityOf(card: CardState): number {
    if (card.memory === null) throw new Error(`${card.cardKey} has never been reviewed`);
    return card.memory.stability;
}

/** The due date of a card the test has already scheduled. */
function dueOf(card: CardState): number {
    if (card.dueAt === null) throw new Error(`${card.cardKey} has no due date`);
    return card.dueAt;
}

describe('reviewing a card', () => {
    it('schedules a first sighting forward from now', () => {
        const result = review({ card: newCard('a'), grade: 3, now: T0 });
        expect(result.elapsedDays).toBe(0);
        expect(result.card.dueAt).toBe(T0 + result.intervalDays * DAY_MS);
        expect(result.card.reps).toBe(1);
        expect(result.card.phase).toBe('review');
    });

    it('measures elapsed time from the last review, not from creation', () => {
        const first = review({ card: newCard('a'), grade: 3, now: T0 });
        const second = review({ card: first.card, grade: 3, now: at(9) });
        expect(second.elapsedDays).toBeCloseTo(9, 6);
    });

    it('counts a lapse and moves the card to relearning', () => {
        const first = review({ card: newCard('a'), grade: 3, now: T0 });
        const lapsed = review({ card: first.card, grade: 1, now: at(30) });
        expect(lapsed.card.lapses).toBe(1);
        expect(lapsed.card.phase).toBe('relearning');
    });

    it('sends a first-ever failure to learning rather than relearning', () => {
        expect(review({ card: newCard('a'), grade: 1, now: T0 }).card.phase).toBe('learning');
    });

    it('brings a relearning card back to review once it is recalled', () => {
        const lapsed = review({ card: { ...newCard('a'), phase: 'relearning' }, grade: 3, now: T0 });
        expect(lapsed.card.phase).toBe('review');
    });

    it('lengthens the interval on repeated success', () => {
        let card = newCard('a');
        let previous = 0;
        let now = T0;
        for (let i = 0; i < 5; i += 1) {
            const result = review({ card, grade: 3, now });
            expect(result.intervalDays).toBeGreaterThanOrEqual(previous);
            previous = result.intervalDays;
            card = result.card;
            now += result.intervalDays * DAY_MS;
        }
        expect(previous).toBeGreaterThan(1);
    });

    it('shortens the interval after a lapse', () => {
        let card = newCard('a');
        let now = T0;
        for (let i = 0; i < 4; i += 1) {
            const result = review({ card, grade: 3, now });
            card = result.card;
            now += result.intervalDays * DAY_MS;
        }
        const long = intervalDays(stabilityOf(card));
        const lapsed = review({ card, grade: 1, now });
        expect(lapsed.intervalDays).toBeLessThan(long);
    });

    it('never treats a clock that went backwards as negative elapsed time', () => {
        const first = review({ card: newCard('a'), grade: 3, now: at(10) });
        expect(review({ card: first.card, grade: 3, now: T0 }).elapsedDays).toBe(0);
    });
});

describe('turning a mistake into a grade', () => {
    it('resets on a directional error and only shortens on a slip', () => {
        expect(ERROR_CLASS_GRADE.too_loose).toBe(1);
        expect(ERROR_CLASS_GRADE.too_tight).toBe(1);
        expect(ERROR_CLASS_GRADE.too_passive).toBe(1);
        expect(ERROR_CLASS_GRADE.too_aggressive).toBe(1);
        expect(ERROR_CLASS_GRADE.wrong_sizing).toBe(2);
        expect(ERROR_CLASS_GRADE.right_idea_wrong_spot).toBe(2);
        expect(ERROR_CLASS_GRADE.correct).toBe(3);
    });

    it('promotes a fast correct answer to easy', () => {
        expect(gradeFor({ errorClass: 'correct', fast: true })).toBe(4);
        expect(gradeFor({ errorClass: 'correct', fast: false })).toBe(3);
    });

    it('does not reward speed on a wrong answer', () => {
        expect(gradeFor({ errorClass: 'too_loose', fast: true })).toBe(1);
        expect(gradeFor({ errorClass: 'wrong_sizing', fast: true })).toBe(2);
    });

    it('names the speed threshold rather than hiding it', () => {
        expect(FAST_ANSWER_MS).toBeGreaterThan(0);
    });
});

describe('when a card is due', () => {
    it('treats a card never seen as always due', () => {
        expect(isDue(newCard('a'), T0)).toBe(true);
        expect(overdueDays(newCard('a'), T0)).toBe(Infinity);
    });

    it('is due once its date passes, and not before', () => {
        const card = review({ card: newCard('a'), grade: 3, now: T0 }).card;
        expect(isDue(card, T0)).toBe(false);
        expect(isDue(card, dueOf(card) + 1)).toBe(true);
        expect(overdueDays(card, dueOf(card) + DAY_MS)).toBeCloseTo(1, 6);
    });

    it('reports full recall for a card never studied', () => {
        expect(currentRetrievability(newCard('a'), T0)).toBe(1);
    });

    it('reports decayed recall for one that was', () => {
        const card = review({ card: newCard('a'), grade: 3, now: T0 }).card;
        expect(currentRetrievability(card, at(60))).toBeLessThan(1);
    });
});
