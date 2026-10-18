/**
 * Stage 4: can this principle ever produce a scenario?
 *
 * This is the stage that catches the authoring mistakes that matter. A rule
 * requiring a board that is both monotone and rainbow, or a hand class its own
 * street cannot hold, passes schema validation cleanly and then generates
 * nothing, forever, silently. Nothing else in the pipeline notices.
 *
 * Two tiers, and the difference between them is what the answer MEANS:
 *
 *   Tier A is symbolic and exact. The categorical slots are independent finite
 *   domains, so an empty one is a proof — reported as an error, naming the slot.
 *
 *   Tier B is bounded search over the card-dependent slots. Search can only
 *   ever fail to find, so its negative result is `not-found` and a WARNING:
 *   "no example in N attempts; this may be unreachable, or merely rare."
 *   Reporting that as an error would be the validator claiming a proof it does
 *   not have.
 */

import { DECK_CARDS, type Card } from '../cards/cards.ts';
import { HAND_CLASSES, situationStreets, type Principle, type Rule, type Situation, type Street } from '../ontology/types.ts';
import { boardTags } from '../boardTexture.ts';
import { classifyMadeHand } from '../handClass.ts';
import { makeRng, type Rng } from '../prng.ts';
import { situationConflicts, situationConjunction, type SlotConflict } from '../generator/slots.ts';
import { jointRealisability } from './tagCompatibility.ts';

export type Satisfiability = 'satisfiable' | 'unsatisfiable' | 'not-found';

/** Boards drawn before giving up. Bounded so a bad rule cannot hang the tab. */
export const BOARD_ATTEMPT_LIMIT = 2_000;


type PostflopStreet = Exclude<Street, 'preflop'>;

const BOARD_SIZE: Readonly<Record<PostflopStreet, number>> = {
    flop: 3, turn: 4, river: 5,
};

export interface SatisfiabilityResult {
    readonly result: Satisfiability;
    /** Present when Tier A proved it impossible. */
    readonly conflicts: readonly SlotConflict[];
    /** A concrete board and hand, when one was found. */
    readonly witness?: { board: string; hole: string };
    readonly attempts: number;
}

/** Streets a situation could be on, given what it constrains. */
function candidateStreets(situation: Situation): PostflopStreet[] {
    const named = situationStreets(situation);
    if (named !== undefined) {
        return named.filter((street): street is PostflopStreet => street !== 'preflop');
    }
    return ['flop', 'turn', 'river'];
}

function matchesBoard(board: readonly Card[], situation: Situation): boolean {
    // Texture tags describe the FLOP, as the generator and the harness tag it.
    const tags = new Set(boardTags(board.slice(0, 3)));
    for (const tag of situation.board_require ?? []) if (!tags.has(tag)) return false;
    for (const tag of situation.board_exclude ?? []) if (tags.has(tag)) return false;
    return true;
}

/** Whether the situation says anything about the hero's own cards. */
function constrainsHand(situation: Situation): boolean {
    return (situation.hand_class_any ?? []).length > 0
        || (situation.draw_class_any ?? []).length > 0
        || (situation.draw_class_exclude ?? []).length > 0;
}

function matchesHand(hole: readonly Card[], board: readonly Card[], situation: Situation): boolean {
    if (!constrainsHand(situation)) return true;
    const wantedClasses = situation.hand_class_any ?? [];
    const wantedDraws = situation.draw_class_any ?? [];
    const unwantedDraws = situation.draw_class_exclude ?? [];

    const made = classifyMadeHand(hole, board);
    if (made.draws.some((draw) => unwantedDraws.includes(draw))) return false;
    if (wantedClasses.length > 0 && !wantedClasses.includes(made.handClass)) return false;
    return wantedDraws.length === 0 || made.draws.some((draw) => wantedDraws.includes(draw));
}

interface SearchInput {
    readonly situation: Situation;
    readonly streets: readonly PostflopStreet[];
    readonly rng: Rng;
    readonly limit: number;
}

/** Draws a board and a hand, rejecting until both match or the budget runs out. */
function searchForScenario(
    { situation, streets, rng, limit }: SearchInput,
): { found?: { board: Card[]; hole: Card[] }; attempts: number } {
    let attempts = 0;
    while (attempts < limit) {
        attempts += 1;
        const street = streets[attempts % streets.length];
        if (street === undefined) break;
        const drawn = rng.shuffle(DECK_CARDS).slice(0, BOARD_SIZE[street] + 2);
        const board = drawn.slice(0, BOARD_SIZE[street]);
        const hole = drawn.slice(BOARD_SIZE[street]);

        if (matchesBoard(board, situation) && matchesHand(hole, board, situation)) {
            return { found: { board, hole }, attempts };
        }
    }
    return { attempts };
}

const show = (cards: readonly Card[]): string => cards.map((card) => `${card.rank}${card.suit}`).join(' ');

/** Tier A: the symbolic proofs, or null when nothing is provably impossible. */
function provenImpossible(situation: Situation): SatisfiabilityResult | null {
    const conflicts = situationConflicts(situation);
    if (conflicts.length > 0) {
        return { result: 'unsatisfiable', conflicts, attempts: 0 };
    }

    // Texture is the flop's whatever the street, so one answer serves every
    // street the rule allows.
    const required = situation.board_require ?? [];
    if (required.length > 0 && jointRealisability(required) === 'impossible') {
        return {
            result: 'unsatisfiable',
            conflicts: [{
                slot: 'board_require',
                reason: `no board can carry [${required.join(', ')}] at once`,
            }],
            attempts: 0,
        };
    }
    return null;
}

/** Whether Tier B has anything to search for: a card-dependent slot on a postflop street. */
function needsCards(situation: Situation, streets: readonly PostflopStreet[]): boolean {
    return streets.length > 0 && (
        (situation.board_require ?? []).length > 0
        || (situation.board_exclude ?? []).length > 0
        || constrainsHand(situation)
    );
}

/**
 * Whether a situation admits at least one scenario.
 *
 * Preflop situations never reach Tier B: they have no board and no hand class
 * to satisfy, so Tier A is the whole answer.
 */
export function checkSituation(
    situation: Situation,
    options: { seed?: number | undefined; limit?: number | undefined } = {},
): SatisfiabilityResult {
    const impossible = provenImpossible(situation);
    if (impossible !== null) return impossible;

    const streets = candidateStreets(situation);
    if (!needsCards(situation, streets)) return { result: 'satisfiable', conflicts: [], attempts: 0 };

    const { found, attempts } = searchForScenario({
        situation, streets, rng: makeRng(options.seed ?? 1), limit: options.limit ?? BOARD_ATTEMPT_LIMIT,
    });

    if (found === undefined) return { result: 'not-found', conflicts: [], attempts };
    return {
        result: 'satisfiable',
        conflicts: [],
        attempts,
        witness: { board: show(found.board), hole: show(found.hole) },
    };
}

/** Every situation a rule contains: its own, plus each branch's. */
export function ruleSituations(rule: Rule): { situation: Situation; path: string }[] {
    const out = [{ situation: rule.situation, path: 'situation' }];
    if (rule.kind === 'predicate') {
        rule.branches.forEach((branch, index) => {
            // A branch narrows the rule's situation rather than replacing it.
            out.push({
                situation: situationConjunction(rule.situation, branch.when),
                path: `branches/${index}/when`,
            });
        });
    }
    return out;
}

/**
 * Every situation a PRINCIPLE contains — the rule's, its branches', and its
 * exceptions'.
 *
 * Exceptions were the blind spot. Walking only the rule meant an exception
 * could name a coordinate the street does not have, and nothing said so: a
 * preflop principle whose exception keys on a made-hand class, or on a board
 * tag, generated silently and simply never fired. The rule looked fine because
 * the incoherence was one level down.
 *
 * Each condition is conjoined with the rule's own situation, because that is
 * the only state in which either can be reached — see `situationConjunction`.
 */
export function principleSituations(principle: Principle): { situation: Situation; path: string }[] {
    const rule = principle.override_rule ?? principle.rule;
    const base = principle.override_rule === undefined ? 'rule' : 'override_rule';

    const out = ruleSituations(rule).map(({ situation, path }) => ({
        situation,
        path: `${base}/${path}`,
    }));

    (principle.exceptions ?? []).forEach((exception, index) => {
        out.push({
            situation: situationConjunction(rule.situation, exception.when),
            path: `exceptions/${index}/when`,
        });
    });

    return out;
}

/** Domain sizes for the slots the spot count multiplies over. */
const SLOT_SIZE: Readonly<Record<'hero_position' | 'pot_type' | 'player_count' | 'stack_bracket', number>> = {
    hero_position: 9,
    pot_type: 4,
    player_count: 3,
    stack_bracket: 4,
};

/**
 * How many hand classes a situation can reach.
 *
 * An UNCONSTRAINED hand class means every class is reachable, not one. Scoring
 * the absent case as 1 made constraining the hand look free — a rule pinned to
 * `set` counted the same as one claiming every holding, which is backwards for
 * a thinness warning.
 *
 * Preflop is the exception, and not a special case so much as the rules of the
 * game: there is no board, so there is no made hand to classify, and
 * `SLOTS_FORBIDDEN_BY_STREET` forbids the slot outright. A preflop rule's
 * variety comes from its RANGE, which this estimate does not model.
 */
function reachableHandClasses(situation: Situation, streetList: readonly Street[] | undefined): number {
    const postflopReachable = streetList === undefined || streetList.some((street) => street !== 'preflop');
    if (!postflopReachable) return 1;
    if (situation.hand_class_any === undefined) return HAND_CLASSES.length;
    return Math.max(situation.hand_class_any.length, 1);
}

/**
 * A rough count of how many genuinely different scenarios a situation admits.
 *
 * Feeds stage 6's thinness warning. It is the product of the free slot sizes
 * rather than a true enumeration — cards make the real number astronomically
 * larger — so it answers "how many distinct SPOTS", which is what makes a drill
 * feel repetitive, not "how many distinct deals".
 */
export function countDistinctSpots(situation: Situation): number {
    const scalar = ([
        'hero_position', 'pot_type', 'player_count', 'stack_bracket',
    ] as const).reduce((total, slot) => {
        const constraint: readonly string[] | undefined = situation[slot];
        const size = constraint === undefined ? SLOT_SIZE[slot] : constraint.length;
        return total * Math.max(size, 1);
    }, 1);

    const streetList = situationStreets(situation);
    const streets = streetList?.length ?? 4;

    return scalar * streets * reachableHandClasses(situation, streetList);
}
