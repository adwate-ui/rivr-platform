import { describe, it, expect } from 'vitest';
import schema from './poker-ontology-v1.schema.json' with { type: 'json' };
import { ONTOLOGY_ENUMS, ONTOLOGY_VERSION, ONTOLOGY_VERSIONS, situationStreets } from './types.ts';

/**
 * The schema and its TypeScript mirror, reconciled.
 *
 * `types.ts` is hand-written, so nothing but this file stops the two drifting.
 * The failure it prevents is silent rather than loud: add a `board_tag` to the
 * schema and forget the tuple, and the classifier's `Record<BoardTag, …>` still
 * compiles, still runs, and simply never emits the new tag. Every drill keyed on
 * it degrades and no test goes red.
 *
 * So the assertion is set-equality in BOTH directions, over every enum in the
 * document rather than a list someone remembered to update — found by walking
 * the schema, not by enumerating it here. An enum added anywhere, at any depth,
 * fails this test naming its JSON Pointer.
 */

/** Every `enum` in the document, keyed by JSON Pointer. */
function collectEnums(node: unknown, pointer: string, found: Map<string, string[]>): void {
    if (node === null || typeof node !== 'object') return;

    const entries: [string, unknown][] = Object.entries(node);
    const members = entries.find(([key]) => key === 'enum')?.[1];
    if (Array.isArray(members)) found.set(pointer, members.map(String));

    for (const [key, value] of entries) {
        if (value !== null && typeof value === 'object') collectEnums(value, `${pointer}/${key}`, found);
    }
}

const schemaEnums = new Map<string, string[]>();
collectEnums(schema, '#', schemaEnums);

describe('the ontology mirror', () => {
    it('reports the version the schema declares', () => {
        expect(schema.properties.ontology_version.enum).toContain(ONTOLOGY_VERSION);
    });

    it('finds enums to check at all, so a broken walk cannot pass vacuously', () => {
        // The walk returning nothing would make every assertion below trivially
        // true. Pin the count so a refactor that stops descending fails here
        // rather than reporting a clean bill of health.
        expect(schemaEnums.size).toBe(30);
    });

    it('mirrors every enum in the schema, and mirrors nothing that is not in it', () => {
        expect([...Object.keys(ONTOLOGY_ENUMS)].sort()).toEqual([...schemaEnums.keys()].sort());
    });

    it.each([...schemaEnums.entries()])('has exactly the members the schema gives %s', (pointer, members) => {
        const mirrored = ONTOLOGY_ENUMS[pointer];
        expect(mirrored, `no tuple mirrors ${pointer}`).toBeDefined();
        expect([...(mirrored ?? [])].sort()).toEqual([...members].sort());
    });

    it('declares no member twice in any tuple', () => {
        for (const [pointer, members] of Object.entries(ONTOLOGY_ENUMS)) {
            expect(new Set(members).size, `${pointer} repeats a member`).toBe(members.length);
        }
    });
});

describe('reading a street constraint', () => {
    it('accepts the 1.0 single-value form', () => {
        expect(situationStreets({ street: 'flop' })).toEqual(['flop']);
    });

    it('accepts the 1.1 array form', () => {
        expect(situationStreets({ street: ['turn', 'river'] })).toEqual(['turn', 'river']);
    });

    it('treats an absent or empty constraint as unconstrained', () => {
        expect(situationStreets({})).toBeUndefined();
        expect(situationStreets({ street: [] })).toBeUndefined();
    });

    it('reads both versions this build accepts', () => {
        expect(ONTOLOGY_VERSIONS).toContain('1.0');
        expect(ONTOLOGY_VERSIONS).toContain('1.1');
    });
});
