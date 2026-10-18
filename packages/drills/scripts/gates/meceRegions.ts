/**
 * Situations as regions, for the static MECE check.
 *
 * A sound over-approximation of co-matching: a pair reported compatible might
 * still never co-occur at runtime, but a pair reported incompatible never can.
 * Scalar slots intersect as sets, boards are checked against every distinct
 * flop's tag signature, and node paths conflict only on the one impossibility
 * that needs no search: two first wagers on the same street.
 */
import {
    HAND_CLASSES, PLAYER_COUNTS, POSITIONS, POSTFLOP_FACING_STATES, POT_TYPES, PREFLOP_FACING_STATES,
    RELATIVE_STRENGTHS, SPR_BRACKETS, STACK_BRACKETS, STAKES, STREETS, VILLAIN_RAISE_SIZES,
    type Situation, type Street,
} from '../../src/ontology/types.ts';
import { canonicalFlops } from '../../src/boardEnumeration.ts';
import { boardTags } from '../../src/boardTexture.ts';

/** A situation, or the intersection of two, slot by slot. */
export type Region = Partial<Record<keyof Situation, readonly string[] | string | undefined>>;

/** Slots a spot carries exactly one value of, each with its whole domain. */
export type ScalarDomains = readonly (readonly [keyof Situation, readonly string[]])[];

/** The scalar slots. `villain_types` is the one whose domain is the source's own. */
export const scalarsFor = (villainTypes: readonly string[]): ScalarDomains => [
    ['stakes', STAKES], ['hero_position', POSITIONS], ['villain_position', POSITIONS], ['pot_type', POT_TYPES],
    ['player_count', PLAYER_COUNTS], ['stack_bracket', STACK_BRACKETS], ['spr_bracket', SPR_BRACKETS],
    ['preflop_facing_state', PREFLOP_FACING_STATES], ['postflop_facing_state', POSTFLOP_FACING_STATES],
    ['villain_raise_size', VILLAIN_RAISE_SIZES], ['villain_types', villainTypes],
    ['hand_class_any', HAND_CLASSES], ['relative_strength_any', RELATIVE_STRENGTHS],
];

const DRAW_DOMAIN = ['none', 'backdoor_flush', 'backdoor_straight', 'gutshot', 'open_ended', 'flush_draw', 'combo_draw'];
const RUNOUT_DOMAIN = [
    'brick', 'overcard', 'pairs_board', 'pairs_hero', 'flush_completing', 'flush_drawing', 'four_flush',
    'straight_completing', 'straight_completing_low', 'straight_drawing', 'four_straight',
];

/** The list a region holds for a slot, or [] when the slot is unconstrained. */
export function listOf(region: Region, slot: keyof Situation): readonly string[] {
    const value = region[slot];
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
}

/** The members of `a` that `b` also holds, in `a`'s order. */
export const intersect = <T extends string>(a: readonly T[], b: readonly string[]): T[] => a.filter((x) => b.includes(x));

/** What a region allows in a scalar slot: its list, or the whole domain when it says nothing. */
export function allowed(region: Region, slot: keyof Situation, domain: readonly string[]): readonly string[] {
    const list = listOf(region, slot);
    return list.length === 0 ? domain : list;
}

/** The streets a region admits; an absent or empty street constraint admits every street. */
export function regionStreets(region: Region): Street[] {
    const list = listOf(region, 'street');
    return list.length === 0 ? [...STREETS] : intersect(STREETS, list);
}

/** Distinct tag signatures over every distinct flop: the proof set for board claims. */
const FLOP_SIGNATURES: readonly ReadonlySet<string>[] = [
    ...new Map(canonicalFlops().map(({ flop }) => {
        const tags = boardTags(flop);
        return [tags.join(','), new Set<string>(tags)] as const;
    })).values(),
];

/** How many distinct flop signatures the board check proves against. */
export const flopSignatureCount = (): number => FLOP_SIGNATURES.length;

function boardsCompatible(a: Region, b: Region): boolean {
    const required = [...listOf(a, 'board_require'), ...listOf(b, 'board_require')];
    const excluded = [...listOf(a, 'board_exclude'), ...listOf(b, 'board_exclude')];
    return FLOP_SIGNATURES.some((tags) => required.every((tag) => tags.has(tag)) && !excluded.some((tag) => tags.has(tag)));
}

interface AnyOfClaims {
    readonly a: readonly string[];
    readonly b: readonly string[];
    readonly excluded: readonly string[];
}

/**
 * Can one hand's tag set satisfy both any-of claims? `exclusive` (no draw, or a
 * brick) is a tag a set holds alone, so a side pinned to it cannot share.
 */
function anySetsCompatible(claims: AnyOfClaims, exclusive: string, domain: readonly string[]): boolean {
    const live = (list: readonly string[]): string[] =>
        (list.length === 0 ? domain : list).filter((tag) => !claims.excluded.includes(tag));
    const a = live(claims.a);
    const b = live(claims.b);
    if (a.length === 0 || b.length === 0) return false;
    if (intersect(a, b).length > 0) return true;
    const pinned = (list: readonly string[]): boolean => list.length === 1 && list[0] === exclusive;
    return !pinned(a) && !pinned(b);
}

/** Two first wagers on one street cannot share an action log; everything else might. */
function pathsCompatible(a: Region, b: Region): boolean {
    const steps = [...listOf(a, 'node_path'), ...listOf(b, 'node_path')];
    return !STREETS.some((street) => steps.includes(`hero_${street}_bet`) && steps.includes(`villain_${street}_bet`));
}

function drawsCompatible(a: Region, b: Region, streets: readonly Street[]): boolean {
    const excluded = [...listOf(a, 'draw_class_exclude'), ...listOf(b, 'draw_class_exclude')];
    // On a river-only region nothing follows, so the only draw is none.
    const domain = streets.every((street) => street === 'river') ? ['none'] : DRAW_DOMAIN;
    return anySetsCompatible({ a: listOf(a, 'draw_class_any'), b: listOf(b, 'draw_class_any'), excluded }, 'none', domain);
}

function runoutsCompatible(a: Region, b: Region, streets: readonly Street[]): boolean {
    if (!streets.some((street) => street === 'turn' || street === 'river')) return true;
    const excluded = [...listOf(a, 'runout_exclude'), ...listOf(b, 'runout_exclude')];
    return anySetsCompatible({ a: listOf(a, 'runout_any'), b: listOf(b, 'runout_any'), excluded }, 'brick', RUNOUT_DOMAIN);
}

/** Whether two constraint bags (a situation, or a situation plus a branch's `when`) share any spot. */
export function regionsIntersect(a: Region, b: Region, scalars: ScalarDomains): boolean {
    const streets = intersect(regionStreets(a), regionStreets(b));
    if (streets.length === 0) return false;
    const scalarOverlap = scalars.every(([slot, domain]) =>
        intersect(allowed(a, slot, domain), allowed(b, slot, domain)).length > 0);
    return scalarOverlap && boardsCompatible(a, b) && drawsCompatible(a, b, streets)
        && runoutsCompatible(a, b, streets) && pathsCompatible(a, b);
}
