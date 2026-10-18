/**
 * Stage 3 checks on a rule's action line (`node_path`): steps nothing records,
 * and lines that contradict the rest of the situation.
 */
import {
    STREETS, situationStreets, type OntologyPayload, type PostflopFacingState, type Principle, type Situation,
    type Street,
} from '../ontology/types.ts';
import { parseStep, stripActor } from '../nodePath.ts';
import { heroCheckedOn, pathImpliedVillainSide } from '../generator/seating.ts';
import { CODES, type Finding } from './report.ts';

/**
 * `node_path` steps no quiz hand in this source ever records.
 *
 * `node_path` is real scope — since matching reads it, a rule keyed on
 * `[flop_bet, flop_call]` fires only where those actions happened. But it is an
 * array of free strings, with no closed vocabulary, so `flop_called` instead of
 * `flop_call` does not error: the rule simply stops matching, silently and
 * forever. That is the worst failure mode a scope field can have.
 *
 * Closing the vocabulary outright would be better and is not possible without
 * knowing every source's action naming in advance. This is the next best thing:
 * cross-check the rules' steps against the steps the source's OWN quiz hands
 * use, and report the ones that appear nowhere.
 *
 * A WARNING, not an error, and only where the source has quiz hands to check
 * against. A rule may legitimately name a line no worked example happens to
 * contain, and the generator replays `node_path` verbatim regardless of what
 * any quiz hand says — so this is a spell-check, not a proof.
 */
export function unknownPathSteps(payload: OntologyPayload): Finding[] {
    // Compared with any actor prefix removed (1.7): `hero_flop_bet` is the
    // same action as a quiz hand's `flop_bet`, and flagging it as unknown
    // would warn on every rule that says who acted.
    const known = new Set((payload.quiz_hands ?? [])
        .flatMap((quiz) => (quiz.situation_instance.action_log ?? []).map(stripActor)));
    if (known.size === 0) return [];

    return payload.principles.flatMap((principle, index) => {
        const rule = principle.override_rule ?? principle.rule;
        return (rule.situation.node_path ?? []).flatMap((step, position): Finding[] => (known.has(stripActor(step)) ? [] : [{
            stage: 3,
            severity: 'warning',
            code: CODES.UNKNOWN_PATH_STEP,
            path: `/principles/${index}/rule/situation/node_path/${position}`,
            objectId: principle.id,
            message: `"${step}" appears in no quiz hand's action log. If it is a typo the rule `
                + 'will silently never match; if it is a line no worked example covers, ignore this.',
        }]));
    });
}

type Side = 'before_hero' | 'after_hero';

/** Which side of the hero a facing state seats the opponent on, where it says. */
function impliedSide(state: PostflopFacingState, nodePath: readonly string[], street: Street): Side | undefined {
    if (state === 'first_to_act') return 'after_hero';
    if (state === 'facing_check' || state === 'facing_donk') return 'before_hero';
    if (state === 'facing_bet') return heroCheckedOn(nodePath, street) ? 'after_hero' : 'before_hero';
    return undefined;
}

const SIDE_WORDS: Readonly<Record<Side | 'conflict', string>> = {
    before_hero: 'in front',
    after_hero: 'behind',
    conflict: 'on both sides at once',
};

interface LineAt {
    readonly principle: Principle;
    readonly situation: Situation;
    readonly nodePath: readonly string[];
    readonly streets: readonly Street[];
    readonly at: string;
}

/** Facing states that seat the opponent on the other side from the line. */
function facingContradictions({ principle, situation, nodePath, streets, at }: LineAt): Finding[] {
    const side = pathImpliedVillainSide(nodePath);
    // A line that fixes no side cannot be contradicted.
    if (side === undefined) return [];
    return streets.flatMap((street) => (situation.postflop_facing_state ?? []).flatMap((state): Finding[] => {
        const implied = impliedSide(state, nodePath, street);
        if (side !== 'conflict' && (implied === undefined || implied === side)) return [];
        return [{
            stage: 3,
            severity: 'error',
            code: CODES.FACING_CONTRADICTS_PATH,
            path: `${at}/postflop_facing_state`,
            objectId: principle.id,
            message: `"${state}" on the ${street} puts the opponent `
                + `${implied === 'before_hero' ? 'in front of the hero' : 'behind the hero'}, but this rule's node_path puts them `
                + `${SIDE_WORDS[side]} — no two seats can play this line.`,
        }];
    }));
}

/** A count bigger than heads-up on a street after chips went in between the two named players. */
function settledLineContradiction({ principle, situation, nodePath, streets, at }: LineAt): Finding[] {
    const parsed = nodePath.map(parseStep);
    const settledBefore = (street: Street): boolean => parsed.some((step) =>
        step.street !== undefined && step.street !== 'preflop'
        && STREETS.indexOf(step.street) < STREETS.indexOf(street)
        && step.action !== 'check' && step.action !== 'fold');
    const counts = situation.player_count;
    const claimsBigger = counts === undefined || counts.some((count) => count !== 'heads_up');
    const street = claimsBigger ? streets.find(settledBefore) : undefined;
    if (street === undefined) return [];
    return [{
        stage: 3,
        severity: 'error',
        code: CODES.MULTIWAY_WITH_SETTLED_LINE,
        path: `${at}/player_count`,
        objectId: principle.id,
        message: `Chips went in on an earlier street of this line between the two named players, so the ${street} is heads-up — `
            + `${counts === undefined ? 'omitting player_count claims every field size' : 'a bigger player_count'}`
            + ' tells a hand whose other players vanish mid-story. Write player_count: ["heads_up"].',
    }];
}

/**
 * A situation that contradicts its own action line.
 *
 * Two seats play a postflop line, and the line fixes which side of the hero
 * the opponent sits on: a check answered by the other player on the same
 * street says the checker acted first — out of position. A pending facing
 * state makes the same kind of claim about the current street. When the two
 * disagree — "the opponent checks to you" on the turn of a line whose flop
 * says the opponent acts AFTER you — no two seats at any table can play the
 * spot. The generator refuses to deal such a state, which means the claimed
 * value silently never generates while still counting toward the rule's
 * arbitration weight; this says it out loud instead. A reader once met a
 * spot described as out of position while sitting in position, because the
 * rule claimed `facing_check` alongside a line that had already seated the
 * opponent behind them.
 *
 * The same line also fixes how MANY are playing: chips that went in on an
 * earlier street of the line went in between the two named players (the pot
 * model grows by the heads-up factor), so a `player_count` that claims — or,
 * by omission, includes — a bigger field tells a hand whose other players
 * vanish mid-story.
 */
export function contradictoryLines(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index) => {
        const situation = (principle.override_rule ?? principle.rule).situation;
        const nodePath = situation.node_path ?? [];
        if (nodePath.length === 0) return [];
        const line: LineAt = {
            principle,
            situation,
            nodePath,
            streets: (situationStreets(situation) ?? []).filter((street) => street !== 'preflop'),
            at: `/principles/${index}/rule/situation`,
        };
        return [...facingContradictions(line), ...settledLineContradiction(line)];
    });
}
