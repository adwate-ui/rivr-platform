import { describe, it, expect } from 'vitest';
import type { Principle } from '../ontology/types.ts';
import { DAY_MS, newCard, review, type CardState } from './schedule.ts';
import { buildQueue, summariseQueue, unlockedSet, PREREQUISITE_STABILITY_DAYS, practicePool } from './queue.ts';

/**
 * Gating and the queue: which cards may be asked, and in what order.
 */

const T0 = 1_760_000_000_000;
const at = (days: number): number => T0 + days * DAY_MS;

const principle = (id: string, prerequisites?: string[]): Principle => ({
    id,
    source_id: 'src',
    name: id,
    rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'check' } },
    rationale: 'x',
    feedback: { correct: 'x', too_loose: 'x' },
    ...(prerequisites === undefined ? {} : { prerequisites }),
});

const stateWith = (id: string, stability: number): CardState => ({
    ...newCard(id),
    memory: { stability, difficulty: 5 },
    lastReviewedAt: T0,
    dueAt: T0,
    reps: 1,
});

const ids = (entries: readonly { principle: Principle }[]): string[] => entries.map((entry) => entry.principle.id);

describe('prerequisites', () => {
    const basics = principle('basics');
    const advanced = principle('advanced', ['basics']);

    it('locks a principle until its prerequisite is stable enough', () => {
        expect(unlockedSet([basics, advanced], new Map())).toEqual(new Set(['basics']));

        const barely = new Map([['basics', stateWith('basics', PREREQUISITE_STABILITY_DAYS - 1)]]);
        expect(unlockedSet([basics, advanced], barely).has('advanced')).toBe(false);

        const stable = new Map([['basics', stateWith('basics', PREREQUISITE_STABILITY_DAYS)]]);
        expect(unlockedSet([basics, advanced], stable).has('advanced')).toBe(true);
    });

    it('unlocks a principle with no prerequisites immediately', () => {
        expect(unlockedSet([basics], new Map()).has('basics')).toBe(true);
    });

    it('opens a chain one link at a time', () => {
        const third = principle('third', ['advanced']);
        const states = new Map([['basics', stateWith('basics', 30)]]);
        const unlocked = unlockedSet([basics, advanced, third], states);
        expect(unlocked.has('advanced')).toBe(true);
        expect(unlocked.has('third')).toBe(false);
    });

    it('does not hang on a cyclic source that predates the import check', () => {
        const a = principle('a', ['b']);
        const b = principle('b', ['a']);
        expect(unlockedSet([a, b], new Map())).toEqual(new Set());
    });
});

describe('the queue', () => {
    it('offers every unlocked, drillable, due card', () => {
        expect(ids(buildQueue([principle('a'), principle('b')], new Map(), T0))).toEqual(['a', 'b']);
    });

    it('leaves out a card that is not due yet', () => {
        const scheduled = review({ card: newCard('a'), grade: 3, now: T0 }).card;
        const states = new Map([['a', scheduled]]);
        expect(buildQueue([principle('a')], states, T0)).toHaveLength(0);
        expect(buildQueue([principle('a')], states, at(400))).toHaveLength(1);
    });

    it('leaves out anything the source marked not drillable', () => {
        const skipped = { ...principle('a'), drillable: false };
        expect(buildQueue([skipped], new Map(), T0)).toHaveLength(0);
    });

    it('leaves out a locked card even when it would be due', () => {
        expect(buildQueue([principle('a', ['missing'])], new Map(), T0)).toHaveLength(0);
    });

    it('puts the most overdue card first', () => {
        const states = new Map([
            ['a', { ...stateWith('a', 10), dueAt: at(-1) }],
            ['b', { ...stateWith('b', 10), dueAt: at(-30) }],
        ]);
        expect(buildQueue([principle('a'), principle('b')], states, T0)[0]?.principle.id).toBe('b');
    });

    it('puts a card never seen ahead of one merely overdue, listed either way round', () => {
        const states = new Map([['b', { ...stateWith('b', 10), dueAt: at(-2) }]]);
        expect(buildQueue([principle('b'), principle('a')], states, T0)[0]?.principle.id).toBe('a');
        expect(buildQueue([principle('a'), principle('b')], states, T0)[0]?.principle.id).toBe('a');
    });

    it('orders identically whatever order the payload listed them in', () => {
        const forward = buildQueue([principle('a'), principle('b')], new Map(), T0);
        const backward = buildQueue([principle('b'), principle('a')], new Map(), T0);
        expect(ids(backward)).toEqual(ids(forward));
    });

    it('practises the whole unlocked pool once nothing is due, soonest-due first', () => {
        // Once the due queue runs dry a session keeps going through the scope,
        // asking the principle closest to being forgotten first. Never-seen cards
        // come before scheduled ones; locked and not-drillable ones stay out.
        const states = new Map([
            ['a', { ...stateWith('a', 10), dueAt: at(30) }],
            ['b', { ...stateWith('b', 10), dueAt: at(3) }],
        ]);
        const pool = practicePool(
            [principle('a'), principle('b'), principle('c'), principle('d', ['missing']), { ...principle('e'), drillable: false }, principle('f')],
            states,
        );
        // Two never-seen cards tie and fall to id; a scheduled pair with the same
        // due date would too.
        expect(ids(pool)).toEqual(['c', 'f', 'b', 'a']);
        const sameDay = new Map([['x', { ...stateWith('x', 10), dueAt: at(3) }], ['w', { ...stateWith('w', 10), dueAt: at(3) }]]);
        expect(ids(practicePool([principle('x'), principle('w')], sameDay))).toEqual(['w', 'x']);
        expect(buildQueue([principle('a'), principle('b')], states, T0)).toHaveLength(0);
    });
});

describe('the queue summary', () => {
    it('counts what is due, locked and total', () => {
        const summary = summariseQueue(
            [principle('a'), principle('b', ['missing']), { ...principle('c'), drillable: false }],
            new Map(),
            T0,
        );
        expect(summary).toEqual({ due: 1, locked: 1, total: 2, nextDueAt: null });
    });

    it('reports when the next card comes back', () => {
        const scheduled = review({ card: newCard('a'), grade: 3, now: T0 }).card;
        const summary = summariseQueue([principle('a')], new Map([['a', scheduled]]), T0);
        expect(summary.due).toBe(0);
        expect(summary.nextDueAt).toBe(scheduled.dueAt);
    });

    it('reports no next date when everything is already due', () => {
        expect(summariseQueue([principle('a')], new Map(), T0).nextDueAt).toBeNull();
    });
});
