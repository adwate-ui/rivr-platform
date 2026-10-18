/**
 * The encodings a run gates, read once and shared by every gate.
 *
 * Every gate reads the same list, so a second encoding in the folder is gated
 * by all eight or by none, never by one gate alone. A file that is not JSON or
 * does not match the schema still appears here, with its parse error, so the
 * gates fail it rather than skipping it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePayload } from '../../src/parse/payload.ts';
import type { OntologyPayload } from '../../src/ontology/types.ts';
import { UsageError } from './cli.ts';

export interface LoadedSource {
    readonly file: string;
    /** The file name without `.json`: what the per-source reports are named after. */
    readonly reportBase: string;
    readonly raw: string;
    /** Null when the file is not JSON or does not match the schema. */
    readonly payload: OntologyPayload | null;
    readonly parseError: string | null;
}

/** A source that parsed: what every gate but `sources` works on. */
export type ParsedSource = LoadedSource & { readonly payload: OntologyPayload };

/** Sorted `*.json` file names in the folder; empty when it does not exist. */
export function sourceFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
}

function loadSource(dir: string, file: string): LoadedSource {
    const raw = readFileSync(join(dir, file), 'utf8');
    const { payload, findings } = parsePayload(raw);
    return {
        file,
        reportBase: file.replace(/\.json$/, ''),
        raw,
        payload,
        parseError: payload === null ? (findings[0]?.message ?? 'unreadable') : null,
    };
}

/** The source id, or a placeholder for a file that did not parse. */
export const sourceIdOf = (source: LoadedSource): string => source.payload?.source.id ?? 'unparsable';

const matches = (source: LoadedSource, filter: string): boolean =>
    source.file === filter || source.reportBase === filter || source.payload?.source.id === filter;

/**
 * Every encoding in the folder, or the one `filter` names. A filter that
 * matches nothing is a usage error: a typo must not read as "nothing to check".
 */
export function loadSources(dir: string, filter: string | null): LoadedSource[] {
    const all = sourceFiles(dir).map((file) => loadSource(dir, file));
    if (filter === null) return all;
    const selected = all.filter((source) => matches(source, filter));
    if (selected.length === 0) {
        const known = all.map((source) => `${source.file} (${sourceIdOf(source)})`).join(', ') || '(none)';
        throw new UsageError(`no encoding matches --source "${filter}". Known: ${known}.`);
    }
    return selected;
}

/** Narrows a loaded source to one that parsed. */
export const isParsed = (source: LoadedSource): source is ParsedSource => source.payload !== null;
