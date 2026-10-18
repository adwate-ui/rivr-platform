/**
 * The state-key convention every gate honours.
 *
 * `source.state === 'active'` means readers are graded by this encoding, so a
 * gate finding is a live defect and fails the build. Any other state means the
 * encoding is being worked on: the gate still prints its full findings (hiding
 * the measurement is how defects stay invisible) but does not fail.
 *
 * The suppression is a loosening, so it expires visibly: every suppressed run
 * prints how long the source has been non-active, and past 30 days it warns
 * that continued suppression is now an undocumented decision. The warning
 * blocks nothing; it exists so the elapsed time cannot go unnoticed.
 */
import type { Source } from '../../src/ontology/types.ts';

export const SUPPRESSION_WARN_DAYS = 30;

const DAY_MS = 86_400_000;

export interface Suppression {
    /** True when the findings are reported but must not fail the build. */
    readonly suppress: boolean;
    readonly lines: readonly string[];
}

/** Whether a gate's findings fail the build for this source, and what to print about it. */
export function stateSuppression(source: Source, gateName: string, now: number = Date.now()): Suppression {
    const state = source.state ?? 'draft';
    if (state === 'active') return { suppress: false, lines: [] };

    const reported = `  ${gateName}: findings above are reported but do NOT fail the build — state is "${state}", not "active"`;
    const changedOn = source.state_changed_on;
    if (changedOn === undefined) {
        return {
            suppress: true,
            lines: [`${reported}.`, '  WARN: no state_changed_on recorded, so how long this has lasted is unknowable. Record the date.'],
        };
    }
    const days = Math.floor((now - Date.parse(`${changedOn}T00:00:00Z`)) / DAY_MS);
    const lines = [`${reported} (${days} day(s) since the state change on ${changedOn}).`];
    if (days > SUPPRESSION_WARN_DAYS) {
        lines.push(`  WARN: non-active for ${days} days, past the ${SUPPRESSION_WARN_DAYS}-day convention. `
            + 'Re-activate the source or record why it stays out.');
    }
    return { suppress: true, lines };
}
