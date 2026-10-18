/**
 * Board texture: three to five community cards in, a set of `board_tag` out.
 *
 * Every tag's predicate is written out below BEFORE it is implemented, because
 * this is the file where vagueness becomes expensive. A rule author writes
 * `board_require: ["connected"]`; the generator rejects boards until one is
 * tagged connected; the drill then asks about a spot the author may not have
 * meant. "Connected" has to mean one checkable thing, and this is where it is
 * decided.
 *
 * Three groups are deliberately EXHAUSTIVE AND MUTUALLY EXCLUSIVE, so that
 * every board carries exactly one of each and an author can partition on them:
 *
 *   suits   monotone | two_tone | rainbow
 *   ranks   connected | gapped | disconnected
 *   height  low | middling | high
 *
 * Everything else is an independent flag that may or may not fire.
 *
 * Tags are returned as a SORTED ARRAY, never a Set: it serialises
 * deterministically, compares with a deep equal, and lands straight in a
 * `text[]` column without a conversion that could reorder it.
 */

import { BOARD_TAGS, type BoardTag } from './ontology/types.ts';
import { boardFacts, type BoardFacts } from './boardFacts.ts';
import type { Card } from './cards/cards.ts';

export type BoardPredicate = (facts: BoardFacts) => boolean;

/** The top card is nine or lower, or the board is connected with straight potential. */
const isDynamic: BoardPredicate = (f) => f.highest <= 9 || (f.bestWindowCount >= 3 && f.closestGap === 1);

/** A high board, not dynamic, with one draw on it and a card still to come. */
const isSemiStatic: BoardPredicate = (f) => !isDynamic(f)
    && f.highest >= 10
    && f.ranks.length < 5
    && (f.maxSuitCount >= 2 || f.bestWindowCount >= 3);

/**
 * One predicate per tag. `Record<BoardTag, …>` rather than a plain object so
 * that adding a tag to the ontology without adding a predicate here is a
 * COMPILE error rather than a tag that silently never fires.
 */
export const BOARD_TAG_RULES: Readonly<Record<BoardTag, BoardPredicate>> = {
    /** Some rank appears exactly twice. A set is `trips`, not this. */
    paired: (f) => f.rankCounts.some((count) => count === 2),

    /** Some rank appears three or more times. */
    trips: (f) => f.rankCounts.some((count) => count >= 3),

    /** Every card shares one suit. */
    monotone: (f) => f.distinctSuits === 1,

    /** Exactly two suits present. */
    two_tone: (f) => f.distinctSuits === 2,

    /**
     * Three or more suits present.
     *
     * Defined by suit COUNT rather than as "no two cards share a suit" so that
     * the three suit tags stay exhaustive: a four-card board of h-h-d-c would
     * otherwise carry none of them. What such a board gives away about flushes
     * is carried by `flush_possible`, which is the tag that actually knows.
     */
    rainbow: (f) => f.distinctSuits >= 3,

    /** Two board ranks sit adjacent. Wheel-aware, so A-2 counts. */
    connected: (f) => f.closestGap === 1,

    /**
     * Not adjacent, but two hole cards still make an open-ended draw.
     *
     * A raw rank gap of exactly two was the first definition, and it was wrong
     * about boards like J-8-5: the closest gap is three, so it read as
     * `disconnected`, yet T-9 and 7-6 both flop open-ended draws there. A board
     * that ordinary holdings flop open-enders on is not a board with nothing
     * going on.
     *
     * Testing the draw rather than the gap also keeps the ace ends right, which
     * a widened gap would not: on A-T-4 the ace-to-four distance is three, but
     * the run they make is 4-3-2-A, which draws to the five alone. Four outs is
     * a gutshot, and that board stays disconnected.
     */
    gapped: (f) => f.closestGap !== 1 && f.openEnderPossible,

    /**
     * Not adjacent, and no two hole cards make an open-ended draw either. A
     * paired board is disconnected on this axis.
     */
    disconnected: (f) => f.closestGap !== 1 && !f.openEnderPossible,

    /** Top card is an eight or lower. */
    low: (f) => f.highest <= 8,

    /** Top card is a nine, ten or jack. */
    middling: (f) => f.highest >= 9 && f.highest <= 11,

    /** Top card is a queen, king or ace. */
    high: (f) => f.highest >= 12,

    /** An ace is present — which on a board means it is the top card. */
    ace_high: (f) => (f.rankCounts[14] ?? 0) > 0,

    /** Two or more cards of ten or better. */
    broadway_heavy: (f) => f.ranks.filter((rank) => rank >= 10).length >= 2,

    /**
     * Somebody's two hole cards could make a straight.
     *
     * True when a five-rank window holds at least three distinct board ranks:
     * the two missing ranks are exactly the hand that completes it.
     */
    straight_possible: (f) => f.bestWindowCount >= 3,

    /**
     * Somebody's two hole cards could make a flush: three or more of one suit.
     * Four of a suit is still only `possible` — the board alone is not a flush.
     */
    flush_possible: (f) => f.maxSuitCount >= 3,

    /** Five in a row on the board itself, so the straight is already there. */
    straight_complete: (f) => f.straightOnBoardTop > 0,

    /** Five of one suit on the board itself. */
    flush_complete: (f) => f.maxSuitCount >= 5,

    /*
     * The static-to-dynamic scale: how likely the hand that leads on the flop
     * is to still lead by the river. These are tags rather than conditions each
     * principle spells out because rules reason about the category as a whole,
     * and a category re-derived at every rule ends up subtly different each
     * time. The scale reads the height of the top card first and draws second:
     * a low top card invites overcards, which change more hands than most
     * draws do. The three are mutually exclusive and exhaustive.
     */

    /**
     * Top card nine or lower, so overcards are likely to arrive; or connected
     * with straight potential, whatever the height.
     *
     * Monotone is deliberately not a clause: a high monotone flop belongs with
     * the flush-draw boards in `semi_static`, whose two-of-a-suit test covers
     * three of a suit too. A low monotone flop is dynamic anyway, by rank.
     */
    dynamic: isDynamic,

    /**
     * A high board with one draw on it: two of a suit, or three ranks a
     * straight can use. Two of a suit, not three, because the flush DRAW is
     * what moves the board off static; `flush_possible` would ask whether three
     * are already out. Fewer than five distinct ranks, because a board with no
     * card left to come has no draw to be semi-static about.
     */
    semi_static: isSemiStatic,

    /** High and without a draw: the flop leader is rarely overtaken on later streets. */
    static: (f) => !isDynamic(f) && !isSemiStatic(f),

    /**
     * Two or more non-ace wheel cards (deuce through five). Players who play
     * any ace hold wheel gutshots often on such a flop, so a third wheel card
     * changes a lot, and rules turn on it.
     */
    two_wheel_cards: (f) => f.ranks.filter((rank) => rank >= 2 && rank <= 5).length >= 2,
};

/**
 * The tags a board carries, sorted.
 *
 * Sorted by the ontology's own tag order rather than alphabetically, so the
 * output reads in a consistent grouping (structure, then suits, then ranks)
 * wherever it is displayed.
 */
export function boardTags(board: readonly Card[]): BoardTag[] {
    const facts = boardFacts(board);
    return BOARD_TAGS.filter((tag) => BOARD_TAG_RULES[tag](facts));
}

/** Tags that can only ever appear once the board is complete enough to carry them. */
export const FLOP_UNREACHABLE_TAGS: readonly BoardTag[] = ['flush_complete', 'straight_complete'];
