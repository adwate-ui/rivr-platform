/**
 * What a validation run says.
 *
 * Findings carry a STABLE CODE as well as a sentence. The sentence is what the
 * author reads; the code is what a test asserts on, so a reworded message never
 * breaks a test and a test never pins prose in place.
 *
 * Every finding also carries a JSON Pointer into the payload. "Principle
 * pr_flop_cbet has a problem" sends someone scrolling; `/principles/1/rule/
 * branches/2/when/board_require` puts the cursor on it.
 */

export type Severity = 'error' | 'warning' | 'info';
export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6;

export const STAGE_NAMES: Readonly<Record<StageNumber, string>> = {
    1: 'Schema',
    2: 'Referential',
    3: 'Vocabulary',
    4: 'Satisfiability',
    5: 'Determinacy',
    6: 'Coverage',
};

/** Stable finding codes. Grouped by stage; never renumbered, only added to. */
export const CODES = {
    NOT_JSON: 'NOT_JSON',
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    UNKNOWN_RANGE_SET: 'UNKNOWN_RANGE_SET',
    UNKNOWN_OPPONENT_TYPE: 'UNKNOWN_OPPONENT_TYPE',
    UNKNOWN_PREREQUISITE: 'UNKNOWN_PREREQUISITE',
    UNKNOWN_PARENT_RANGE: 'UNKNOWN_PARENT_RANGE',
    DUPLICATE_ID: 'DUPLICATE_ID',
    PREREQUISITE_CYCLE: 'PREREQUISITE_CYCLE',
    RANGE_CYCLE: 'RANGE_CYCLE',
    RANGE_EMPTY: 'RANGE_EMPTY',
    BAD_RANGE_NOTATION: 'BAD_RANGE_NOTATION',
    BAD_CARD: 'BAD_CARD',
    DUPLICATE_CARD: 'DUPLICATE_CARD',
    SOURCE_ID_MISMATCH: 'SOURCE_ID_MISMATCH',
    SLOT_UNSATISFIABLE: 'SLOT_UNSATISFIABLE',
    BOARD_TAGS_IMPOSSIBLE: 'BOARD_TAGS_IMPOSSIBLE',
    NO_SCENARIO_FOUND: 'NO_SCENARIO_FOUND',
    DET_BRANCH_CONFLICT: 'DET_BRANCH_CONFLICT',
    DET_BRANCH_UNREACHABLE: 'DET_BRANCH_UNREACHABLE',
    DET_BRANCH_SAME_AS_DEFAULT: 'DET_BRANCH_SAME_AS_DEFAULT',
    DET_BRANCH_ALWAYS_MATCHES: 'DET_BRANCH_ALWAYS_MATCHES',
    FEEDBACK_NO_ERROR_KEY: 'FEEDBACK_NO_ERROR_KEY',
    FEEDBACK_UNREACHED_ERROR: 'FEEDBACK_UNREACHED_ERROR',
    FEEDBACK_EMPTY: 'FEEDBACK_EMPTY',
    FEEDBACK_SIDE_AMBIGUOUS: 'FEEDBACK_SIDE_AMBIGUOUS',
    FACING_CONTRADICTS_PATH: 'FACING_CONTRADICTS_PATH',
    MULTIWAY_WITH_SETTLED_LINE: 'MULTIWAY_WITH_SETTLED_LINE',
    POT_TYPE_UNSTATED: 'POT_TYPE_UNSTATED',
    HAND_NEVER_EXAMINED: 'HAND_NEVER_EXAMINED',
    BRANCH_READS_UNCLAIMED_SLOT: 'BRANCH_READS_UNCLAIMED_SLOT',
    THIN_ENCODING: 'THIN_ENCODING',
    CONSTANT_RULE: 'CONSTANT_RULE',
    RULE_NEVER_ANSWERS: 'RULE_NEVER_ANSWERS',
    MISSING_AUTHOR_ANSWER: 'MISSING_AUTHOR_ANSWER',
    UNJUSTIFIED_INDETERMINATE: 'UNJUSTIFIED_INDETERMINATE',
    UNKNOWN_PATH_STEP: 'UNKNOWN_PATH_STEP',
    UNKNOWN_LABEL: 'UNKNOWN_LABEL',
    ANSWER_KIND_MISMATCH: 'ANSWER_KIND_MISMATCH',
    COUNT_SUIT_UNSTATED: 'COUNT_SUIT_UNSTATED',
    NO_QUIZ_HANDS: 'NO_QUIZ_HANDS',
} as const;

export type FindingCode = typeof CODES[keyof typeof CODES];

export interface Finding {
    readonly stage: StageNumber;
    readonly severity: Severity;
    readonly code: FindingCode;
    /** JSON Pointer into the payload. */
    readonly path: string;
    /** The principle (or other object) this belongs to, for grouping. */
    readonly objectId?: string | undefined;
    /** One author-facing sentence. */
    readonly message: string;
    /** A concrete counterexample, where there is one. */
    readonly witness?: unknown;
}

export interface ValidationReport {
    readonly ok: boolean;
    /** The highest stage that actually ran. */
    readonly reached: StageNumber;
    readonly findings: readonly Finding[];
}

/** Whether a finding blocks the import. */
export const isError = (finding: Finding): boolean => finding.severity === 'error';

/** A report for a run that reached `reached`; it is ok when no finding is an error. */
export function makeReport(reached: StageNumber, findings: readonly Finding[]): ValidationReport {
    return { ok: !findings.some(isError), reached, findings };
}

/**
 * Findings grouped by the object they belong to, for display.
 *
 * Grouping is the whole readability story: twelve findings spread across three
 * principles is a list somebody skims and gives up on, while three principles
 * with four problems each is a list somebody fixes.
 */
export function groupByObject(findings: readonly Finding[]): { objectId: string; findings: Finding[] }[] {
    const groups = new Map<string, Finding[]>();
    for (const finding of findings) {
        const key = finding.objectId ?? '(payload)';
        const existing = groups.get(key);
        if (existing === undefined) groups.set(key, [finding]);
        else existing.push(finding);
    }
    return [...groups.entries()].map(([objectId, group]) => ({ objectId, findings: group }));
}

/** How many findings of each severity, for a summary line. */
export function countBySeverity(findings: readonly Finding[]): Record<Severity, number> {
    const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
    findings.forEach((finding) => { counts[finding.severity] += 1; });
    return counts;
}
