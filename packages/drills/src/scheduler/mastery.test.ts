import { describe, it, expect } from 'vitest';
import type { Principle } from '../ontology/types.ts';
import { newCard, review, DAY_MS, type CardState } from './schedule.ts';
import { masteryOf, masteryByUnit } from './mastery.ts';

/**
 * Mastery.
 *
 * The assertion that carries this file is the first one: an untouched source must
 * not report as mastered. `currentRetrievability` answers 1 for a card nobody
 * has seen — right for scheduling, catastrophic as a progress figure — and the
 * naive mean of it is a screen that congratulates a reader for opening the app.
 */

const principle = (id: string, unit?: string): Principle => ({
    id,
    source_id: 'src',
    name: id,
    ...(unit === undefined ? {} : { source_unit_id: unit }),
    rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'check' } },
    rationale: 'Because.',
    feedback: { correct: 'Right.' },
});

/** A card reviewed `daysAgo`, remembered each time. */
const studied = (id: string, daysAgo: number, now: number): CardState => {
    const at = now - daysAgo * DAY_MS;
    return review({ card: newCard(id), grade: 3, now: at }).card;
};

const now = Date.UTC(2026, 7, 21);

describe('mastery of a set of principles', () => {
    it('is zero for a source nobody has opened', () => {
        const principles = [principle('a'), principle('b')];
        const mastery = masteryOf(principles, new Map(), now);

        expect(mastery.score).toBe(0);
        expect(mastery.met).toBe(0);
        // The retention of nothing is not a claim about the reader, so it does
        // not drag the headline figure anywhere on its own.
        expect(mastery.retention).toBe(1);
    });

    it('does not count a card the reader was merely offered', () => {
        // A card is written when a principle enters the queue, so its existence
        // says it was dealt, not that it was answered.
        const offered = new Map([['a', newCard('a')]]);
        expect(masteryOf([principle('a')], offered, now).met).toBe(0);
    });

    it('is capped by how much of the source has been met', () => {
        const principles = [principle('a'), principle('b'), principle('c'), principle('d')];
        const cards = new Map([['a', studied('a', 0, now)]]);
        const mastery = masteryOf(principles, cards, now);

        expect(mastery.coverage).toBe(0.25);
        expect(mastery.score).toBeLessThanOrEqual(0.25);
    });

    it('falls as what was learned is forgotten', () => {
        const principles = [principle('a')];
        const fresh = masteryOf(principles, new Map([['a', studied('a', 0, now)]]), now);
        const stale = masteryOf(principles, new Map([['a', studied('a', 120, now)]]), now);

        expect(stale.score).toBeLessThan(fresh.score);
        expect(stale.coverage).toBe(fresh.coverage);
    });

    it('reports met and held separately, because they need different sessions', () => {
        // Half the source, remembered well, is not the same 40 percent as all of
        // the source half-remembered — and the reader acts differently on each.
        const wide = masteryOf(
            [principle('a'), principle('b')],
            new Map([['a', studied('a', 0, now)], ['b', studied('b', 200, now)]]),
            now,
        );
        const narrow = masteryOf(
            [principle('a'), principle('b')],
            new Map([['a', studied('a', 0, now)]]),
            now,
        );

        expect(wide.coverage).toBeGreaterThan(narrow.coverage);
        expect(wide.retention).toBeLessThan(narrow.retention);
    });

    it('says nothing about a source with no principles', () => {
        expect(masteryOf([], new Map(), now).score).toBe(0);
    });
});

describe('mastery per chapter', () => {
    it('scores each chapter on its own principles', () => {
        const principles = [
            principle('a', 'unit_1'), principle('b', 'unit_1'), principle('c', 'unit_2'),
        ];
        const cards = new Map([
            ['a', studied('a', 0, now)], ['b', studied('b', 0, now)],
        ]);
        const byUnit = masteryByUnit(principles, cards, now);

        expect(byUnit.get('unit_1')?.coverage).toBe(1);
        expect(byUnit.get('unit_2')?.coverage).toBe(0);
    });

    it('leaves out a principle the source never filed under a chapter', () => {
        const byUnit = masteryByUnit([principle('loose')], new Map(), now);
        expect(byUnit.size).toBe(0);
    });
});
