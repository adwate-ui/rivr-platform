/**
 * How much of a source you actually know.
 *
 * The scheduler has known the answer since it was written — `currentRetrievability`
 * gives the model's estimate that a principle can be recalled right now — and
 * nothing has ever shown it. So a reader could answer four hundred spots and
 * still have no way to see whether the source was sticking, which is the one
 * question spaced repetition exists to answer.
 *
 * **The trap this module exists to avoid.** `currentRetrievability` returns 1
 * for a card that has never been seen, and that is correct for its own job:
 * an unasked card is not at risk of being forgotten, so it must not be
 * scheduled. Averaged naively, though, it says a reader who has opened the source
 * and answered nothing has mastered 100 percent of it — the most flattering
 * possible lie, told at the exact moment a reader is deciding whether the drills
 * are worth trusting.
 *
 * Mastery is therefore the product of two things a reader would name separately:
 * how much of the source has been MET, and how well what has been met is HELD.
 * Both are reported alongside it, because a 40 percent from meeting everything
 * and half-remembering it needs a different session from a 40 percent that comes
 * from knowing a small corner cold.
 */

import type { Principle } from '../ontology/types.ts';
import { currentRetrievability, type CardState } from './schedule.ts';

export interface Mastery {
    /** Principles with at least one review behind them. */
    readonly met: number;
    readonly total: number;
    /** Share of the unit that has been met at all. 0 when it is empty. */
    readonly coverage: number;
    /** Mean recall probability across the met ones. 1 when none are met. */
    readonly retention: number;
    /** `coverage * retention` — met, and still held. The headline figure. */
    readonly score: number;
}

const EMPTY: Mastery = { met: 0, total: 0, coverage: 0, retention: 1, score: 0 };

/** Coverage, retention and their product over a set of principles. */
export function masteryOf(
    principles: readonly Principle[],
    cards: ReadonlyMap<string, CardState>,
    now: number,
): Mastery {
    if (principles.length === 0) return EMPTY;

    let met = 0;
    let recallSum = 0;

    for (const principle of principles) {
        const card = cards.get(principle.id);
        // `lastReviewedAt` rather than mere existence: a card is written the
        // moment a principle enters the queue, so its presence says the reader
        // was offered it, not that they answered it.
        if (card === undefined || card.lastReviewedAt === null) continue;
        met += 1;
        recallSum += currentRetrievability(card, now);
    }

    const coverage = met / principles.length;
    const retention = met === 0 ? 1 : recallSum / met;

    return { met, total: principles.length, coverage, retention, score: coverage * retention };
}

/**
 * The same figure per chapter, which is the one a reader acts on.
 *
 * "You are at 62 percent" is a number to feel something about; "the board
 * texture chapter is at 20 percent and you finished reading it last week" is a
 * session to start. Only
 * units that actually have principles appear — an empty chapter reported at zero
 * would read as a failure rather than as nothing to do.
 */
export function masteryByUnit(
    principles: readonly Principle[],
    cards: ReadonlyMap<string, CardState>,
    now: number,
): Map<string, Mastery> {
    const grouped = new Map<string, Principle[]>();

    for (const principle of principles) {
        const unit = principle.source_unit_id;
        if (unit === undefined) continue;
        const existing = grouped.get(unit);
        if (existing === undefined) grouped.set(unit, [principle]);
        else existing.push(principle);
    }

    return new Map(
        [...grouped.entries()].map(([unit, members]) => [unit, masteryOf(members, cards, now)]),
    );
}
