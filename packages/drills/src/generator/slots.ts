/**
 * The coordinates a scenario has, and which combinations of them can exist.
 *
 * A `situation` constrains some coordinates and omits others; **omission means
 * unconstrained**, and the generator samples freely there. So "is this
 * principle satisfiable?" is, for the categorical coordinates, just: does every
 * slot still have a legal value once the rule's constraints and the rules of
 * hold 'em are both applied?
 *
 * That question is exact and instant, which is why it is answered here
 * symbolically rather than by sampling. Sampling can only ever say "I did not
 * find one"; this says "there is none, and here is the slot that is empty".
 */

import {
    POSITIONS, POT_TYPES, PLAYER_COUNTS, STACK_BRACKETS, SPR_BRACKETS, STAKES, VILLAIN_RAISE_SIZES,
    PREFLOP_FACING_STATES, POSTFLOP_FACING_STATES,
    situationStreets,
    type Situation, type Street,
} from '../ontology/types.ts';

/** Slots that are simple finite choices, each independent of the others. */
export const SCALAR_SLOTS = [
    'hero_position',
    'villain_position',
    'pot_type',
    'player_count',
    'stack_bracket',
    'spr_bracket',
    'stakes',
    'preflop_facing_state',
    'postflop_facing_state',
    'villain_raise_size',
] as const;

export type ScalarSlot = typeof SCALAR_SLOTS[number];

export const SLOT_DOMAINS: Readonly<Record<ScalarSlot, readonly string[]>> = {
    hero_position: POSITIONS,
    villain_position: POSITIONS,
    pot_type: POT_TYPES,
    player_count: PLAYER_COUNTS,
    stack_bracket: STACK_BRACKETS,
    spr_bracket: SPR_BRACKETS,
    stakes: STAKES,
    preflop_facing_state: PREFLOP_FACING_STATES,
    postflop_facing_state: POSTFLOP_FACING_STATES,
    villain_raise_size: VILLAIN_RAISE_SIZES,
};

/**
 * Slots that carry a SET of values at once rather than one — a board has
 * several tags, a hand has several draws — and so intersect differently.
 */
export const SET_SLOTS = ['board_require', 'hand_class_any', 'draw_class_any', 'relative_strength_any', 'runout_any'] as const;

/**
 * Which slots a street even has.
 *
 * The rules of the game, not a policy: there is no board before the flop, so a
 * preflop rule requiring `monotone` is not strict, it is incoherent. A source
 * that writes one has made a mistake the validator should name rather than
 * quietly generating nothing forever.
 */
export const SLOTS_FORBIDDEN_BY_STREET: Readonly<Record<Street, readonly (keyof Situation)[]>> = {
    preflop: [
        'postflop_facing_state', 'board_require', 'board_exclude',
        'hand_class_any', 'draw_class_any', 'draw_class_exclude', 'relative_strength_any',
        'runout_any', 'runout_exclude',
    ],
    // Three cards arrive at once, so no single card "ran out" to bring them.
    flop: ['preflop_facing_state', 'runout_any', 'runout_exclude'],
    turn: ['preflop_facing_state'],
    river: ['preflop_facing_state'],
};

/**
 * Every slot some street forbids — the union, not any one street's list.
 *
 * `preflop_facing_state` is forbidden on the flop, turn and river but not on
 * preflop, so walking a single street's list silently stops checking it.
 */
export const ALL_STREET_RESTRICTED_SLOTS: readonly (keyof Situation)[] = [
    ...new Set(Object.values(SLOTS_FORBIDDEN_BY_STREET).flat()),
];

/** Board tags that need more cards than a street has dealt. */
export const TAGS_REQUIRING_STREET: Readonly<Record<string, Street>> = {
    flush_complete: 'river',
    straight_complete: 'river',
};

/**
 * Draws need a card still to come, so the river has none. A river rule asking
 * for a flush draw describes a hand that cannot be dealt.
 */
export const RIVER_ONLY_DRAW = 'none';

export interface SlotConflict {
    readonly slot: string;
    readonly reason: string;
}

export { situationConjunction } from './conjunction.ts';

/** The values a slot may still take, given the rule's constraints. */
export function allowedValues(situation: Situation, slot: ScalarSlot): readonly string[] {
    const constraint: readonly string[] | undefined = situation[slot];
    const domain = SLOT_DOMAINS[slot];
    if (constraint === undefined) return domain;
    return domain.filter((value) => constraint.includes(value));
}

const EMPTY_LIST = 'constrained to an empty list, which admits nothing';

function scalarConflicts(situation: Situation): SlotConflict[] {
    const conflicts: SlotConflict[] = [];
    for (const slot of SCALAR_SLOTS) {
        const constraint: readonly string[] | undefined = situation[slot];
        if (constraint === undefined) continue;
        if (constraint.length === 0) conflicts.push({ slot, reason: EMPTY_LIST });
        else if (allowedValues(situation, slot).length === 0) {
            conflicts.push({ slot, reason: `none of [${constraint.join(', ')}] is a legal ${slot}` });
        }
    }
    return conflicts;
}

/**
 * A constraint is only impossible when EVERY street the rule names rejects it.
 * A rule spanning turn and river asking for a completed flush is satisfiable
 * (on the river), and flagging it because the turn cannot carry one would
 * reject a good encoding.
 */
function streetSlotConflicts(situation: Situation, streets: readonly Street[]): SlotConflict[] {
    const conflicts: SlotConflict[] = [];
    for (const slot of ALL_STREET_RESTRICTED_SLOTS) {
        const value = situation[slot];
        const stated = value !== undefined && (!Array.isArray(value) || value.length > 0);
        if (!stated) continue;
        const impossibleOn = streets.filter((street) => SLOTS_FORBIDDEN_BY_STREET[street].includes(slot));
        if (impossibleOn.length === streets.length) {
            conflicts.push({ slot, reason: `a ${impossibleOn.join('/')} decision has no ${slot}` });
        }
    }
    return conflicts;
}

function streetTagConflicts(situation: Situation, streets: readonly Street[]): SlotConflict[] {
    const conflicts: SlotConflict[] = [];
    for (const tag of situation.board_require ?? []) {
        const needed = TAGS_REQUIRING_STREET[tag];
        if (needed !== undefined && !streets.includes(needed)) {
            conflicts.push({
                slot: 'board_require',
                reason: `"${tag}" cannot occur on the ${streets.join('/')}; it needs the ${needed}`,
            });
        }
    }
    const draws = (situation.draw_class_any ?? []).filter((draw) => draw !== RIVER_ONLY_DRAW);
    if (draws.length > 0 && streets.every((street) => street === 'river')) {
        conflicts.push({
            slot: 'draw_class_any',
            reason: `no card follows the river, so [${draws.join(', ')}] cannot be drawn to`,
        });
    }
    return conflicts;
}

/**
 * `situationStreets` maps an empty list to "unconstrained", which is the right
 * reading for a source that wrote `street: []` by accident but the WRONG one for
 * a conjunction: a flop rule with a turn branch intersects to no street at all,
 * and that branch is dead code, not an unscoped one.
 */
function streetConflicts(situation: Situation): SlotConflict[] {
    const conflicts: SlotConflict[] = [];
    if (Array.isArray(situation.street) && situation.street.length === 0) {
        conflicts.push({ slot: 'street', reason: 'no street satisfies this, so nothing can reach it' });
    }
    const streets = situationStreets(situation);
    if (streets === undefined) return conflicts;
    return [...conflicts, ...streetSlotConflicts(situation, streets), ...streetTagConflicts(situation, streets)];
}

/**
 * A tag required and excluded at once is the authoring slip this catches most
 * often, invisible in a diff because the two lists sit apart. The runout pair
 * has the same slip: a rule whose every allowed runout is also excluded admits
 * no turn card at all, and the generator would spin its whole board budget
 * discovering that.
 */
function exclusionConflicts(situation: Situation): SlotConflict[] {
    const conflicts: SlotConflict[] = [];
    const excluded = new Set(situation.board_exclude ?? []);
    for (const tag of situation.board_require ?? []) {
        if (excluded.has(tag)) conflicts.push({ slot: 'board_require', reason: `"${tag}" is both required and excluded` });
    }
    const runoutExcluded = new Set(situation.runout_exclude ?? []);
    const runoutAllowed = situation.runout_any ?? [];
    if (runoutAllowed.length > 0 && runoutAllowed.every((tag) => runoutExcluded.has(tag))) {
        conflicts.push({
            slot: 'runout_any',
            reason: `every allowed runout [${runoutAllowed.join(', ')}] is also excluded`,
        });
    }
    return conflicts;
}

function emptySetConflicts(situation: Situation): SlotConflict[] {
    return SET_SLOTS.filter((slot) => {
        const value: readonly string[] | undefined = situation[slot];
        return value !== undefined && value.length === 0;
    }).map((slot) => ({ slot, reason: EMPTY_LIST }));
}

/**
 * Every way this situation contradicts itself or the rules of the game.
 *
 * Returns them all rather than the first, so an author fixing an encoding sees
 * the whole problem in one pass instead of one error per re-import.
 */
export function situationConflicts(situation: Situation): SlotConflict[] {
    return [
        ...scalarConflicts(situation),
        ...streetConflicts(situation),
        ...exclusionConflicts(situation),
        ...emptySetConflicts(situation),
    ];
}
