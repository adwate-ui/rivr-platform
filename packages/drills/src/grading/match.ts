/**
 * Does a concrete scenario fall inside a situation?
 *
 * The mirror of the generator: the generator samples a scenario out of a
 * situation, this asks whether a scenario is in one. They have to agree
 * exactly, which is what the generator's property test asserts — every scenario
 * it produces must satisfy the situation it came from.
 *
 * Absent constraint means unconstrained, in both directions.
 */

import { situationStreets, type Situation } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { stepsMatch } from '../nodePath.ts';

const allows = (constraint: readonly unknown[] | undefined, value: unknown): boolean => {
    if (constraint === undefined || constraint.length === 0) return true;
    if (value === undefined) return false;
    return constraint.includes(value);
};

/** Any overlap between what is demanded and what the hand actually has. */
const allowsAny = <T>(constraint: readonly T[] | undefined, values: readonly T[] | undefined): boolean => {
    if (constraint === undefined || constraint.length === 0) return true;
    if (values === undefined) return false;
    return values.some((value) => constraint.includes(value));
};

/** Situation slots that hold one value per spot, with the scenario field that holds it. */
const SCALAR_SLOTS = [
    ['hero_position', 'heroPosition'],
    ['villain_position', 'villainPosition'],
    ['pot_type', 'potType'],
    ['player_count', 'playerCount'],
    ['stack_bracket', 'stackBracket'],
    ['spr_bracket', 'sprBracket'],
    ['stakes', 'stakes'],
    ['preflop_facing_state', 'preflopFacingState'],
    ['postflop_facing_state', 'postflopFacingState'],
    ['villain_raise_size', 'villainRaiseSize'],
    ['villain_types', 'villainType'],
] as const;

/**
 * Did the actions the rule requires actually happen, in that order?
 *
 * `node_path` IS scope: a rule about barrelling the turn is scoped to having
 * bet the flop and been called, and without this it would claim every turn
 * spot, including ones where the hero had not bet at all.
 *
 * Matched as a SUBSEQUENCE rather than a prefix or an exact list. The rule names
 * the actions that must have occurred, not the complete history: a rule keyed on
 * `[flop_bet, flop_call]` should still fire on a hand whose log also records the
 * preflop raise. Requiring equality would make every rule unreachable on any
 * hand recorded in more detail than the rule was written with.
 *
 * The vocabulary is open — `node_path` is an array of free strings — so a typo
 * silently stops a rule matching rather than erroring. Stage 3 reports tokens no
 * quiz hand uses, which is the closest thing to a spell-check available without
 * closing the vocabulary outright.
 *
 * Since 1.7 a step may say who acted (`hero_flop_bet`); `stepsMatch` lets an
 * unprefixed side match either actor, so a 1.6 encoding and every quiz hand's
 * unprefixed action log still match exactly as before.
 */
const followsPath = (required: readonly string[] | undefined, actual: readonly string[]): boolean => {
    if (required === undefined || required.length === 0) return true;
    let next = 0;
    for (const step of actual) {
        const wanted = required[next];
        if (wanted !== undefined && stepsMatch(wanted, step)) next += 1;
        if (next === required.length) return true;
    }
    return false;
};

const scalarsMatch = (scenario: Scenario, situation: Situation): boolean =>
    SCALAR_SLOTS.every(([slot, field]) => allows(situation[slot], scenario[field]));

const boardMatches = (scenario: Scenario, situation: Situation): boolean =>
    (situation.board_require ?? []).every((tag) => scenario.boardTags.includes(tag))
    && !(situation.board_exclude ?? []).some((tag) => scenario.boardTags.includes(tag));

const handMatches = (scenario: Scenario, situation: Situation): boolean =>
    allows(situation.hand_class_any, scenario.handClass)
    && allowsAny(situation.draw_class_any, scenario.draws)
    && !(situation.draw_class_exclude ?? []).some((draw) => scenario.draws?.includes(draw) === true)
    && allows(situation.relative_strength_any, scenario.relativeStrength);

/**
 * Read, not decoration: a rule that says "brick turns only" must refuse the turn
 * that completes a straight. An exclusion is "the board never did this", so on
 * the river it reads the turn card too; `runout_any` stays the card that just
 * landed, because "the river bricked" is about the river.
 */
const runoutMatches = (scenario: Scenario, situation: Situation): boolean =>
    allowsAny(situation.runout_any, scenario.runouts)
    && !(situation.runout_exclude ?? []).some((tag) =>
        scenario.runouts?.includes(tag) === true || scenario.priorRunouts?.includes(tag) === true);

/** Whether a concrete scenario falls inside a situation. */
export function matchesSituation(scenario: Scenario, situation: Situation): boolean {
    const streets = situationStreets(situation);
    if (streets !== undefined && !streets.includes(scenario.street)) return false;
    return scalarsMatch(scenario, situation)
        && boardMatches(scenario, situation)
        && handMatches(scenario, situation)
        && runoutMatches(scenario, situation)
        && followsPath(situation.node_path, scenario.nodePath);
}
