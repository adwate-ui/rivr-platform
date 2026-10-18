/**
 * Which card to ask next, and which are not allowed to be asked yet.
 *
 * Two jobs kept apart because they fail differently: gating is about the
 * SOURCE's own ordering (`prerequisites`), and due-selection is about the
 * user's memory. A card can be perfectly due and still locked.
 */

import type { Principle } from '../ontology/types.ts';
import { isDue, overdueDays, newCard, type CardState } from './schedule.ts';

/**
 * Stability a prerequisite must reach before what it gates opens up.
 *
 * Three weeks: long enough that the earlier idea has actually stuck, short
 * enough that a reader is not blocked out of the whole source for a month. A
 * judgement call, named so it can be changed in one place.
 */
export const PREREQUISITE_STABILITY_DAYS = 21;

/**
 * Principles whose prerequisites are all satisfied.
 *
 * Computed by **fixpoint iteration, not recursion**. Stage 2 rejects cyclic
 * prerequisites at import, but the runtime has to be safe against a source
 * saved before that check existed — and a recursive walk over a cycle locks
 * the tab rather than reporting a bad source.
 */
export function unlockedSet(
    principles: readonly Principle[],
    states: ReadonlyMap<string, CardState>,
): Set<string> {
    const satisfied = (id: string): boolean => {
        const memory = states.get(id)?.memory;
        return memory !== undefined && memory !== null && memory.stability >= PREREQUISITE_STABILITY_DAYS;
    };

    const unlocked = new Set<string>();
    let changed = true;

    while (changed) {
        changed = false;
        for (const principle of principles) {
            if (unlocked.has(principle.id)) continue;

            const prerequisites = principle.prerequisites ?? [];
            // Direct rather than transitive: if A gates B and B gates C, then
            // C's lock is already implied by B's.
            const open = prerequisites.every((id) => satisfied(id) && unlocked.has(id));
            if (prerequisites.length === 0 || open) {
                unlocked.add(principle.id);
                changed = true;
            }
        }
    }

    return unlocked;
}

export interface QueueEntry {
    readonly principle: Principle;
    readonly card: CardState;
}

/**
 * The session queue: unlocked, drillable, and due — most overdue first.
 *
 * Ties break on principle id rather than on insertion order, so the same set
 * of cards produces the same queue whatever order the payload listed them in.
 */
export function buildQueue(
    principles: readonly Principle[],
    states: ReadonlyMap<string, CardState>,
    now: number,
): QueueEntry[] {
    const unlocked = unlockedSet(principles, states);

    return principles
        .filter((principle) => principle.drillable !== false && unlocked.has(principle.id))
        .map((principle) => ({
            principle,
            card: states.get(principle.id) ?? newCard(principle.id),
        }))
        .filter((entry) => isDue(entry.card, now))
        .sort((a, b) => {
            const delta = overdueDays(b.card, now) - overdueDays(a.card, now);
            if (delta !== 0 && Number.isFinite(delta)) return delta;
            // Both never seen, or equally overdue.
            if (a.card.dueAt === null && b.card.dueAt !== null) return -1;
            if (b.card.dueAt === null && a.card.dueAt !== null) return 1;
            return a.principle.id < b.principle.id ? -1 : 1;
        });
}

/**
 * What to ask once nothing is due: every unlocked principle in the pool,
 * soonest-due first.
 *
 * A session used to END when the due queue ran dry, which made "twenty spots
 * on the flop at 2/5" a session of however many flop principles happened to
 * be due — seven, say — and a reader who narrowed the hub to a chapter got
 * that chapter once. Spots are generated fresh every time, so asking a
 * principle again is a new question, not a repeat; the schedule still records
 * every answer. Soonest-due first, because that is the principle closest to
 * being forgotten; ties on id so the order is stable.
 */
export function practicePool(
    principles: readonly Principle[],
    states: ReadonlyMap<string, CardState>,
): QueueEntry[] {
    const unlocked = unlockedSet(principles, states);

    return principles
        .filter((principle) => principle.drillable !== false && unlocked.has(principle.id))
        .map((principle) => ({
            principle,
            card: states.get(principle.id) ?? newCard(principle.id),
        }))
        .sort((a, b) => {
            const dueA = a.card.dueAt ?? Number.NEGATIVE_INFINITY;
            const dueB = b.card.dueAt ?? Number.NEGATIVE_INFINITY;
            if (dueA !== dueB) return dueA - dueB;
            return a.principle.id < b.principle.id ? -1 : 1;
        });
}

export interface QueueSummary {
    readonly due: number;
    readonly locked: number;
    readonly total: number;
    /** Soonest future due date, or null when everything is already due. */
    readonly nextDueAt: number | null;
}

/** Due, locked and total counts for the hub, with the next due date. */
export function summariseQueue(
    principles: readonly Principle[],
    states: ReadonlyMap<string, CardState>,
    now: number,
): QueueSummary {
    const drillable = principles.filter((principle) => principle.drillable !== false);
    const unlocked = unlockedSet(principles, states);
    const due = buildQueue(principles, states, now).length;

    const future = drillable
        .map((principle) => states.get(principle.id)?.dueAt)
        .filter((dueAt): dueAt is number => dueAt !== undefined && dueAt !== null && dueAt > now)
        .sort((a, b) => a - b);

    return {
        due,
        locked: drillable.filter((principle) => !unlocked.has(principle.id)).length,
        total: drillable.length,
        nextDueAt: future[0] ?? null,
    };
}
