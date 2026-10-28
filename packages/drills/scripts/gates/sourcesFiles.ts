/**
 * The sources gate's reports, written when the run asks for them with
 * `--report <dir>`: the per-hand decomposition as JSON, and the re-encoding
 * work list as markdown, one principle at a time, worst first.
 *
 * Written to files rather than only printed because the work list is worked
 * THROUGH, with the source open beside it, and a build log scrolls away.
 */
import { scopeGaps, type ScopeGap } from '../../src/harness/scopeGap.ts';
import type { ParsedSource } from './sources.ts';
import type { Measures } from './sourcesReport.ts';
import type { ReportWriter } from './gate.ts';
import { pct, say } from './output.ts';

function gapSection(gap: ScopeGap): string[] {
    const refs = [...new Set(gap.hands.map((hand) => hand.pageRef).filter((ref) => ref !== null))];
    return [
        `### ${gap.name} \`${gap.principleId}\``,
        '',
        `${gap.right} right / ${gap.wrong} wrong · claims ${gap.handsClaimed} hands, governs ${gap.handsGoverned} · width ${gap.width}`,
        ...(refs.length > 0 ? [`References: ${refs.join(', ')}`] : []),
        ...(gap.demotedToBranches.length > 0
            ? [`Conditions demoted to branches (they narrow the answer, not the claim): \`${gap.demotedToBranches.join('`, `')}\``] : []),
        gap.hasDefault ? `Default \`${gap.defaultAnswer}\`, used on ${gap.answeredByDefault} governed hand(s).` : 'No default: the rule abstains where its branches do not reach.',
        ...gap.separators.map(({ slot, onPasses, onFailures }) => `- \`${slot}\`: right on ${onPasses.join(', ')}; wrong on ${onFailures.join(', ')}`),
        '',
        '| Hand | Ref | | Source says | Encoding says | Answered by |',
        '| --- | --- | --- | --- | --- | --- |',
        ...gap.hands.map((hand) => `| \`${hand.quizId}\` | ${hand.pageRef ?? '—'} | ${hand.verdict === 'pass' ? 'pass' : 'FAIL'} `
            + `| \`${hand.expected}\` | \`${hand.actual}\` | ${hand.answeredBy} |`),
        '',
    ];
}

function gapReport(source: ParsedSource, measures: Measures): string {
    const { result, totals } = measures;
    const lines = [
        `# Scope gaps: ${source.payload.source.title}`,
        '',
        `Source state: **${source.payload.source.state ?? 'draft'}**. Accuracy on matched hands ${pct(totals.accuracyOnMatched)} `
            + `(${totals.correct}/${totals.matched}); raw pass rate ${pct(result.passRate)}, threshold ${pct(result.threshold)}.`,
        '',
        'For each principle below, ask which conditions the source states before giving its advice, and check them',
        'against the scope the rule already enforces. A condition the source states and the rule does not read is why',
        'the rule claims spots it cannot judge: move it into `situation`, or drop a default the source never states.',
        '',
        ...scopeGaps(result, source.payload).flatMap(gapSection),
    ];
    return `${lines.join('\n')}\n`;
}

/** Writes `<base>.decomposition.json` and `<base>.scope-gaps.md` through the run's report writer. */
export function writeSourceReports(reports: ReportWriter, source: ParsedSource, measures: Measures): void {
    const gapPath = reports.write(`${source.reportBase}.scope-gaps.md`, gapReport(source, measures));
    const body = {
        aggregates: { ...measures.totals, untestedPrincipleIds: measures.untested, unverifiablePrincipleIds: measures.unverifiable },
        provenance: { byProvenance: measures.result.byProvenance, outOfSample: measures.result.outOfSample },
        counts: measures.result.counts,
        baseRates: measures.floors,
        claimVolume: measures.claims,
        rows: measures.rows,
    };
    const jsonPath = reports.write(`${source.reportBase}.decomposition.json`, `${JSON.stringify(body, null, 2)}\n`);
    say(`  wrote ${gapPath} and ${jsonPath}`);
}
