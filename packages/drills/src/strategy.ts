/**
 * What the source does with EVERY starting hand in this exact spot.
 *
 * Drawing only the range set of whichever rule happened to govern would show
 * "the button 3-betting range" on one spot and "the button calling range" on the
 * next, in the same seat against the same raise, with no way to tell that they
 * were two halves of one strategy. Which slice a reader saw would depend on
 * their own hand.
 *
 * So this asks the question the reader is actually asking — *what would this
 * source do with each hand here?* — and answers it the way the engine answers
 * the spot: arbitration over all the principles, then resolution. It cannot
 * contradict the verdict, because it is the same computation with the hole
 * cards swapped, one hundred and sixty-nine times.
 *
 * A starting-hand grid is the wrong shape for a postflop spot — what matters
 * there is what the hand BECAME on the board — so `postflopStrategy` below asks
 * the same question down the hand-class axis instead.
 */

import type { Action, DrawClass, HandClass, Principle, SizingBucket } from './ontology/types.ts';
import { DRAW_CLASS_LABEL, HAND_CLASS_LABEL } from './ontology/types.ts';
import type { Scenario } from './generator/types.ts';
import { RANKS, SUITS, type Card } from './cards/cards.ts';
import { comboIndex, type ComboSet } from './range/comboSet.ts';
import { cellForCombo, GRID_CELLS, type GridCell } from './range/grid.ts';
import { governingPrinciple } from './grading/arbitrate.ts';
import { resolveGoverning } from './grading/resolve.ts';
import { classifyMadeHand, type MadeHand } from './handClass.ts';
import { classifyRelativeStrength } from './relativeStrength.ts';

export interface StrategyCell {
    /** Grid label — `AKs`, `77`, `T9o`. */
    readonly label: string;
    readonly action: Action;
    readonly sizing?: SizingBucket | undefined;
    /** Which principle answered, for a reader who wants the reference. */
    readonly principleId: string;
}

/** The arbitration and resolution context: ranges, and the table's texture where one was chosen. */
interface StrategyContext {
    readonly ranges: ReadonlyMap<string, ComboSet>;
    readonly gameTexture: string | undefined;
}

/**
 * One hand standing for a whole cell.
 *
 * Built from the cell's own ranks and form rather than searched for among its
 * combinations: every cell has four, six or twelve of them, so a search would
 * carry a "found nothing" branch that no input can reach — and every combination
 * in a cell plays identically before a board exists, which is the only reason
 * one may stand for the rest at all.
 */
function representative(cell: GridCell): readonly [Card, Card] {
    return [
        { rank: cell.high, suit: 'h' },
        { rank: cell.low, suit: cell.form === 'suited' ? 'h' : 's' },
    ];
}

/**
 * The grid cell the hero's own hand sits in — `AJo`, `AKs`, `77`.
 *
 * The switcher that reaches the grid is labelled with this rather than with the
 * two cards, because the cell is what will be ringed: `A♦J♠` and `A♣J♥` are one
 * square, and naming the suits would promise a distinction the picture does not
 * make. Two real cards always map to one of the 1,326 combinations and so to
 * one of the 169 cells; a miss is a bug in the grid, not a hand to handle.
 */
export const handCell = (scenario: Scenario): string => {
    const cell = cellForCombo(comboIndex(scenario.hole[0], scenario.hole[1]));
    if (cell === undefined) throw new Error('two hole cards fall outside the starting-hand grid');
    return cell.label;
};

/**
 * Every cell the source has an answer for, keyed by grid label.
 *
 * A cell nobody answers is absent rather than folded: a rule that abstains has
 * said nothing, and printing "fold" for it would be the engine inventing the
 * one answer this whole design refuses to invent.
 */
export function preflopStrategy(
    scenario: Scenario,
    principles: readonly Principle[],
    ranges: ReadonlyMap<string, ComboSet>,
    gameTexture?: string,
): Map<string, StrategyCell> {
    const cells = new Map<string, StrategyCell>();
    if (scenario.street !== 'preflop') return cells;

    // The same context the verdict above the grid was graded under — a
    // loose-game modifier that changed the answer must change the picture.
    const context: StrategyContext = { ranges, gameTexture };

    for (const cell of GRID_CELLS) {
        const spot: Scenario = { ...scenario, hole: representative(cell) };
        const governing = governingPrinciple(spot, principles, context);
        if (governing === null) continue;

        // `resolveGoverning` rather than `resolveOutcome`: arbitration has
        // already dropped every principle that abstains on this spot, so the
        // one it returns answers by construction.
        const resolution = resolveGoverning(governing, spot, context);

        cells.set(cell.label, {
            label: cell.label,
            action: resolution.outcome.action,
            sizing: resolution.outcome.sizing,
            principleId: governing.id,
        });
    }

    return cells;
}

/* ── postflop: the same question, down the hand-class axis ─────────────────── */

/**
 * One row of the postflop picture: a kind of hand, and what the source does
 * with it here.
 */
export interface StrategyRow {
    /** `set`, `flush_draw` — the vocabulary member this row stands for. */
    readonly key: HandClass | DrawClass;
    /** Named for a reader: "a set", "flush draw". */
    readonly label: string;
    /** The example the answer was computed from, so the row is checkable. */
    readonly hole: readonly [Card, Card];
    readonly action: Action;
    readonly sizing?: SizingBucket | undefined;
    readonly principleId: string;
    /** True for the row the hero's own hand sits in. */
    readonly yours: boolean;
}

/**
 * Every hand class, strongest first.
 *
 * All thirteen rather than a curated shortlist, for one reason: a reader whose
 * own hand is missing from the table cannot tell whether the source said
 * nothing about it or the table simply does not show that kind of hand. Rows
 * only appear where the source answers, so the list being long costs nothing.
 */
export const STRATEGY_CLASSES: readonly HandClass[] = [
    'full_house_plus', 'flush', 'straight', 'set', 'two_pair', 'overpair',
    'top_pair_good_kicker', 'top_pair_weak_kicker', 'second_pair', 'weak_pair',
    'underpair', 'ace_high', 'no_pair',
];

/** And the draws, which are a different axis and belong under their own heading. */
export const STRATEGY_DRAWS: readonly DrawClass[] = ['combo_draw', 'flush_draw', 'open_ended', 'gutshot'];

/** Every card not on the board, in deck order. */
function liveCards(board: readonly Card[]): Card[] {
    const dead = new Set(board.map((card) => `${card.rank}${card.suit}`));
    return RANKS.flatMap((rank) => SUITS.map((suit): Card => ({ rank, suit })))
        .filter((card) => !dead.has(`${card.rank}${card.suit}`));
}

/** The first pair of live cards, in deck order, whose made hand on `board` passes `accept`. */
function firstHole(
    live: readonly Card[],
    board: readonly Card[],
    accept: (made: MadeHand) => boolean,
): readonly [Card, Card] | undefined {
    for (const [index, first] of live.entries()) {
        for (const second of live.slice(index + 1)) {
            const hole: readonly [Card, Card] = [first, second];
            if (accept(classifyMadeHand(hole, board))) return hole;
        }
    }
    return undefined;
}

/**
 * A hand that stands for a kind of hand, on THIS board.
 *
 * The preflop grid may use one combination per cell because every combination
 * in a cell plays identically before a board exists. That reasoning does not
 * survive a board: A♣K♣ and A♠K♦ are one cell preflop and are a flush draw and
 * ace-high on a two-club flop. So a representative here is SEARCHED for, over
 * every pair of live cards, and chosen deliberately:
 *
 *   - for a made-hand row, the first pair that makes the class and holds NO
 *     draw, so the row is about the made hand and not about a draw that came
 *     with it;
 *   - for a draw row, the first pair that has made NOTHING and whose STRONGEST
 *     draw is the one asked for. `classifyDraws` lists a combo draw alongside
 *     its components, so "the first hand that includes a gutshot" is a combo
 *     draw about a third of the time — and a gutshot row showing 5♥4♥ on a
 *     two-heart flop is a row about the wrong hand.
 *
 * `undefined` when the board cannot make the class at all — no set without a
 * pair to hit, no flush draw on a rainbow river — and that absence is the
 * honest answer rather than a row with an invented hand in it.
 */
export function representativeFor(
    board: readonly Card[],
    want: HandClass | DrawClass,
    isDraw: boolean,
): readonly [Card, Card] | undefined {
    const live = liveCards(board);
    if (isDraw) {
        // Everything the row would be outranked by, in `STRATEGY_DRAWS` order.
        const stronger = STRATEGY_DRAWS.slice(0, STRATEGY_DRAWS.findIndex((draw) => draw === want));
        return firstHole(live, board, (made) => made.handClass === 'no_pair'
            && made.draws.some((draw) => draw === want)
            && !stronger.some((draw) => made.draws.includes(draw)));
    }
    // Two passes for a made hand: the clean example first, then any example at
    // all. A board can make a class only WITH a draw attached — every two pair
    // on a two-tone flop that also puts a flush draw in your hand — and showing
    // that hand is better than dropping the row, which would read as "the
    // source says nothing here" when the source says plenty.
    return firstHole(live, board, (made) => made.handClass === want && made.draws[0] === 'none')
        ?? firstHole(live, board, (made) => made.handClass === want);
}

/** One kind of hand's row request: which axis, how it is named, and whether it is the hero's. */
interface RowsRequest<K extends HandClass | DrawClass> {
    readonly keys: readonly K[];
    readonly isDraw: boolean;
    readonly labels: Readonly<Record<K, string>>;
    readonly mine: (key: K) => boolean;
}

/** The spot as it would be with `hole` in the hero's hand, every card-derived coordinate re-derived. */
function withHole(scenario: Scenario, hole: readonly [Card, Card]): Scenario {
    // Re-derived the way the generator derives them, so the swapped hand is a
    // scenario the matcher can read rather than the hero's classification with
    // somebody else's cards attached.
    const made = classifyMadeHand(hole, scenario.board);
    return {
        ...scenario,
        hole,
        handClass: made.handClass,
        draws: made.draws,
        relativeStrength: classifyRelativeStrength(hole, scenario.board),
    };
}

/** The answered rows for one axis, in the order of `request.keys`. */
function strategyRows<K extends HandClass | DrawClass>(
    scenario: Scenario,
    principles: readonly Principle[],
    context: StrategyContext,
    request: RowsRequest<K>,
): StrategyRow[] {
    const rows: StrategyRow[] = [];
    for (const key of request.keys) {
        // The reader's OWN row is the reader's own hand, not a stand-in for it:
        // somebody else's cards on the row badged "Yours" reads as a mistake,
        // and answering that row from the real scenario makes it agree with the
        // verdict above by construction rather than by luck.
        const hole = request.mine(key) ? scenario.hole : representativeFor(scenario.board, key, request.isDraw);
        if (hole === undefined) continue;
        const spot = withHole(scenario, hole);
        const governing = governingPrinciple(spot, principles, context);
        if (governing === null) continue;
        const resolution = resolveGoverning(governing, spot, context);
        rows.push({
            key,
            label: request.labels[key],
            hole,
            action: resolution.outcome.action,
            sizing: resolution.outcome.sizing,
            principleId: governing.id,
            yours: request.mine(key),
        });
    }
    return rows;
}

/**
 * What the source does here with each kind of hand.
 *
 * The same computation as the verdict — `governingPrinciple` then
 * `resolveGoverning`, with the hole cards swapped — so the table cannot
 * disagree with the answer above it. A kind of hand nobody answers is ABSENT,
 * not folded: after a rule is narrowed to the hands its source discusses, the
 * blank IS the finding ("this source does not say what to do here with a
 * set"), and printing an invented answer would undo the narrowing.
 *
 * Empty before the flop, where `preflopStrategy` is the right picture.
 */
export function postflopStrategy(
    scenario: Scenario,
    principles: readonly Principle[],
    ranges: ReadonlyMap<string, ComboSet>,
    gameTexture?: string,
): { readonly made: readonly StrategyRow[]; readonly draws: readonly StrategyRow[] } {
    if (scenario.street === 'preflop') return { made: [], draws: [] };

    const context: StrategyContext = { ranges, gameTexture };
    const yours = classifyMadeHand(scenario.hole, scenario.board);
    return {
        made: strategyRows(scenario, principles, context, {
            keys: STRATEGY_CLASSES, isDraw: false, labels: HAND_CLASS_LABEL, mine: (key) => key === yours.handClass,
        }),
        draws: strategyRows(scenario, principles, context, {
            keys: STRATEGY_DRAWS, isDraw: true, labels: DRAW_CLASS_LABEL, mine: (key) => yours.draws.includes(key),
        }),
    };
}

/**
 * Does the source say the same thing here however you are holding?
 *
 * The sentence the panel exists to be able to print. A rule can deliberately
 * give one answer to every hand — checking the whole range so the few strong
 * hands hide among the many weak ones — and a reader should be told that is the
 * point; a rule that simply never reads the cards looks identical on screen,
 * which is why the validator refuses it. Fewer than two answered rows is not
 * evidence of either, so it says nothing.
 */
export function isWholeRange(rows: readonly StrategyRow[]): boolean {
    const [first] = rows;
    if (first === undefined || rows.length < 2) return false;
    const firstAnswer = `${first.action}:${first.sizing ?? ''}`;
    return rows.every((row) => `${row.action}:${row.sizing ?? ''}` === firstAnswer);
}
