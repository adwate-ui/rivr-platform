/**
 * Dealing the cards: a board that fits the rule, then a hand that fits the
 * board and the story, searched within fixed budgets.
 *
 * **Never throws and never loops unbounded.** This runs on a phone, and a rule
 * whose board can only be found one time in a million must cost a banner rather
 * than a locked tab.
 */
import { DECK_CARDS, type Card } from '../cards/cards.ts';
import type { HandClass, Rule, Situation, Street } from '../ontology/types.ts';
import { boardTags } from '../boardTexture.ts';
import { classifyRunout } from '../runout.ts';
import { classifyMadeHand } from '../handClass.ts';
import { classifyRelativeStrength } from '../relativeStrength.ts';
import type { Rng } from '../prng.ts';
import { comboIndex, combosToList, fullCombos, hasCombo, subtractCombos, type ComboSet } from '../range/comboSet.ts';
import { hasEarlierStep } from '../nodePath.ts';
import { heroPreflopAction } from './preflopLine.ts';
import { constrained } from './sampling.ts';
import { matchesBoard, matchesHand, matchesRunout } from './fit.ts';
import type { StackSizing } from './potAndStack.ts';
import type { Table } from './table.ts';
import type { GenerateOptions, GenerateResult, LineFits, Scenario } from './types.ts';

export const HAND_ATTEMPT_LIMIT = 400;
export const BOARD_ATTEMPT_LIMIT = 2_000;

/**
 * How many hands the LINE check may be asked about before the search gives up.
 *
 * The board and hand limits MULTIPLY — two thousand boards times four hundred
 * hands — and the line check is the most expensive thing per candidate: it
 * rewinds the spot and arbitrates the corpus over it, about two and a half
 * milliseconds each. A rule whose story no hand can have arrived at would
 * spend eight hundred thousand of them, which on a phone is the locked tab
 * this generator promises never to cost.
 *
 * 400 because that is sixteen times the most any spot in the first encoded
 * corpus ever needed: measured over 8,400 builds, the median was zero, the
 * 99th percentile one, and the worst single rule spent 25. So the cap ends only
 * searches that were not going to finish, and it ends them in about a second
 * with a banner naming the street the trouble is on.
 */
export const LINE_ATTEMPT_LIMIT = 400;

const BOARD_SIZE: Readonly<Record<Street, number>> = { preflop: 0, flop: 3, turn: 4, river: 5 };

/** How many community cards a street has. `lineFits` slices a board back by it. */
export const boardSizeFor = (street: Street): number => BOARD_SIZE[street];

/** Everything sampled before the cards: the table, the stack, and the opponent's type and size. */
export type Coordinates = Table & StackSizing & Pick<Scenario, 'villainType' | 'villainRaiseSize'>;

interface Deal {
    readonly situation: Situation;
    readonly coordinates: Coordinates;
    readonly holder: Scenario['holder'];
    readonly rangeCombos: readonly [Card, Card][] | undefined;
    readonly playable: ComboSet | undefined;
    readonly fitsLine: LineFits | undefined;
    readonly accept: (candidate: Scenario) => boolean;
    readonly limits: { readonly board: number; readonly hand: number; readonly line: number };
    readonly seed: number;
}

/**
 * Which search actually ran out. "No board like that exists", "the board was
 * fine but no hand fitted it", "the hero could not have played the earlier
 * streets that way" and "the rule declines every spot it admits" are four
 * different authoring mistakes, and telling them apart is the difference
 * between a useful failure and a shrug.
 */
interface Search {
    attempts: number;
    /** The line check's own budget, spent across every board — see `LINE_ATTEMPT_LIMIT`. */
    lineChecks: number;
    boardEverMatched: boolean;
    handEverFound: boolean;
    lineEverFitted: boolean;
    found: Scenario | null;
}

/** One board and what is left of the deck, with the hand class chosen for it. */
interface Dealt {
    readonly board: readonly Card[];
    readonly rest: readonly Card[];
    readonly targetClass: HandClass | undefined;
}

/**
 * Which side of the range the hero is dealt. A rule that authored only
 * `out_of_range` answers nothing at all if it is always dealt in-range.
 */
function rangeCombosFor(options: GenerateOptions): [Card, Card][] | undefined {
    if (options.range === undefined) return undefined;
    return combosToList(options.rangeSide === 'out' ? subtractCombos(fullCombos(), options.range) : options.range);
}

/**
 * Whose cards are dealt. A villain-perspective question deals somebody else's
 * cards, so neither "could the hero have raised this preflop" nor "does the
 * hero's own flop bet hold up" is a question about them; filtering on either
 * would reject exactly the holdings the question is about.
 */
const holderOf = (rule: Rule): Scenario['holder'] =>
    (rule.kind === 'classify' && rule.perspective === 'villain' ? 'villain' : 'hero');

/**
 * The hands the source would have played the hero's preflop action with from
 * this seat, read the way the hand history reads the action. Only a predicate
 * rule is filtered: a range rule's hand is its range.
 */
function playableFor(coordinates: Coordinates, nodePath: readonly string[], options: GenerateOptions): ComboSet | undefined {
    if (options.playable === undefined) return undefined;
    const { street, potType, playerCount, postflopFacingState } = coordinates;
    return options.playable(coordinates.heroPosition, heroPreflopAction({ street, potType, playerCount, postflopFacingState, nodePath }));
}

/**
 * Only rules whose line has a hero decision on an earlier postflop street have
 * anything for `lineFits` to check, asked once here rather than of every hand.
 */
function lineCheckFor(street: Street, nodePath: readonly string[], options: GenerateOptions): LineFits | undefined {
    if (options.lineFits === undefined || street === 'preflop') return undefined;
    return hasEarlierStep(nodePath, 'hero', street) ? options.lineFits : undefined;
}

function prepareDeal(rule: Rule, coordinates: Coordinates, options: GenerateOptions, rangeCombos: Deal['rangeCombos']): Deal {
    const nodePath = rule.situation.node_path ?? [];
    const holder = holderOf(rule);
    return {
        situation: rule.situation,
        coordinates,
        holder,
        rangeCombos,
        playable: holder === 'hero' && rangeCombos === undefined ? playableFor(coordinates, nodePath, options) : undefined,
        fitsLine: lineCheckFor(coordinates.street, nodePath, options),
        accept: options.accept ?? (() => true),
        limits: {
            board: options.boardAttemptLimit ?? BOARD_ATTEMPT_LIMIT,
            hand: options.handAttemptLimit ?? HAND_ATTEMPT_LIMIT,
            line: options.lineAttemptLimit ?? LINE_ATTEMPT_LIMIT,
        },
        seed: options.seed,
    };
}

/** What the cards say, postflop: the flop's texture and the hand the hero made. */
function handFacts(board: readonly Card[], hole: readonly Card[], postflop: boolean): Pick<Scenario, 'boardTags' | 'handClass' | 'draws' | 'relativeStrength'> {
    if (!postflop) return { boardTags: [], handClass: undefined, draws: undefined, relativeStrength: undefined };
    const made = classifyMadeHand(hole, board);
    return {
        boardTags: boardTags(board.slice(0, 3)),
        handClass: made.handClass,
        draws: made.draws,
        relativeStrength: classifyRelativeStrength(hole, board),
    };
}

/** What the last card, and on the river the turn card, changed — read with the hero's cards. */
function runoutFacts(board: readonly Card[], hole: readonly Card[]): Pick<Scenario, 'runouts' | 'priorRunouts'> {
    const last = board.at(-1);
    const turn = board[3];
    return {
        runouts: board.length >= 4 && last !== undefined ? classifyRunout(board.slice(0, -1), last, hole) : undefined,
        priorRunouts: board.length === 5 && turn !== undefined ? classifyRunout(board.slice(0, 3), turn, hole) : undefined,
    };
}

/** The sampled coordinates plus a board and a hand, classified. */
function buildScenario(deal: Deal, board: readonly Card[], hole: readonly [Card, Card]): Scenario {
    return {
        ...deal.coordinates,
        board,
        hole,
        holder: deal.holder,
        ...handFacts(board, hole, deal.coordinates.street !== 'preflop'),
        ...runoutFacts(board, hole),
        // Verbatim. The generator adds nothing to the action history.
        nodePath: [...(deal.situation.node_path ?? [])],
        seed: deal.seed,
    };
}

/**
 * The hero holds something from the drawn SIDE of the rule's range, and that
 * range is the point of the drill, so it is drawn from, not rejected into.
 */
function drawFromRange(rangeCombos: readonly [Card, Card][], board: readonly Card[], rng: Rng): [Card, Card] | null {
    const [a, b] = rng.pick(rangeCombos);
    const clash = board.some((card) => card.rank === a.rank && card.suit === a.suit)
        || board.some((card) => card.rank === b.rank && card.suit === b.suit);
    return clash ? null : [a, b];
}

/**
 * Two distinct cards drawn from what the board left, per try. Walking
 * `rest[tries * 2]` instead capped this at ~23 tries per board however large
 * `handAttemptLimit` was, which only showed up once a rule wanted a rare hand.
 */
function drawHole(deal: Deal, { board, rest, targetClass }: Dealt, rng: Rng): [Card, Card] | null {
    if (deal.rangeCombos !== undefined) return drawFromRange(deal.rangeCombos, board, rng);
    const first = rng.nextInt(rest.length);
    let second = rng.nextInt(rest.length - 1);
    if (second >= first) second += 1;
    const a = rest[first];
    const b = rest[second];
    if (a === undefined || b === undefined) return null;
    if (deal.playable !== undefined && !hasCombo(deal.playable, comboIndex(a, b))) return null;
    return matchesHand([a, b], board, deal.situation, targetClass) ? [a, b] : null;
}

/**
 * The hero's own earlier streets, against the source's own rules: after
 * `matchesHand` so the cost falls only on hands the rule already wanted, and
 * before `accept` so a spot the reader is shown is one the whole line supports.
 */
function tryCandidate(deal: Deal, search: Search, candidate: Scenario): void {
    if (deal.fitsLine !== undefined && deal.holder === 'hero') {
        search.lineChecks += 1;
        if (!deal.fitsLine(candidate)) return;
    }
    search.lineEverFitted = true;
    if (deal.accept(candidate)) search.found = candidate;
}

function searchHands(deal: Deal, search: Search, dealt: Dealt, rng: Rng): void {
    for (let tries = 0; tries < deal.limits.hand && search.found === null && search.lineChecks < deal.limits.line; tries += 1) {
        const hole = drawHole(deal, dealt, rng);
        // The hand changes what the last card MEANS: a card that pairs the hero
        // is not a brick. Asked for range rules too, because a preflop lookup
        // can sit on a turn or river situation.
        if (hole === null || !matchesRunout(dealt.board, hole, deal.situation)) continue;
        search.handEverFound = true;
        tryCandidate(deal, search, buildScenario(deal, dealt.board, hole));
    }
}

/** One target class per board, evenly from the rule's list — see `matchesHand`. */
function pickTargetClass(deal: Deal, rng: Rng): HandClass | undefined {
    const choices = deal.situation.hand_class_any;
    return deal.coordinates.street !== 'preflop' && constrained(choices) ? rng.pick(choices) : undefined;
}

function searchBoards(deal: Deal, rng: Rng): Search {
    const search: Search = {
        attempts: 0, lineChecks: 0, boardEverMatched: false, handEverFound: false, lineEverFitted: false, found: null,
    };
    const boardSize = BOARD_SIZE[deal.coordinates.street];
    while (search.attempts < deal.limits.board && search.found === null && search.lineChecks < deal.limits.line) {
        search.attempts += 1;
        const shuffled = rng.shuffle(DECK_CARDS);
        const board = shuffled.slice(0, boardSize);
        // Preflop there is no board to tag, and asking for one is a stage-4
        // error rather than something to reject boards against here.
        if (boardSize > 0 && !matchesBoard(board, deal.situation)) continue;
        search.boardEverMatched = true;
        const rest = shuffled.slice(boardSize);
        searchHands(deal, search, { board, rest, targetClass: pickTargetClass(deal, rng) }, rng);
    }
    return search;
}

function failureReason(search: Search): Extract<GenerateResult, { ok: false }>['reason'] {
    if (search.lineEverFitted) return 'rule-abstains';
    if (search.handEverFound) return 'line-not-found';
    return search.boardEverMatched ? 'hand-not-found' : 'board-not-found';
}

/** Deals a board and a hand for the sampled coordinates, or says which search ran out. */
export function dealScenario(rule: Rule, coordinates: Coordinates, options: GenerateOptions, rng: Rng): GenerateResult {
    const rangeCombos = rangeCombosFor(options);
    // A range with nothing in it can never place a hand, however many boards
    // are shuffled. Say so now rather than burning the attempt budget.
    if (rangeCombos !== undefined && rangeCombos.length === 0) return { ok: false, reason: 'hand-not-found', attempts: 0 };
    const search = searchBoards(prepareDeal(rule, coordinates, options, rangeCombos), rng);
    if (search.found === null) return { ok: false, reason: failureReason(search), attempts: search.attempts };
    return { ok: true, scenario: search.found };
}
