/**
 * The generator sweep: can the drill produce fresh, correctly graded spots from
 * every rule, or is the corpus secretly limited to its own quiz hands?
 *
 * Per drillable principle, over many seeds:
 *
 * - **Productivity.** The generator builds spots from the rule's own situation.
 *   A rule that cannot is a drill card that always errors out of the queue.
 * - **Self-governance.** A spot generated from principle P is governed by P, or
 *   by a principle that answers it identically. A different answer at EQUAL
 *   width is decided by declaration order, and fails.
 * - **Tellability.** Every spot's hand history is a table a player can believe
 *   (`story.ts`).
 *
 * A spot nothing governs is an error screen in the session, so it fails at any
 * state. Everything here is a measurement; nothing is tuned to make it pass.
 */
import type { Principle } from '../../src/ontology/types.ts';
import type { Scenario } from '../../src/generator/types.ts';
import { abstainsOn, answerKindOf, resolveGoverningAny } from '../../src/grading/resolve.ts';
import { governingPrinciple, specificity } from '../../src/grading/arbitrate.ts';
import { actionKey, countKey, labelKey } from '../../src/grading/answerKey.ts';
import { matchesSituation } from '../../src/grading/match.ts';
import { ruleOf, samplerFor, spotsFor, type Sampler } from './sampling.ts';
import { storyProblems } from './story.ts';
import { bump, say } from './output.ts';
import { verdictForFindings, type Gate } from './gate.ts';

/** Enough seeds that the sweep has converged: a tie sampled once in 80 seeds was missed at 60. */
const SEEDS = { count: 200, seedOf: (n: number): number => n * 7919 + 17 };

interface SweepRow {
    readonly id: string;
    produced: number;
    governedBySelf: number;
    governedAgreeing: number;
    abstained: number;
    ungoverned: number;
    tiedDisagreements: number;
    untellable: number;
    readonly storyExamples: string[];
    readonly usurpers: Map<string, number>;
}

/** What a principle answers on a spot, in its own kind's terms. */
function answerKey(principle: Principle, scenario: Scenario, sampler: Sampler): string {
    const resolution = resolveGoverningAny(principle, scenario, sampler.context);
    if (resolution.kind === 'classify') return labelKey(resolution.outcome.label);
    if (resolution.kind === 'count') return countKey(resolution.outcome.value);
    return actionKey(resolution.outcome);
}

function recordStory(row: SweepRow, scenario: Scenario): void {
    const problems = storyProblems(scenario);
    if (problems.length === 0) return;
    row.untellable += 1;
    if (row.storyExamples.length < 3) row.storyExamples.push(`seed ${scenario.seed}: ${problems.join('; ')}`);
}

/** Who governs a spot the principle generated, and whether they agree. */
function recordGovernance(sampler: Sampler, principle: Principle, scenario: Scenario, row: SweepRow): void {
    if (abstainsOn(principle, scenario, sampler.context)) {
        row.abstained += 1;
        return;
    }
    const answerKind = answerKindOf(ruleOf(principle));
    const governing = governingPrinciple(scenario, sampler.payload.principles, { ...sampler.context, answerKind });
    if (governing === null) row.ungoverned += 1;
    else if (governing.id === principle.id) row.governedBySelf += 1;
    else recordCompetitor(sampler, { principle, other: governing, scenario, row, byLine: false });
}

interface Competition {
    readonly principle: Principle;
    readonly other: Principle;
    readonly scenario: Scenario;
    readonly row: SweepRow;
    /** True when the spot was re-read as arriving by the other rule's line. */
    readonly byLine: boolean;
}

/** A different answer is a refinement when narrower, and a defect when tied. */
function recordCompetitor(sampler: Sampler, { principle, other, scenario, row, byLine }: Competition): void {
    const own = answerKey(principle, scenario, sampler);
    const theirs = answerKey(other, scenario, sampler);
    if (own === theirs) {
        if (!byLine) row.governedAgreeing += 1;
        return;
    }
    const ownWidth = specificity(ruleOf(principle).situation);
    const theirWidth = specificity(ruleOf(other).situation);
    const tied = theirWidth === ownWidth;
    if (byLine && !tied) return;
    const label = byLine ? 'TIED (by its line) ' : tied ? 'TIED ' : '';
    bump(row.usurpers, `${label}${other.id} (w${theirWidth} vs w${ownWidth}) says ${theirs} vs own ${own}`);
    if (tied) row.tiedDisagreements += 1;
}

/**
 * A spot from a rule with no line can never admit a rule scoped to one, so a
 * tie between them is invisible from this side. Each path-scoped competitor's
 * line is spliced in and asked again.
 */
function sweepCompetitorLines(sampler: Sampler, principle: Principle, spots: readonly Scenario[], row: SweepRow): void {
    if ((ruleOf(principle).situation.node_path ?? []).length > 0) return;
    const ownKind = answerKindOf(ruleOf(principle));
    const competitors = sampler.drillable.filter((other) => other.id !== principle.id
        && (ruleOf(other).situation.node_path ?? []).length > 0 && answerKindOf(ruleOf(other)) === ownKind);
    for (const scenario of spots.filter((spot) => !abstainsOn(principle, spot, sampler.context))) {
        for (const other of competitors) {
            const arrived = { ...scenario, nodePath: [...(ruleOf(other).situation.node_path ?? [])] };
            if (!matchesSituation(arrived, ruleOf(other).situation)) continue;
            if (abstainsOn(other, arrived, sampler.context) || abstainsOn(principle, arrived, sampler.context)) continue;
            recordCompetitor(sampler, { principle, other, scenario: arrived, row, byLine: true });
        }
    }
}

function sweep(sampler: Sampler, principle: Principle): SweepRow {
    const row: SweepRow = {
        id: principle.id, produced: 0, governedBySelf: 0, governedAgreeing: 0, abstained: 0, ungoverned: 0,
        tiedDisagreements: 0, untellable: 0, storyExamples: [], usurpers: new Map(),
    };
    const spots = spotsFor(sampler, principle, SEEDS);
    for (const scenario of spots) {
        row.produced += 1;
        recordStory(row, scenario);
        recordGovernance(sampler, principle, scenario, row);
    }
    sweepCompetitorLines(sampler, principle, spots, row);
    return row;
}

const failsSweep = (row: SweepRow): boolean =>
    row.produced === 0 || row.tiedDisagreements > 0 || row.ungoverned > 0 || row.untellable > 0;

function flagOf(row: SweepRow): string {
    if (row.produced === 0) return '  NO SPOTS';
    if (row.ungoverned > 0) return '  UNGOVERNED (would crash the session)';
    if (row.untellable > 0) return '  UNTELLABLE STORY';
    if (row.tiedDisagreements > 0) return '  ORDER-DECIDED';
    return row.usurpers.size > 0 ? '  refined' : '';
}

function printRow(row: SweepRow, width: number): void {
    const usurped = [...row.usurpers.values()].reduce((sum, count) => sum + count, 0);
    const n = (value: number): string => String(value).padStart(3);
    say(`  ${row.id.padEnd(width)}  produced ${n(row.produced)}  self ${n(row.governedBySelf)}`
        + `  agree ${n(row.governedAgreeing)}  abstain ${n(row.abstained)}  ungoverned ${n(row.ungoverned)}`
        + `  usurped ${n(usurped)}${flagOf(row)}`);
    for (const [key, count] of row.usurpers) say(`      ${count}x ${key}`);
    for (const example of row.storyExamples) say(`      story: ${example}`);
}

export const generatorGate: Gate = {
    name: 'generator',
    run(run) {
        const sampler = samplerFor(run.source.payload);
        const rows = sampler.drillable.map((principle) => sweep(sampler, principle));
        say(`generator sweep — ${rows.length} drillable principles, ${SEEDS.count} seeds each`);
        const width = Math.max(0, ...rows.map((row) => row.id.length));
        rows.forEach((row) => printRow(row, width));
        const failures = rows.filter(failsSweep).length;
        if (failures === 0) {
            say('Every drillable principle produces spots, every story is tellable, and no spot is governed by a disagreeing rule.');
            return true;
        }
        say(`${failures} principle(s) failed the sweep.`);
        const crash = rows.some((row) => row.ungoverned > 0);
        if (crash) say('  An ungoverned spot would crash the session, which fails at any state.');
        return verdictForFindings(run, 'generator', crash);
    },
};
