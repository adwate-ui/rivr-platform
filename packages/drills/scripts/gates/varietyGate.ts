/**
 * How many DIFFERENT questions can each principle ask?
 *
 * The validator's distinct-spot estimate counts combinations the generator may
 * never reach, and models a preflop rule's variety as 1 because its variety
 * lives in a range. So this generates the way the app does and counts what a
 * READER would call a different spot: the coordinates they can see, the hand as
 * a grid label and the board as ranks. Two spots that differ only in a suit are
 * the same question asked twice.
 *
 * The floor of 250 distinct questions in 400 seeds was calibrated against a
 * fitted encoding whose thinnest principle fell below it while the honest
 * encoding's thinnest cleared it with margin. It is the same for every source;
 * do not tune it to make a principle pass. Watch the median across runs too: a
 * collapsing median is a fit in progress even before anything crosses the floor.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Principle } from '../../src/ontology/types.ts';
import type { Scenario } from '../../src/generator/types.ts';
import { abstainsOn } from '../../src/grading/resolve.ts';
import { comboIndex } from '../../src/range/comboSet.ts';
import { cellForCombo } from '../../src/range/grid.ts';
import { samplerFor, spotsFor, type Sampler } from './sampling.ts';
import { say } from './output.ts';
import { verdictForFindings, type Gate } from './gate.ts';

export const VARIETY_FLOOR = 250;
const SEEDS = { count: 400, seedOf: (n: number): number => n * 6151 + 13 };

interface VarietyRow {
    readonly id: string;
    readonly pageRef: string;
    readonly produced: number;
    readonly distinct: number;
}

/** What the reader sees. Suits are not part of the question unless the board's pattern is. */
const questionKey = (s: Scenario): string => [
    s.street, s.heroPosition, [...s.villainPositions].sort().join('+'), s.potType, s.playerCount,
    s.stackBracket, s.stakes, s.preflopFacingState, s.postflopFacingState, s.villainRaiseSize,
    s.villainType, s.sprBracket,
    cellForCombo(comboIndex(s.hole[0], s.hole[1]))?.label,
    s.board.map((card) => card.rank).join(''), [...s.boardTags].sort().join(','),
].join('|');

function measure(sampler: Sampler, principle: Principle): VarietyRow {
    const spots = spotsFor(sampler, principle, SEEDS, (candidate) => !abstainsOn(principle, candidate, sampler.context));
    return {
        id: principle.id,
        pageRef: String(principle.page_ref ?? '—'),
        produced: spots.length,
        distinct: new Set(spots.map(questionKey)).size,
    };
}

/** Min, quartiles and max of the distinct counts, read off rows sorted ascending. */
function distribution(rows: readonly VarietyRow[]): Record<'min' | 'q1' | 'median' | 'q3' | 'max', number> {
    const at = (q: number): number => rows[Math.min(rows.length - 1, Math.round(q * (rows.length - 1)))]?.distinct ?? 0;
    return { min: at(0), q1: at(0.25), median: at(0.5), q3: at(0.75), max: at(1) };
}

function writeReport(reportDir: string, reportBase: string, rows: readonly VarietyRow[]): void {
    mkdirSync(reportDir, { recursive: true });
    const path = join(reportDir, `${reportBase}.variety.json`);
    const body = { floor: VARIETY_FLOOR, seeds: SEEDS.count, distribution: distribution(rows), perPrinciple: rows };
    writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
    say(`wrote ${path}`);
}

export const varietyGate: Gate = {
    name: 'variety',
    run(run) {
        const sampler = samplerFor(run.source.payload);
        const rows = sampler.drillable.map((principle) => measure(sampler, principle)).sort((a, b) => a.distinct - b.distinct);
        const thin = rows.filter((row) => row.distinct < VARIETY_FLOOR);
        const d = distribution(rows);
        say(`spot variety — ${rows.length} drillable principles, ${SEEDS.count} seeds each`);
        say(`  at or above ${VARIETY_FLOOR} distinct questions: ${rows.length - thin.length}; below it: ${thin.length}`);
        say(`  distribution: min ${d.min} / q1 ${d.q1} / median ${d.median} / q3 ${d.q3} / max ${d.max}`);
        thin.forEach((row) => say(`  ${row.id.padEnd(36)} ref ${row.pageRef.padEnd(10)} ${String(row.distinct).padStart(4)} distinct of ${row.produced} generated`));
        if (run.reportDir !== null) writeReport(run.reportDir, run.source.reportBase, rows);
        if (thin.length === 0) {
            say(`Every principle can ask at least ${VARIETY_FLOOR} different questions.`);
            return true;
        }
        say(`${thin.length} principle(s) repeat themselves inside a session.`);
        return verdictForFindings(run, 'variety');
    },
};
