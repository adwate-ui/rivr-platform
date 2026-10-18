import { describe, it, expect, beforeEach } from 'vitest';
import example from '../../fixtures/example-encoding.json' with { type: 'json' };
import { parsePayload } from '../parse/payload.ts';
import {
    validateSource, CODES, STAGE_NAMES, makeReport, groupByObject, countBySeverity, isError, type Finding,
} from './index.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload, principle, rangeRule } from './fixtures.ts';

/**
 * The six-stage validator.
 *
 * The organising idea in these tests is that each stage catches something the
 * stage before it cannot see. Schema conformance says nothing about whether an
 * id resolves; a resolving id says nothing about whether the rule it belongs to
 * can ever produce a scenario. So the tests are mostly pairs: a payload that
 * passes stage N and fails stage N+1.
 */

beforeEach(() => resetTagCompatibilityCache());

describe('the worked example that ships with the schema', () => {
    it('passes all six stages', () => {
        const report = validateSource(example);
        expect(report.reached).toBe(6);
        expect(report.findings.filter(isError)).toEqual([]);
        expect(report.ok).toBe(true);
    });

    it('is nonetheless warned about, which is stage 5 doing its job', () => {
        // It is a schema demonstration, not a polished encoding: the cbet rule's
        // last branch answers exactly what its default answers.
        const report = validateSource(example);
        expect(codes(report.findings)).toContain(CODES.DET_BRANCH_SAME_AS_DEFAULT);
    });
});

describe('stage 1: schema', () => {
    it('accepts a well-formed payload', () => {
        expect(parsePayload(payload()).findings).toEqual([]);
    });

    it('parses a JSON string as well as an object', () => {
        expect(parsePayload(JSON.stringify(payload())).payload).not.toBeNull();
    });

    it('reports unparseable JSON rather than throwing', () => {
        const result = parsePayload('{ not json');
        expect(result.payload).toBeNull();
        expect(codes(result.findings)).toEqual([CODES.NOT_JSON]);
    });

    it('reports a missing required field with a pointer to it', () => {
        const broken: Record<string, unknown> = { ...payload() };
        delete broken.principles;
        const result = parsePayload(broken);
        expect(result.payload).toBeNull();
        expect(codes(result.findings)).toContain(CODES.SCHEMA_INVALID);
        expect(result.findings[0]?.path).toBe('#');
    });

    it('turns a validator that throws into a finding rather than a crash', () => {
        // `undefined` cannot appear in real JSON, but it can appear in an object
        // handed to us directly, and the checker throws on it. Nothing pasted
        // into an import box should be able to take the page down.
        const result = parsePayload({ ...payload(), principles: undefined });
        expect(result.payload).toBeNull();
        expect(codes(result.findings)).toEqual([CODES.SCHEMA_INVALID]);
    });

    it('rejects a value outside a closed vocabulary', () => {
        const broken = {
            ...payload(),
            principles: [{ ...principle(), rule: { ...rangeRule(), situation: { street: 'preflop', hero_position: ['MIDDLE'] } } }],
        };
        expect(parsePayload(broken).payload).toBeNull();
    });

    it('rejects a version the schema does not know', () => {
        // A version stand-in has to be one nothing will ever claim, or the test
        // quietly starts asserting that a valid payload is invalid the day that
        // version is released.
        expect(parsePayload({ ...payload(), ontology_version: '9.9' }).payload).toBeNull();
    });

    it('short-circuits the whole pipeline', () => {
        expect(validateSource('nonsense').reached).toBe(1);
    });
});

describe('the report', () => {
    const finding = (over: Partial<Finding> = {}): Finding => ({
        stage: 2, severity: 'error', code: CODES.DUPLICATE_ID, path: '/x', message: 'x', ...over,
    });

    it('is ok exactly when nothing is an error', () => {
        expect(makeReport(6, []).ok).toBe(true);
        expect(makeReport(6, [finding({ severity: 'warning' })]).ok).toBe(true);
        expect(makeReport(6, [finding({ severity: 'info' })]).ok).toBe(true);
        expect(makeReport(6, [finding()]).ok).toBe(false);
    });

    it('groups findings by the object they belong to', () => {
        const groups = groupByObject([
            finding({ objectId: 'pr_1' }),
            finding({ objectId: 'pr_1' }),
            finding({ objectId: 'pr_2' }),
            finding(),
        ]);
        expect(groups).toHaveLength(3);
        expect(groups.find((group) => group.objectId === 'pr_1')?.findings).toHaveLength(2);
        expect(groups.find((group) => group.objectId === '(payload)')?.findings).toHaveLength(1);
    });

    it('counts by severity', () => {
        expect(countBySeverity([
            finding(), finding({ severity: 'warning' }), finding({ severity: 'info' }), finding(),
        ])).toEqual({ error: 2, warning: 1, info: 1 });
    });

    it('names every stage', () => {
        ([1, 2, 3, 4, 5, 6] as const).forEach((stage) => expect(STAGE_NAMES[stage]).toBeTruthy());
    });
});
