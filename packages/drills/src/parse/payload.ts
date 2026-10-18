/**
 * The parsing boundary: untyped input in, a schema-checked `OntologyPayload` out.
 *
 * The only place an encoding becomes typed. Everything downstream reads the
 * typed payload, so the one type assertion lives here, behind the schema that
 * justifies it.
 */
import { Validator, type Schema } from '@cfworker/json-schema';
import schemaJson from '../ontology/poker-ontology-v1.schema.json' with { type: 'json' };
import type { OntologyPayload } from '../ontology/types.ts';
import { CODES, type Finding } from '../validator/report.ts';

const validator = new Validator(schemaJson as Schema, '2020-12');

export interface ParseResult {
    readonly findings: Finding[];
    readonly payload: OntologyPayload | null;
}

const failure = (code: Finding['code'], message: string): ParseResult => ({
    payload: null,
    findings: [{ stage: 1, severity: 'error', code, path: '', message }],
});

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function parseJson(raw: unknown): { ok: true; data: unknown } | { ok: false; result: ParseResult } {
    if (typeof raw !== 'string') return { ok: true, data: raw };
    try {
        return { ok: true, data: JSON.parse(raw) };
    } catch (error) {
        return { ok: false, result: failure(CODES.NOT_JSON, `The file is not valid JSON: ${messageOf(error)}`) };
    }
}

/**
 * Stage 1 of the validator: is it JSON, and does it match the schema? A string
 * is parsed first; anything else is checked as it is.
 */
export function parsePayload(raw: unknown): ParseResult {
    const parsed = parseJson(raw);
    if (!parsed.ok) return parsed.result;
    // The schema library rejects some inputs by throwing (`undefined` anywhere in
    // the tree is one); nothing pasted into an import box may take the page down.
    let result;
    try {
        result = validator.validate(parsed.data);
    } catch (error) {
        return failure(CODES.SCHEMA_INVALID, `The payload could not be checked against the schema: ${messageOf(error)}`);
    }
    if (result.valid) return { payload: parsed.data as OntologyPayload, findings: [] };
    return {
        payload: null,
        findings: result.errors.map((error) => ({
            stage: 1 as const,
            severity: 'error' as const,
            code: CODES.SCHEMA_INVALID,
            path: error.instanceLocation,
            message: `${error.error} (failed ${error.keyword})`,
            witness: error.keywordLocation,
        })),
    };
}

/**
 * The payload of a file that must be valid: a fixture or a test encoding. An
 * invalid one is a bug in the fixture, so this throws with the first finding.
 */
export function payloadOrThrow(raw: unknown): OntologyPayload {
    const { payload, findings } = parsePayload(raw);
    if (payload === null) throw new Error(`Invalid encoding: ${findings[0]?.message ?? 'unknown error'}`);
    return payload;
}
