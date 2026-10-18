/**
 * The drill gates: every encoding in `fixtures/`, through all eight.
 *
 *   pnpm --filter @rivr/drills gates                         every gate, every fixture
 *   pnpm --filter @rivr/drills gates mece lines               two gates
 *   pnpm --filter @rivr/drills gates --dir ~/encodings        a folder outside the repository
 *   pnpm --filter @rivr/drills gates --source src_example     one encoding
 *   pnpm --filter @rivr/drills gates --report /tmp/reports    also write the work-list reports
 *
 * Licensed encodings never enter the repository; a super admin uploads them at
 * runtime, where the same validator checks them. `--dir` runs these gates over
 * such a file locally without committing it.
 *
 * Exit 0 when every source passes every gate (or its findings are suppressed by
 * its state), 1 when any fails, 2 on a usage error.
 */
import { join } from 'node:path';
import { GATE_NAMES, parseArgs, UsageError, type GateName, type GateOptions } from './gates/cli.ts';
import { isParsed, loadSources, sourceIdOf, type LoadedSource } from './gates/sources.ts';
import { staleAllowlistSources } from './gates/allowlists.ts';
import { validateLoaded } from './gates/validation.ts';
import { say } from './gates/output.ts';
import type { Gate } from './gates/gate.ts';
import { sourcesGate } from './gates/sourcesGate.ts';
import { generatorGate } from './gates/generatorGate.ts';
import { winnableGate } from './gates/winnableGate.ts';
import { overclaimGate } from './gates/overclaimGate.ts';
import { feedbackGate } from './gates/feedbackGate.ts';
import { varietyGate } from './gates/varietyGate.ts';
import { linesGate } from './gates/linesGate.ts';
import { meceGate } from './gates/meceGate.ts';

const GATES: Readonly<Record<GateName, Gate>> = {
    sources: sourcesGate, generator: generatorGate, winnable: winnableGate, overclaim: overclaimGate,
    feedback: feedbackGate, variety: varietyGate, lines: linesGate, mece: meceGate,
};

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

/** Every selected gate over one source; the names of the gates it failed. */
function gateSource(source: LoadedSource, options: GateOptions): string[] {
    say(`\n=== ${source.file} (${sourceIdOf(source)}) ===`);
    const valid = validateLoaded(source);
    if (!valid || !isParsed(source)) {
        say('  not gated further: the encoding is invalid.');
        return [...options.gates];
    }
    return options.gates.filter((name) => {
        say(`\n--- ${name} ---`);
        return !GATES[name].run({ source, reportDir: options.reportDir });
    });
}

/** Exit code for a full run: 0 when nothing failed. */
function runAll(options: GateOptions): number {
    const sources = loadSources(options.dir, options.filter);
    if (sources.length === 0) {
        say(`gates: no encodings in ${options.dir}, nothing to check.`);
        return 0;
    }
    const known = loadSources(options.dir, null).flatMap((source) => (isParsed(source) ? [source.payload.source.id] : []));
    const stale = staleAllowlistSources(known);
    if (stale.length > 0) {
        say(`STALE ALLOWLIST: no encoding has id ${stale.map((id) => `"${id}"`).join(', ')}.`);
        return 1;
    }
    const failures = sources.flatMap((source) => gateSource(source, options).map((gate) => `${source.file}: ${gate}`));
    say(`\ngates: ${sources.length} encoding(s) × ${options.gates.length} gate(s), ${failures.length} failed`);
    failures.forEach((failure) => say(`  FAILED ${failure}`));
    return failures.length === 0 ? 0 : 1;
}

function main(argv: readonly string[]): number {
    try {
        return runAll(parseArgs(argv, FIXTURES));
    } catch (error) {
        if (!(error instanceof UsageError)) throw error;
        say(`gates: ${error.message}`);
        say(`usage: gates [${GATE_NAMES.join('|')} ...] [--dir <folder>] [--source <file|id>] [--report <folder>]`);
        return 2;
    }
}

process.exitCode = main(process.argv.slice(2));
