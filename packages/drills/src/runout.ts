/**
 * What a turn or river card CHANGED.
 *
 * Implemented as the delta between `boardFacts(before)` and
 * `boardFacts(before + card)` rather than as its own reading of the cards. That
 * is the whole design: two modules that each decide independently what
 * "monotone" or "four to a straight" means will eventually disagree, and the
 * disagreement will show up as a drill whose board tags and runout tags
 * describe different boards.
 *
 * Several tags can apply at once — a card can pair the board and complete a
 * flush — so the result is a set. `brick` is the one that cannot: it means
 * precisely that none of the others fired.
 */

import { RANK_VALUE, type Card } from './cards/cards.ts';
import { RUNOUT_TAGS, type RunoutTag } from './ontology/types.ts';
import { boardFacts, type BoardFacts } from './boardFacts.ts';

export class BadRunoutError extends Error {
    constructor(readonly count: number) {
        super(`A runout follows a three or four card board, got ${count}`);
        this.name = 'BadRunoutError';
    }
}

/** A flush is out there once three of a suit are showing. */
const flushPossible = (facts: BoardFacts): boolean => facts.maxSuitCount >= 3;

/** A straight is out there once three board ranks share a five-window. */
const straightPossible = (facts: BoardFacts): boolean => facts.bestWindowCount >= 3;

/**
 * A straight fill that a reader should actually fear: both hole ranks seven or
 * higher.
 *
 * Geometry alone cannot tell a scare card from a blank. The T on K-J-5 is
 * filled by A-Q and Q-9, holdings that call raised pots every day; the 3 on
 * A-8-5 is filled only by 4-2, the gap-trash class that rarely sees a raised
 * flop. Two cards of seven or higher is the line between the two kinds of
 * holding real calling ranges are made of and the kind they are not.
 */
const qualifyingFillCount = (facts: BoardFacts): number =>
    facts.straightFillPairs.filter(([lowRank]) => lowRank >= 7).length;

/** The card that landed, against the board before and after it. */
interface Landing {
    readonly before: BoardFacts;
    readonly after: BoardFacts;
    readonly card: Card;
    readonly hole: readonly Card[] | undefined;
}

const moreToCome = (landing: Landing): boolean => landing.after.cardCount < 5;

const completesQualifyingStraight = ({ before, after }: Landing): boolean =>
    qualifyingFillCount(before) === 0 && qualifyingFillCount(after) > 0;

/** One test per tag except `brick`, which is filled in as "none of these". */
const RUNOUT_RULES: Readonly<Record<Exclude<RunoutTag, 'brick'>, (landing: Landing) => boolean>> = {
    /** The card matches a rank already showing. */
    pairs_board: ({ before, card }) => (before.rankCounts[RANK_VALUE[card.rank]] ?? 0) > 0,

    /** The card matches one of the hero's own cards. */
    pairs_hero: ({ hole, card }) => hole?.some((held) => held.rank === card.rank) ?? false,

    /** Higher than everything that was showing. */
    overcard: ({ before, card }) => RANK_VALUE[card.rank] > before.highest,

    /** A flush is possible now and was not before. */
    flush_completing: ({ before, after }) => !flushPossible(before) && flushPossible(after),

    /** More of a suit than before, still short of a flush, and a card to come. */
    flush_drawing: (landing) => moreToCome(landing)
        && !flushPossible(landing.after)
        && landing.after.maxSuitCount > landing.before.maxSuitCount,

    /**
     * The card made a FOURTH of its suit show — or a fifth.
     *
     * Neither completing (a flush was already possible) nor drawing (it is past
     * the draw), so without this tag `brick` claimed it and the turn that put
     * four hearts out read as a card that changed nothing. It is the opposite:
     * any single card of that suit now beats a made hand, and one more puts the
     * flush on the board itself, which is why the fifth is here too.
     */
    four_flush: ({ before, after }) => after.maxSuitCount >= 4 && after.maxSuitCount > before.maxSuitCount,

    /**
     * A straight somebody would actually play just became possible: the card
     * creates the first QUALIFYING fill (see `qualifyingFillCount`). Raw
     * window geometry called gap-trash fills scare cards and refused rules
     * their own blanks. The qualifying test also fires when trash straights
     * were already possible and a real one arrives (the 7 on 6-5-2 brings 9-8),
     * which raw geometry read as nothing happening.
     */
    straight_completing: completesQualifyingStraight,

    /**
     * A straight became possible, but only for holdings containing a six or
     * lower — the wheel-gutter class (4-2 after the 3 on A-8-5). Split from
     * `straight_completing` so a rule whose premise is exactly that low card,
     * such as "keep betting unless a third wheel card comes", can name it.
     */
    straight_completing_low: (landing) => !straightPossible(landing.before)
        && straightPossible(landing.after)
        && !completesQualifyingStraight(landing),

    /** Closer to a straight than before, still short of one, and a card to come. */
    straight_drawing: (landing) => moreToCome(landing)
        && !straightPossible(landing.after)
        && landing.after.bestWindowCount > landing.before.bestWindowCount,

    /**
     * The card put a FOURTH board rank inside one five-window — or a fifth,
     * which is the straight on the board.
     *
     * The mirror of `four_flush`, and a brick for the same reason: a straight
     * has been "possible" since three ranks shared a window, so the card that
     * takes it to four completes nothing and draws to nothing. It is the card
     * that gives every one-card straight in the deck to somebody.
     */
    four_straight: ({ before, after }) => after.bestWindowCount >= 4 && after.bestWindowCount > before.bestWindowCount,
};

/**
 * Classifies the card that just landed.
 *
 * `hole` is optional: without it every tag except `pairs_hero` still resolves,
 * which is what lets the validator reason about a runout before it has dealt
 * anybody in.
 */
export function classifyRunout(before: readonly Card[], card: Card, hole?: readonly Card[]): RunoutTag[] {
    if (before.length < 3 || before.length > 4) throw new BadRunoutError(before.length);

    const landing: Landing = { before: boardFacts(before), after: boardFacts([...before, card]), card, hole };
    const tags = RUNOUT_TAGS.filter((tag) => tag !== 'brick' && RUNOUT_RULES[tag](landing));
    return tags.length > 0 ? tags : ['brick'];
}
