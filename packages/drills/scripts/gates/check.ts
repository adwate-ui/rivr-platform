/**
 * The validator and all eight gates over one uploaded encoding, as the console runs them before a super admin's
 * upload is accepted (#131, decision 0016). Nothing is read from or written to disk; the report comes back as lines.
 */
import { parsePayload } from '../../src/parse/payload.ts';
import { GATES } from './all.ts';
import { GATE_NAMES, type GateName } from './names.ts';
import { collecting } from './output.ts';
import type { LoadedSource, ParsedSource } from './sources.ts';
import { validateLoaded } from './validation.ts';

/** What the check found: whether the encoding passed, what it is, the gates it failed and the report to show. */
export interface EncodingCheck {
    readonly passed: boolean;
    /** The encoding's `source`, once it parses. */
    readonly source: { readonly id: string; readonly title: string; readonly author: string | null } | null;
    /** `validator` when the validator refused it, then each gate that failed. */
    readonly failed: readonly ('validator' | GateName)[];
    readonly lines: readonly string[];
}

const isParsed = (source: LoadedSource): source is ParsedSource => source.payload !== null;

/** Checks one encoding's text: the validator first, then each gate in order, all of them run. */
export function checkEncoding(raw: string): EncodingCheck {
    const { payload, findings } = parsePayload(raw);
    const loaded: LoadedSource = {
        file: 'upload.json', reportBase: 'upload', raw, payload, parseError: payload === null ? (findings[0]?.message ?? 'unreadable') : null,
    };
    const { result: failed, lines } = collecting(() => {
        const failures: ('validator' | GateName)[] = [];
        if (!validateLoaded(loaded)) failures.push('validator');
        if (!isParsed(loaded)) return failures;
        for (const name of GATE_NAMES) {
            if (!GATES[name].run({ source: loaded, reports: null })) failures.push(name);
        }
        return failures;
    });
    const source = loaded.payload === null ? null
        : { id: loaded.payload.source.id, title: loaded.payload.source.title, author: loaded.payload.source.author ?? null };
    return { passed: failed.length === 0, source, failed, lines };
}
