/**
 * Does a dealt board, and then a dealt hand, fit what the rule's situation
 * asks for?
 */
import type { Card } from '../cards/cards.ts';
import type { DrawClass, HandClass, RunoutTag, Situation } from '../ontology/types.ts';
import { boardTags } from '../boardTexture.ts';
import { classifyRunout } from '../runout.ts';
import { classifyMadeHand } from '../handClass.ts';
import { classifyRelativeStrength } from '../relativeStrength.ts';

/** An exclusion the board alone already decides: anything but `brick`, which a hand may still turn. */
const boardExcludes = (unwanted: readonly RunoutTag[], tags: readonly RunoutTag[]): boolean =>
    unwanted.some((tag) => tag !== 'brick' && tags.includes(tag));

/**
 * The runout judged WITHOUT the hero's cards, which is only a necessary
 * condition: every tag but `pairs_hero` is a fact about the board, so a board
 * that fails this can never pass once the hand is known. The sufficient check
 * is `matchesRunout`, once there is a hand to ask.
 */
function boardRunoutFits(board: readonly Card[], wanted: readonly RunoutTag[], unwanted: readonly RunoutTag[]): boolean {
    const last = board.at(-1);
    if (board.length < 4 || last === undefined) return false;
    const landed = classifyRunout(board.slice(0, -1), last);
    // `pairs_hero` is the one tag that is not about the board, so a rule
    // wanting it cannot be refused a board here: whether the card pairs the
    // hero is decided when the hand is.
    const wantsBoardTag = wanted.length > 0 && !wanted.includes('pairs_hero');
    if (wantsBoardTag && !wanted.some((tag) => landed.includes(tag))) return false;
    // An exclusion can only get STRICTER once the hand is known (`brick` may
    // turn into `pairs_hero`, never the reverse), so a board the exclusion
    // refuses here is refused for good; one it passes is asked again later.
    if (boardExcludes(unwanted, landed)) return false;
    // On the river an exclusion reads the turn card too (1.8): the matcher
    // does, and a board the generator passes that the matcher refuses is a
    // spot nothing governs.
    const turn = board[3];
    return board.length !== 5 || turn === undefined || !boardExcludes(unwanted, classifyRunout(board.slice(0, 3), turn));
}

/**
 * Whether a board fits the rule's texture and runout claims.
 *
 * Texture is a property of the FLOP: "a static flop", "a dynamic flop". A turn
 * card that changes the picture is the runout's news to carry, not the flop's
 * to retract. Tagging the full board made a river rule scoped to dynamic flops
 * claim an ace-high board whose wheel turn back-formed a straight.
 */
export function matchesBoard(board: readonly Card[], situation: Situation): boolean {
    const tags = new Set(boardTags(board.slice(0, 3)));
    if ((situation.board_require ?? []).some((tag) => !tags.has(tag))) return false;
    if ((situation.board_exclude ?? []).some((tag) => tags.has(tag))) return false;
    const wanted = situation.runout_any ?? [];
    const unwanted = situation.runout_exclude ?? [];
    if (wanted.length === 0 && unwanted.length === 0) return true;
    return boardRunoutFits(board, wanted, unwanted);
}

/**
 * The runout as the SCENARIO will carry it — with the hero's cards.
 *
 * `brick` means "no other tag fired", and `pairs_hero` is a tag. So a turn
 * that pairs one of the hero's cards is a brick to the board alone and NOT a
 * brick once the hand is dealt. For a long time the generator judged the
 * runout without the hand and the scenario judged it with one, and the two
 * disagreed on exactly those cards: the matcher then found no principle for
 * a spot the generator had just built. Asked here, after the hand is drawn,
 * so a rule scoped to bricks is never dealt a card that pairs the hero.
 */
export function matchesRunout(board: readonly Card[], hole: readonly Card[], situation: Situation): boolean {
    const wanted = situation.runout_any ?? [];
    const unwanted = situation.runout_exclude ?? [];
    const last = board.at(-1);
    const silent = wanted.length === 0 && unwanted.length === 0;
    if (silent || board.length < 4 || last === undefined) return true;
    const landed = classifyRunout(board.slice(0, -1), last, hole);
    const prior = turnRunout(board, hole);
    return (wanted.length === 0 || wanted.some((tag) => landed.includes(tag)))
        && !unwanted.some((tag) => landed.includes(tag) || prior.includes(tag));
}

/** On the river, what the turn card changed; nothing on earlier streets. */
function turnRunout(board: readonly Card[], hole: readonly Card[]): readonly RunoutTag[] {
    const turn = board[3];
    return board.length === 5 && turn !== undefined ? classifyRunout(board.slice(0, 3), turn, hole) : [];
}

/** Whether a hand's draws fit what the rule wants and refuses. */
function drawsFit(draws: readonly DrawClass[], situation: Situation): boolean {
    const wantedDraws = situation.draw_class_any ?? [];
    const unwantedDraws = situation.draw_class_exclude ?? [];
    if (wantedDraws.length > 0 && !draws.some((draw) => wantedDraws.includes(draw))) return false;
    return !draws.some((draw) => unwantedDraws.includes(draw));
}

/** Whether a rule says anything about the hero's hand at all. */
const readsHand = (situation: Situation, targetClass: HandClass | undefined): boolean =>
    targetClass !== undefined
    || (situation.draw_class_any ?? []).length > 0
    || (situation.draw_class_exclude ?? []).length > 0
    || (situation.relative_strength_any ?? []).length > 0;

/**
 * Does the hand fit the rule — and, where the rule lists several classes, is
 * it the ONE chosen for this deal?
 *
 * Random hole cards make no pair about six times in ten, so a rule listing
 * eight classes got them in deck proportion and a drill about strong hands was
 * mostly seven-high folds. The caller picks a target class per board, evenly
 * from the list, and the deal is rejected until it makes that class; a board
 * that cannot make it costs one board's tries and the next board picks again.
 */
export function matchesHand(
    hole: readonly Card[],
    board: readonly Card[],
    situation: Situation,
    targetClass: HandClass | undefined,
): boolean {
    if (!readsHand(situation, targetClass)) return true;
    const made = classifyMadeHand(hole, board);
    // The target IS the class filter: the caller draws it from this same list,
    // so there is one class to hit rather than a list to fall into.
    if (targetClass !== undefined && made.handClass !== targetClass) return false;
    if (!drawsFit(made.draws, situation)) return false;
    const wantedStrength = situation.relative_strength_any ?? [];
    return wantedStrength.length === 0 || wantedStrength.includes(classifyRelativeStrength(hole, board));
}
