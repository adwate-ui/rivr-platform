/**
 * Can a reader actually get this right?
 *
 * Walks the generated population the way the app walks it and asks two things
 * of every spot: does the drawn rule answer it at all, and is the answer one
 * the pad can offer in that facing state? A rule at 0 is dead; a rule below 1
 * is partly unwinnable. Neither shows in an accuracy figure, because accuracy
 * measures the source's own worked examples, which are held out of the drill
 * pool on purpose.
 *
 * Winnable is measured against the spots a rule ANSWERS: a spot it abstains on
 * is rejected before a reader sees it, so abstention costs variety, not a spot
 * a reader can lose.
 */
import type { Principle } from '../../src/ontology/types.ts';
import type { Scenario } from '../../src/generator/types.ts';
import { resolveClassify, resolveCount, resolveOutcome } from '../../src/grading/resolve.ts';
import { legalActions } from '../../src/grading/classifyError.ts';
import { ruleOf, samplerFor, spotsFor, type Sampler } from './sampling.ts';
import { bump, say } from './output.ts';
import { verdictForFindings, type Gate } from './gate.ts';

const SEEDS = { count: 40, seedOf: (n: number): number => n * 104729 + 11 };

interface WinnableRow {
    readonly id: string;
    readonly built: number;
    answered: number;
    winnable: number;
    readonly unreachable: Map<string, number>;
}

/** Whether a spot is answered, and if so whether the pad can say the answer. */
function score(sampler: Sampler, principle: Principle, scenario: Scenario, row: WinnableRow): void {
    const rule = ruleOf(principle);
    if (rule.kind === 'count') {
        // The pad takes any whole number, so a count that resolves is winnable.
        if (resolveCount(principle, scenario, sampler.context) === null) return;
        row.answered += 1;
        row.winnable += 1;
        return;
    }
    if (rule.kind === 'classify') {
        const resolved = resolveClassify(principle, scenario, sampler.context);
        if (resolved === null) return;
        row.answered += 1;
        const offered = rule.labels.map((label) => label.id);
        if (offered.includes(resolved.outcome.label)) row.winnable += 1;
        else bump(row.unreachable, `wants label "${resolved.outcome.label}", pad offers ${offered.join('/')}`);
        return;
    }
    const resolution = resolveOutcome(principle, scenario, sampler.context);
    if (resolution === null) return;
    row.answered += 1;
    const offered = legalActions(scenario);
    if (offered.includes(resolution.outcome.action)) row.winnable += 1;
    else bump(row.unreachable, `wants "${resolution.outcome.action}", pad offers ${offered.join('/')}`);
}

function measure(sampler: Sampler, principle: Principle): WinnableRow {
    const spots = spotsFor(sampler, principle, SEEDS);
    const row: WinnableRow = { id: principle.id, built: spots.length, answered: 0, winnable: 0, unreachable: new Map() };
    spots.forEach((scenario) => score(sampler, principle, scenario, row));
    return row;
}

const rateOf = (row: WinnableRow): number => (row.answered === 0 ? 0 : row.winnable / row.answered);
const fails = (row: WinnableRow): boolean => row.built === 0 || row.answered === 0 || rateOf(row) < 1;

function flagOf(row: WinnableRow): string {
    if (row.built === 0) return '  NO SPOTS';
    if (row.answered === 0) return '  DEAD — answers nothing';
    return rateOf(row) < 1 ? '  PARTLY UNWINNABLE' : '';
}

function printRow(row: WinnableRow, width: number): void {
    const n = (value: number): string => String(value).padStart(3);
    say(`  ${row.id.padEnd(width)}  built ${n(row.built)}  answered ${n(row.answered)}`
        + `  abstains ${n(row.built - row.answered)}  winnable ${n(row.winnable)}`
        + `  ${(rateOf(row) * 100).toFixed(0).padStart(3)}%${flagOf(row)}`);
    for (const [why, count] of row.unreachable) say(`      ${count}x ${why}`);
}

export const winnableGate: Gate = {
    name: 'winnable',
    run(run) {
        const sampler = samplerFor(run.source.payload);
        const rows = sampler.drillable.map((principle) => measure(sampler, principle));
        say(`winnable rate — ${rows.length} drillable principles, ${SEEDS.count} seeds each`);
        const width = Math.max(0, ...rows.map((row) => row.id.length));
        const failing = rows.filter(fails);
        failing.forEach((row) => printRow(row, width));
        if (failing.length === 0) {
            say('Every drillable principle answers every spot it is given, in words the reader can say.');
            return true;
        }
        say(`${failing.length} principle(s) a reader cannot reliably get right.`);
        return verdictForFindings(run, 'winnable');
    },
};
