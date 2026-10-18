/**
 * The six-stage validator.
 *
 * All six must pass for an import to proceed, and import is transactional: the
 * whole payload lands or none of it does. Malformed input is never coerced into
 * something valid — a range that does not parse is reported, not dropped.
 */

import { parsePayload } from '../parse/payload.ts';
import { makeReport, type Finding, type ValidationReport } from './report.ts';
import { stage2Referential } from './stage2.ts';
import { stage3Vocabulary } from './stage3.ts';
import { stage4Satisfiability, type SearchOptions } from './stage4.ts';
import { stage5Determinacy } from './stage5.ts';
import { stage6Coverage } from './stage6.ts';
import { countDistinctSpots } from './satisfiability.ts';

export * from './report.ts';
export { BOARD_ATTEMPT_LIMIT } from './satisfiability.ts';
export { THIN_SCENARIO_THRESHOLD, ERROR_FEEDBACK_KEYS } from './stage6.ts';

/** Options for a validation run: the seed and budget stage 4's search uses. */
export type ValidateOptions = SearchOptions;

/**
 * Runs the pipeline.
 *
 * Stages 1 and 2 short-circuit — nothing downstream can reason about a payload
 * of the wrong shape or one whose ids dangle. Stages 3 to 6 all run even after
 * one has failed, so the author fixes everything in one pass.
 */
export function validateSource(raw: unknown, options: ValidateOptions = {}): ValidationReport {
    const parsed = parsePayload(raw);
    if (parsed.payload === null) return makeReport(1, parsed.findings);

    const payload = parsed.payload;

    const referential = stage2Referential(payload);
    if (referential.some((finding) => finding.severity === 'error')) {
        return makeReport(2, referential);
    }

    const spotCounts = new Map<string, number>(
        payload.principles.map((principle) => [
            principle.id,
            countDistinctSpots((principle.override_rule ?? principle.rule).situation),
        ]),
    );

    const findings: Finding[] = [
        ...referential,
        ...stage3Vocabulary(payload),
        ...stage4Satisfiability(payload, options),
        ...stage5Determinacy(payload),
        ...stage6Coverage({ payload, scenarioCounts: spotCounts }),
    ];

    return makeReport(6, findings);
}
