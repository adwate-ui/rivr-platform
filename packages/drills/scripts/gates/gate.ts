/**
 * What a gate is: a name and a check over one parsed encoding.
 */
import type { ParsedSource } from './sources.ts';
import { say } from './output.ts';
import { stateSuppression } from './state.ts';

export interface GateRun {
    readonly source: ParsedSource;
    /** Where to write reports, or null to print only. */
    readonly reportDir: string | null;
}

export interface Gate {
    readonly name: string;
    /** True when the source passes, or its findings are suppressed by its state. */
    readonly run: (run: GateRun) => boolean;
}

/**
 * The verdict for findings that fail only an active source: printed, then
 * suppressed or failed by the state convention. `alwaysFails` is for findings
 * no state excuses, such as a spot the session could not grade.
 */
export function verdictForFindings(run: GateRun, gateName: string, alwaysFails = false): boolean {
    const suppression = stateSuppression(run.source.payload.source, gateName);
    if (alwaysFails || !suppression.suppress) return false;
    suppression.lines.forEach((line) => say(line));
    return true;
}
