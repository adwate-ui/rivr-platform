/**
 * Matching a quiz hand to principles strictly, and naming what kept it out.
 */
import type { Principle, Situation } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { matchesSituation } from '../grading/match.ts';
import { rankCandidates } from '../grading/arbitrate.ts';
import { effectiveRule, type ResolveContext } from '../grading/resolve.ts';
import type { NearestMiss } from './results.ts';

/**
 * Does this principle cover the stated spot?
 *
 * **An omitted coordinate means UNKNOWN, never a wildcard.** A hand that does
 * not state its pot type does not match a principle constraining pot type.
 * Treating absence as a match once made the harness pick whichever broad rule
 * came first in declaration order, and fixing an over-claiming rule simply
 * handed its spots to the next one while the rate stayed where it was. A hand
 * that cannot be matched is reported as `no-principle`: an honest gap rather
 * than a fabricated hit.
 */
export function admitsQuizHand(scenario: Scenario, situation: Situation): boolean {
    return matchesSituation(scenario, situation);
}

type SlotReader = readonly [keyof Situation, (scenario: Scenario) => readonly (string | undefined)[]];

/** How to read each constrainable slot off a scenario, for the miss report. */
const SLOT_READERS: readonly SlotReader[] = [
    ['street', (s) => [s.street]],
    ['hero_position', (s) => [s.heroPosition]],
    ['villain_position', (s) => [s.villainPosition]],
    ['pot_type', (s) => [s.potType]],
    ['player_count', (s) => [s.playerCount]],
    ['stack_bracket', (s) => [s.stackBracket]],
    ['spr_bracket', (s) => [s.sprBracket]],
    ['stakes', (s) => [s.stakes]],
    ['preflop_facing_state', (s) => [s.preflopFacingState]],
    ['postflop_facing_state', (s) => [s.postflopFacingState]],
    ['villain_raise_size', (s) => [s.villainRaiseSize]],
    ['villain_types', (s) => [s.villainType]],
    ['hand_class_any', (s) => [s.handClass]],
    ['draw_class_any', (s) => s.draws ?? []],
    ['relative_strength_any', (s) => [s.relativeStrength]],
    ['runout_any', (s) => s.runouts ?? []],
];

/** One slot's miss: `slot=UNSTATED`, `slot=value`, or nothing when it matches or is unconstrained. */
function slotMiss(slot: keyof Situation, constraint: Situation[keyof Situation], read: readonly (string | undefined)[]): string | undefined {
    if (constraint === undefined) return undefined;
    const allowed: readonly unknown[] = Array.isArray(constraint) ? constraint : [constraint];
    if (allowed.length === 0) return undefined;
    const values = read.filter((value): value is string => value !== undefined);
    const [first] = values;
    if (first === undefined) return `${slot}=UNSTATED`;
    return values.some((value) => allowed.includes(value)) ? undefined : `${slot}=${first}`;
}

/** Required and excluded flop tags the board gets wrong. */
function boardMisses(scenario: Scenario, situation: Situation): string[] {
    return [
        ...(situation.board_require ?? []).filter((tag) => !scenario.boardTags.includes(tag))
            .map((tag) => `board_require:${tag}`),
        ...(situation.board_exclude ?? []).filter((tag) => scenario.boardTags.includes(tag))
            .map((tag) => `board_exclude:${tag}`),
    ];
}

/** Excluded runouts the cards carried (the turn's too, on the river) and excluded draws the hand holds. */
function exclusionMisses(scenario: Scenario, situation: Situation): string[] {
    const landed = [...(scenario.runouts ?? []), ...(scenario.priorRunouts ?? [])];
    const draws = scenario.draws ?? [];
    return [
        ...(situation.runout_exclude ?? []).filter((tag) => landed.includes(tag))
            .map((tag) => `runout_exclude:${tag}`),
        ...(situation.draw_class_exclude ?? []).filter((draw) => draws.includes(draw))
            .map((draw) => `draw_class_exclude:${draw}`),
    ];
}

/**
 * Every coordinate on which this spot fails this situation.
 *
 * `slot=UNSTATED` is reported apart from a genuine disagreement because the two
 * take different fixes. A hand that says "turn" against a rule wanting the river
 * disagrees, and one of them is wrong. A hand that never recorded the size of
 * the bet it faced disagrees with nothing; no amount of editing the rules will
 * make it match.
 */
export function missedCoordinates(scenario: Scenario, situation: Situation): string[] {
    const slotMisses = SLOT_READERS
        .map(([slot, read]) => slotMiss(slot, situation[slot], read(scenario)))
        .filter((miss): miss is string => miss !== undefined);
    return [...slotMisses, ...boardMisses(scenario, situation), ...exclusionMisses(scenario, situation)];
}

/** A `page_ref` as an inclusive span. `null` where none is stated. */
export function pageSpan(ref: string | number | undefined): [number, number] | null {
    if (ref === undefined) return null;
    const found = String(ref).match(/\d+/g);
    if (found === null) return null;
    const numbers = found.map(Number);
    return [Math.min(...numbers), Math.max(...numbers)];
}

const overlaps = (a: [number, number] | null, b: [number, number] | null): boolean =>
    a !== null && b !== null && a[0] <= b[1] && b[0] <= a[1];

/** Same-page beats other pages; within a tier, fewer missed coordinates wins; ties keep the earlier. */
const beats = (candidate: NearestMiss, best: NearestMiss | undefined): boolean =>
    best === undefined
    || (candidate.samePage && !best.samePage)
    || (candidate.samePage === best.samePage && candidate.blockedBy.length < best.blockedBy.length);

/**
 * The principle that came closest, and what kept it out.
 *
 * Ranking joins by page first, then by coordinate. A quiz hand cites the pages
 * whose principles it is meant to exercise, so a rule from those pages is the
 * right neighbour even when a rule from elsewhere misses on fewer coordinates.
 * Ranking on coordinates alone blames whichever unrelated rule came closest when
 * a passage was never encoded at all, which reads as "narrow this rule" when the
 * truth is "encode that passage".
 *
 * Principles on another street are skipped: a river rule is not a near miss for
 * a flop spot, and letting it compete buries the real neighbours.
 */
export function nearestMiss(
    scenario: Scenario,
    principles: readonly Principle[],
    pageRef?: string | number,
): NearestMiss | undefined {
    const handPages = pageSpan(pageRef);
    let best: NearestMiss | undefined;
    for (const principle of principles) {
        if (principle.drillable === false) continue;
        const blockedBy = missedCoordinates(scenario, effectiveRule(principle).rule.situation);
        if (blockedBy.includes(`street=${scenario.street}`)) continue;
        const candidate = { principleId: principle.id, blockedBy, samePage: overlaps(handPages, pageSpan(principle.page_ref)) };
        if (beats(candidate, best)) best = candidate;
    }
    return best;
}

/**
 * Every principle whose situation admits this spot, most specific first.
 * Defers to the same arbitration the drill grader uses, which also drops
 * `drillable: false` concept principles: their placeholder rule matches every
 * spot and answers none.
 */
export function admittingPrinciples(
    scenario: Scenario,
    principles: readonly Principle[],
    context?: ResolveContext,
): Principle[] {
    return rankCandidates(scenario, principles, context).map((ranked) => ranked.principle);
}
