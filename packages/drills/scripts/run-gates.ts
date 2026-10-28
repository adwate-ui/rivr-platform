/**
 * The drill gates: every encoding in `fixtures/` and `sources/` (the books that ship with RIVR, decision 0274), through
 * all eight.
 *
 *   pnpm --filter @rivr/drills gates                         every gate, every fixture
 *   pnpm --filter @rivr/drills gates mece lines               two gates
 *   pnpm --filter @rivr/drills gates --dir ~/encodings        a folder outside the repository
 *   pnpm --filter @rivr/drills gates --source src_example     one encoding
 *   pnpm --filter @rivr/drills gates --report /tmp/reports    also write the work-list reports
 *
 * A licensed encoding not shipped with RIVR is uploaded by a super admin at
 * runtime, where the same validator checks it. `--dir` runs these gates over
 * such a file locally without committing it.
 *
 * Exit 0 when every source passes every gate (or its findings are suppressed by
 * its state), 1 when any fails, 2 on a usage error.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GATE_NAMES, parseArgs, UsageError, type GateOptions } from './gates/cli.ts';
import { isParsed, loadSources, sourceIdOf, type LoadedSource } from './gates/sources.ts';
import { staleAllowlistSources } from './gates/allowlists.ts';
import { validateLoaded } from './gates/validation.ts';
import { say } from './gates/output.ts';
import type { ReportWriter } from './gates/gate.ts';
import { GATES } from './gates/all.ts';

/** Writes each report into the `--report` folder. */
function folderWriter(dir: string): ReportWriter {
    return {
        write: (name, text) => {
            mkdirSync(dir, { recursive: true });
            const path = join(dir, name);
            writeFileSync(path, text, 'utf8');
            return path;
        },
    };
}

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
// The books RIVR ships (decision 0274), gated with the fixtures: by default both folders are one run.
const SOURCES = join(import.meta.dirname, '..', 'sources');

/** The encodings in these folders, narrowed by `--source`. */
const loadAll = (dirs: readonly string[], filter: string | null): LoadedSource[] => dirs.flatMap((dir) => loadSources(dir, filter));

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
        return !GATES[name].run({ source, reports: options.reportDir === null ? null : folderWriter(options.reportDir) });
    });
}

/** Exit code for a full run: 0 when nothing failed. */
function runAll(options: GateOptions): number {
    const dirs = options.dir === FIXTURES ? [FIXTURES, SOURCES] : [options.dir];
    const sources = loadAll(dirs, options.filter);
    if (sources.length === 0) {
        say(`gates: no encodings in ${options.dir}, nothing to check.`);
        return 0;
    }
    const known = loadAll(dirs, null).flatMap((source) => (isParsed(source) ? [source.payload.source.id] : []));
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
