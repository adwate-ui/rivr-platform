/**
 * The gates' command line: which gates, over which encodings.
 *
 * `pnpm --filter @rivr/drills gates` runs all eight over every encoding in
 * `fixtures/`. A licensed encoding never enters the repository, so `--dir`
 * points the same gates at a folder outside it; `--source` narrows a run to one
 * file or source id; `--report` writes the work-list reports to a folder.
 */
import { resolve } from 'node:path';

import { GATE_NAMES, type GateName } from './all.ts';

// The gate names live with the gates, so the console's check needs nothing of the command line (#131).
export { GATE_NAMES };
export type { GateName };

export interface GateOptions {
    /** The folder whose `*.json` files are the encodings to gate. */
    readonly dir: string;
    /** A file name, file base name or `source.id` to narrow the run to. */
    readonly filter: string | null;
    /** Where to write the per-source reports, or null to print only. */
    readonly reportDir: string | null;
    readonly gates: readonly GateName[];
}

/** A mistake on the command line: printed with the usage, exit 2. */
export class UsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsageError';
    }
}

const FLAGS = ['--dir', '--source', '--report'] as const;
type Flag = typeof FLAGS[number];

const isGateName = (value: string): value is GateName => GATE_NAMES.some((name) => name === value);

/** Separates `--flag value` and `--flag=value` pairs from the bare arguments. */
function splitArgs(argv: readonly string[]): { flags: Map<Flag, string>; rest: string[] } {
    const flags = new Map<Flag, string>();
    const rest: string[] = [];
    let pending: Flag | null = null;
    for (const arg of argv) {
        if (pending !== null) {
            flags.set(pending, arg);
            pending = null;
            continue;
        }
        const flag = FLAGS.find((name) => arg === name || arg.startsWith(`${name}=`));
        if (flag === undefined) rest.push(arg);
        else if (arg === flag) pending = flag;
        else flags.set(flag, arg.slice(flag.length + 1));
    }
    if (pending !== null) throw new UsageError(`${pending} needs a value`);
    return { flags, rest };
}

/** Reads the gate names and flags; with no names, every gate runs. */
export function parseArgs(argv: readonly string[], defaultDir: string): GateOptions {
    const { flags, rest } = splitArgs(argv);
    const unknown = rest.filter((arg) => !isGateName(arg));
    if (unknown.length > 0) {
        throw new UsageError(`unknown gate or flag: ${unknown.join(', ')}. Gates: ${GATE_NAMES.join(', ')}.`);
    }
    const named = rest.filter(isGateName);
    const report = flags.get('--report');
    return {
        dir: resolve(flags.get('--dir') ?? defaultDir),
        filter: flags.get('--source') ?? null,
        reportDir: report === undefined ? null : resolve(report),
        gates: named.length > 0 ? named : GATE_NAMES,
    };
}
