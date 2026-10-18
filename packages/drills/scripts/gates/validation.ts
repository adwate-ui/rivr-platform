/**
 * The six-stage validator over a file, before any gate reads it.
 *
 * A structurally invalid encoding fails whatever its state: it does not parse
 * against its own ontology, and no lifecycle marker excuses that. Every other
 * gate needs a valid payload, so an invalid one stops the run for its source.
 */
import { validateSource, isError } from '../../src/validator/index.ts';
import type { LoadedSource } from './sources.ts';
import { say } from './output.ts';

/** Prints the validator's verdict on a file; true when it has no errors. */
export function validateLoaded(source: LoadedSource): boolean {
    const report = validateSource(source.raw);
    const errors = report.findings.filter(isError);
    if (errors.length > 0) {
        say(`  INVALID: reached stage ${report.reached}, ${errors.length} error(s):`);
        errors.slice(0, 20).forEach((finding) => say(`    [${finding.code}] ${finding.path} :: ${finding.message}`));
        return false;
    }
    const warnings = report.findings.filter((finding) => finding.severity === 'warning');
    say(`  valid (${warnings.length} warning(s)), state: ${source.payload?.source.state ?? 'draft'}`);
    warnings.forEach((finding) => say(`    [${finding.code}] ${finding.path} :: ${finding.message}`));
    return true;
}
