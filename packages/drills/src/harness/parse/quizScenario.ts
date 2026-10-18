/**
 * Reading a quiz hand into the shape the matcher understands.
 *
 * A parsing boundary. A scenario the generator builds always states every
 * coordinate, because it samples freely on whatever the rule omits. A quiz hand
 * is the other direction: its source wrote down what it wrote down, and an
 * unstated coordinate must stay unstated so the matcher refuses it rather than
 * guessing. So the few coordinates a `Scenario` requires and a hand may leave
 * out are asserted here, once, instead of being filled with a plausible value.
 */
import { parseCard, type Card } from '../../cards/cards.ts';
import type {
    OntologyPayload, PlayerCount, Position, QuizHand, SituationInstance, Source, StackBracket, Street,
} from '../../ontology/types.ts';
import { answerKindOfAnswer } from '../../ontology/types.ts';
import type { Scenario } from '../../generator/types.ts';
import { boardTags } from '../../boardTexture.ts';
import { classifyRunout } from '../../runout.ts';
import { classifyMadeHand } from '../../handClass.ts';
import { classifyRelativeStrength } from '../../relativeStrength.ts';

/**
 * The stack bracket a stated big-blind count falls into, per THIS source. A
 * source written for 100bb and one written for 300bb mean different things by
 * "deep", which is why `source.stack_brackets` exists.
 */
export function bracketForStack(bb: number | undefined, source: Source): StackBracket | undefined {
    if (bb === undefined) return undefined;
    const brackets = source.stack_brackets;
    if (brackets === undefined) return undefined;
    if (brackets.short_max !== undefined && bb <= brackets.short_max) return 'short';
    if (brackets.standard_max !== undefined && bb <= brackets.standard_max) return 'standard';
    if (brackets.deep_max !== undefined && bb <= brackets.deep_max) return 'deep';
    return 'very_deep';
}

/** `villain_notes` carrying an opponent-type id, where the encoder used one. */
export function villainTypeFromNotes(notes: string | undefined, source: OntologyPayload): string | undefined {
    if (notes === undefined) return undefined;
    return source.opponent_types.find((type) => type.id === notes.trim())?.id;
}

const parseCards = (cards: readonly string[] | undefined): Card[] =>
    (cards ?? []).map(parseCard).filter((card): card is Card => card !== null);

/** The street a board of this many cards belongs to; a board of any other size belongs to none. */
const STREET_FOR_BOARD: Readonly<Record<number, Street>> = { 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' };

/**
 * What the hero's cards make on this board. On a heroless hand what the hero
 * holds is unknown rather than nothing, so every hand coordinate stays unstated
 * and no rule that reads the hand can match it.
 */
function handReading(hole: readonly Card[], board: readonly Card[]): Pick<Scenario, 'handClass' | 'draws' | 'relativeStrength'> {
    if (board.length < 3 || hole.length !== 2) {
        return { handClass: undefined, draws: undefined, relativeStrength: undefined };
    }
    const made = classifyMadeHand(hole, board);
    return { handClass: made.handClass, draws: made.draws, relativeStrength: classifyRelativeStrength(hole, board) };
}

/**
 * What the last card changed, and on the river what the turn changed. Without
 * the hero's cards no runout claims to have paired a card nobody named.
 */
function runoutReading(board: readonly Card[], held: readonly Card[] | undefined): Pick<Scenario, 'runouts' | 'priorRunouts'> {
    const last = board.length >= 4 ? board[board.length - 1] : undefined;
    const turn = board.length === 5 ? board[3] : undefined;
    return {
        runouts: last === undefined ? undefined : classifyRunout(board.slice(0, -1), last, held),
        priorRunouts: turn === undefined ? undefined : classifyRunout(board.slice(0, 3), turn, held),
    };
}

/** The opponent type: an explicit id first, then an id written into the prose notes. */
function villainTypeOf(instance: SituationInstance, source: OntologyPayload | undefined): string | undefined {
    if (instance.villain_type_id !== undefined) return instance.villain_type_id;
    return source === undefined ? undefined : villainTypeFromNotes(instance.villain_notes, source);
}

/**
 * The coordinates the hand states, each left undefined where it does not. The
 * three a generated `Scenario` always has (seat, player count, stack bracket)
 * are asserted: unstated must reach the matcher as unstated, never as a default.
 */
function statedCoordinates(instance: SituationInstance, source: OntologyPayload | undefined) {
    const stackBracket = source === undefined ? undefined : bracketForStack(instance.effective_stack_bb, source.source);
    return {
        heroPosition: instance.hero_position as Position,
        villainPosition: instance.villain_position,
        villainPositions: instance.villain_position === undefined ? [] : [instance.villain_position],
        effectiveStackBb: instance.effective_stack_bb,
        potType: instance.pot_type,
        playerCount: instance.player_count as PlayerCount,
        stackBracket: stackBracket as StackBracket,
        preflopFacingState: instance.preflop_facing_state,
        sprBracket: instance.spr_bracket,
        postflopFacingState: instance.postflop_facing_state,
        stakes: instance.stakes,
        villainRaiseSize: instance.villain_raise_size,
        villainType: villainTypeOf(instance, source),
    };
}

/**
 * Whether the hand can be read at all. Two hole cards are required, except on a
 * count, which asks about the opponent's range and may name no hero hand; and a
 * board must be empty or three to five cards.
 */
function readableStreet(quiz: QuizHand, hole: readonly Card[], board: readonly Card[]): Street | null {
    const heroless = hole.length === 0 && answerKindOfAnswer(quiz.author_answer) === 'count';
    if (hole.length !== 2 && !heroless) return null;
    return STREET_FOR_BOARD[board.length] ?? null;
}

/**
 * Turns a stated spot into the shape the matcher understands, or null where the
 * hand cannot be read (reported as `unusable` rather than silently skipped).
 *
 * Coordinates the hand does not state are left undefined rather than guessed,
 * including `hero_position`: a default would silently match every
 * position-scoped principle to a hand whose position nobody recorded. Deriving
 * them here would be the same error, since the harness would then be reading
 * the encoding it is supposed to be checking.
 */
export function scenarioFromQuizHand(quiz: QuizHand, source?: OntologyPayload): Scenario | null {
    const instance = quiz.situation_instance;
    const hole = parseCards(instance.hero_cards);
    const board = parseCards(instance.board);
    const street = readableStreet(quiz, hole, board);
    if (street === null) return null;
    return {
        street,
        // A transcribed hand is always the source's own; a villain-perspective
        // spot is something only the generator builds.
        holder: 'hero',
        ...statedCoordinates(instance, source),
        board,
        // Empty on a heroless count hand. The one reader of a count spot's hole
        // is `resolveCount`, and the harness refuses a heroless hand before that
        // read whenever the rule removes the hero's cards.
        hole: hole as readonly Card[] as readonly [Card, Card],
        // Texture tags describe the flop; runout tags describe the card that
        // just landed. The generator makes the same split.
        boardTags: board.length >= 3 ? boardTags(board.slice(0, 3)) : [],
        ...handReading(hole, board),
        ...runoutReading(board, hole.length === 2 ? hole : undefined),
        nodePath: instance.action_log ?? [],
        seed: 0,
    };
}
