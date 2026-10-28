import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEncoding } from './check.ts';

const EXAMPLE = readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'example-encoding.json'), 'utf8');

describe('checking an uploaded encoding', () => {
    it('passes the example through the validator and all eight gates, and keeps the report', () => {
        const check = checkEncoding(EXAMPLE);
        expect(check.failed).toEqual([]);
        expect(check.passed).toBe(true);
        expect(check.source?.id).toBe(JSON.parse(EXAMPLE).source.id);
        expect(check.lines.length).toBeGreaterThan(0);
    });

    it('refuses what is not an encoding, gating nothing', () => {
        const check = checkEncoding('{"not": "an encoding"}');
        expect(check.passed).toBe(false);
        expect(check.failed).toEqual(['validator']);
        expect(check.source).toBeNull();
    });
});
