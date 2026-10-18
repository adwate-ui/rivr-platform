/**
 * The cross-rule MECE gate: no two principles may claim the same spot with
 * different answers unless the encoding has decided which governs, and why.
 *
 * The sampled gates cannot see this: a spot generated from a wide rule never
 * carries the narrow coordinates (an opponent type, a raise size) another rule
 * claims, so the overlap hides in the direction the sampler never walks. This
 * gate is static instead: it intersects every pair of drillable situations as
 * regions, asks which actions each rule can reach inside the shared region, and
 * fails on any disagreement not on an allowlist.
 *
 * - **Tied specificity, different answers**: decided by declaration order.
 *   Always a defect.
 * - **Width-decided, different answers**: the refinement mechanism working,
 *   but a real decision about who owns the region, so it must be recorded.
 * - **Runout stance**: a turn or river rule that says nothing about the card
 *   that came claims every card, including the ones its premise excludes. It
 *   must constrain the runout or be recorded as card-free.
 *
 * Pairs are only formed within one source: two sources that disagree about a
 * spot are a comparison, not a defect.
 */
import type { Principle, Situation } from '../../src/ontology/types.ts';
import { specificity } from '../../src/grading/arbitrate.ts';
import { expandRangeSets } from '../../src/range/expand.ts';
import type { ComboSet } from '../../src/range/comboSet.ts';
import { say } from './output.ts';
import { allowlistFor, MECE_RUNOUT_FREE_ALLOWED, MECE_TIED_ALLOWED, MECE_WIDTH_ALLOWED, type Allowlist } from './allowlists.ts';
import { verdictForFindings, type Gate } from './gate.ts';
import {
    allowed, flopSignatureCount, intersect, listOf, regionsIntersect, regionStreets, scalarsFor,
    type Region, type ScalarDomains,
} from './meceRegions.ts';
import { rangeRulesCanBothAnswer, reachableActions } from './meceActions.ts';

interface MeceContext {
    readonly scalars: ScalarDomains;
    readonly ranges: ReadonlyMap<string, ComboSet>;
    readonly width: Allowlist;
    readonly tied: Allowlist;
}

/** The region two situations share, slot by slot. */
function sharedRegion(a: Situation, b: Situation, scalars: ScalarDomains): Region {
    const region: Region = {};
    for (const [slot, domain] of scalars) region[slot] = intersect(allowed(a, slot, domain), allowed(b, slot, domain));
    region.street = intersect(regionStreets(a), regionStreets(b));
    for (const slot of ['board_require', 'board_exclude', 'draw_class_exclude', 'runout_exclude'] as const) {
        const merged = [...listOf(a, slot), ...listOf(b, slot)];
        if (merged.length > 0) region[slot] = [...new Set(merged)];
    }
    return region;
}

const canShareASpot = (a: Principle, b: Principle, context: MeceContext): boolean =>
    regionsIntersect(a.rule.situation, b.rule.situation, context.scalars)
    && !(a.rule.kind === 'range_lookup' && b.rule.kind === 'range_lookup' && !rangeRulesCanBothAnswer(a, b, context.ranges));

/** A failure, a note, or nothing, for one pair of drillable principles. */
function judgePair(a: Principle, b: Principle, context: MeceContext): { failure?: string; note?: string } {
    if (!canShareASpot(a, b, context)) return {};
    const region = sharedRegion(a.rule.situation, b.rule.situation, context.scalars);
    const actionsA = reachableActions(a, region, context.scalars);
    const actionsB = reachableActions(b, region, context.scalars);
    // One side abstains everywhere in the shared region.
    if (actionsA.size === 0 || actionsB.size === 0) return {};
    const specA = specificity(a.rule.situation);
    const specB = specificity(b.rule.situation);
    const described = `${a.id} [${[...actionsA].join('/')}] spec ${specA} vs ${b.id} [${[...actionsB].join('/')}] spec ${specB}`;
    const agree = [...actionsA].some((action) => actionsB.has(action));
    const key = [a.id, b.id].sort().join(' | ');
    if (agree) return specA === specB ? { note: `tied twins, same answer: ${described}; keep them agreeing` } : {};
    if (specA === specB) {
        return context.tied.has(key) ? {} : { failure: `ORDER-DECIDED: ${described}: equal specificity, no shared action` };
    }
    return context.width.has(key) ? {} : {
        failure: `UNRECORDED OVERLAP: ${described}: width decides a real disagreement; record who owns the region, or make the pair disjoint`,
    };
}

const hasRunoutStance = (situation: Situation): boolean =>
    (situation.runout_any ?? []).length > 0 || (situation.runout_exclude ?? []).length > 0;

/** Turn and river rules that say nothing about the card that came, and allowlist rows that went stale. */
function runoutFindings(drillable: readonly Principle[], runoutFree: Allowlist): string[] {
    const unexamined = drillable.filter((principle) => {
        const streets = regionStreets(principle.rule.situation);
        return streets.some((street) => street === 'turn' || street === 'river')
            && !hasRunoutStance(principle.rule.situation) && !runoutFree.has(principle.id);
    }).map((principle) => `RUNOUT UNEXAMINED: ${principle.id} claims ${regionStreets(principle.rule.situation).join('/')} `
        + 'with no runout_any or runout_exclude; constrain it or record why it is card-free');
    const stale = [...runoutFree.keys()].flatMap((id) => {
        const principle = drillable.find((candidate) => candidate.id === id);
        if (principle === undefined) return [`STALE ALLOWLIST: runout-free names "${id}", which is not a drillable principle`];
        return hasRunoutStance(principle.rule.situation) ? [`STALE ALLOWLIST: ${id} now constrains the runout`] : [];
    });
    return [...unexamined, ...stale];
}

function pairFindings(drillable: readonly Principle[], context: MeceContext): { failures: string[]; notes: string[] } {
    const judged = drillable.flatMap((a, index) => drillable.slice(index + 1).map((b) => judgePair(a, b, context)));
    return {
        failures: judged.flatMap((result) => (result.failure === undefined ? [] : [result.failure])),
        notes: judged.flatMap((result) => (result.note === undefined ? [] : [result.note])),
    };
}

export const meceGate: Gate = {
    name: 'mece',
    run(run) {
        const payload = run.source.payload;
        const id = payload.source.id;
        const drillable = payload.principles.filter((principle) => principle.drillable !== false);
        const context: MeceContext = {
            scalars: scalarsFor(payload.opponent_types.map((opponent) => opponent.id)),
            ranges: expandRangeSets(payload.range_sets),
            width: allowlistFor(MECE_WIDTH_ALLOWED, id),
            tied: allowlistFor(MECE_TIED_ALLOWED, id),
        };
        const { failures, notes } = pairFindings(drillable, context);
        failures.push(...runoutFindings(drillable, allowlistFor(MECE_RUNOUT_FREE_ALLOWED, id)));
        say(`mece: ${drillable.length} drillable principles, ${flopSignatureCount()} flop signatures`);
        notes.forEach((note) => say(`  note: ${note}`));
        failures.forEach((failure) => say(`  ${failure}`));
        if (failures.length === 0) return true;
        // A stale allowlist row misstates the file as it stands, so no state excuses it.
        const stale = failures.some((failure) => failure.startsWith('STALE ALLOWLIST'));
        say(`mece: ${failures.length} finding(s)`);
        return verdictForFindings(run, 'mece', stale);
    },
};
