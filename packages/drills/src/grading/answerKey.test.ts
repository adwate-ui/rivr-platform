import { describe, it, expect } from 'vitest';
import { actionKey, countKey, labelKey, sizingKey } from './answerKey.ts';
import { ACTIONS, SIZING_BUCKETS } from '../ontology/types.ts';

/**
 * These assertions are against literal strings on purpose.
 *
 * The action spelling is what gate reports compare answers by. Testing it
 * against a template built the same way the implementation builds it would pass
 * through any change to either, and the first anyone would know is a report
 * diff nobody asked for. So the bytes are typed out here, and changing the
 * format means changing this file deliberately.
 */

describe('the key that stands for an answer', () => {
    it('spells an action the way the reports already spell it', () => {
        expect(actionKey({ action: 'bet', sizing: 'large' })).toBe('bet:large');
        expect(actionKey({ action: 'fold', sizing: 'unspecified' })).toBe('fold:unspecified');
        expect(actionKey({ action: 'raise', sizing: 'all_in' })).toBe('raise:all_in');
        expect(actionKey({ action: 'check', sizing: 'medium' })).toBe('check:medium');
    });

    it('writes an absent sizing as "unspecified" rather than leaving a gap', () => {
        expect(actionKey({ action: 'call' })).toBe('call:unspecified');
        expect(actionKey({ action: 'call', sizing: undefined })).toBe('call:unspecified');
        expect(sizingKey(undefined)).toBe('unspecified');
        expect(sizingKey('small')).toBe('small');
    });

    it('produces something for every action and every sizing the ontology has', () => {
        for (const action of ACTIONS) {
            expect(actionKey({ action })).toBe(`${action}:unspecified`);
            for (const sizing of SIZING_BUCKETS) {
                expect(actionKey({ action, sizing })).toBe(`${action}:${sizing}`);
            }
        }
    });

    it('keeps a label out of the actions\' namespace', () => {
        // A source may legitimately name a label "fold". A report row must still
        // say which question was being answered.
        expect(labelKey('fold')).toBe('label:fold');
        expect(labelKey('strong_fit')).toBe('label:strong_fit');
        expect(labelKey('fold')).not.toBe(actionKey({ action: 'fold' }));
    });

    it('keeps a count out of both', () => {
        expect(countKey(21)).toBe('count:21');
        expect(countKey(0)).toBe('count:0');
        expect(new Set([countKey(21), labelKey('21'), actionKey({ action: 'bet' })]).size).toBe(3);
    });
});
