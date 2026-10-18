import { describe, it, expect } from 'vitest';
import { parseHands } from '../range/parse.ts';
import { effectiveRule } from './resolve.ts';
import { context, principle, resolved, scenario } from './fixtures.ts';

/**
 * The action resolver's precedence chain.
 *
 * Tested AT EVERY BOUNDARY on purpose: each layer can silently mask the one
 * beneath it, so a test that only checked the top and the bottom would pass with
 * the middle three wired in any order.
 */

describe('precedence', () => {
    it('5. falls through to the default when no branch matches', () => {
        const result = resolved(principle(), scenario({ handClass: 'no_pair' }), context());
        expect(result.outcome.action).toBe('check');
        expect(result.provenance.kind).toBe('default');
    });

    it('4. a matching branch beats the default', () => {
        const result = resolved(principle(), scenario(), context());
        expect(result.outcome.action).toBe('bet');
        expect(result.provenance.kind).toBe('branch');
    });

    it('4. the FIRST matching branch wins, and later matches are recorded', () => {
        const twoBranches = principle({
            rule: {
                kind: 'predicate',
                situation: { street: 'flop' },
                branches: [
                    { when: {}, then: { action: 'bet' } },
                    { when: {}, then: { action: 'raise' } },
                ],
                default: { action: 'check' },
            },
        });
        const result = resolved(twoBranches, scenario(), context());
        expect(result.outcome.action).toBe('bet');
        expect(result.shadowed.map((entry) => entry.detail)).toEqual(['branch 1']);
    });

    it('3. an exception beats the branch that would otherwise fire', () => {
        const withException = principle({
            exceptions: [{
                when: { stack_bracket: ['standard'] },
                then: { action: 'check' },
                note: 'flat at standard depth',
            }],
        });
        const result = resolved(withException, scenario(), context());
        expect(result.outcome.action).toBe('check');
        expect(result.provenance.kind).toBe('exception');
        expect(result.provenance.detail).toBe('flat at standard depth');
    });

    it('3. the first matching exception wins', () => {
        const withExceptions = principle({
            exceptions: [
                { when: {}, then: { action: 'fold' } },
                { when: {}, then: { action: 'raise' } },
            ],
        });
        expect(resolved(withExceptions, scenario(), context()).outcome.action).toBe('fold');
    });

    it('3. an exception that does not match is skipped', () => {
        const withException = principle({
            exceptions: [{ when: { stack_bracket: ['short'] }, then: { action: 'fold' } }],
        });
        expect(resolved(withException, scenario(), context()).provenance.kind).toBe('branch');
    });

    it('2. a modifier substituting an outcome beats the branch, and loses to an exception', () => {
        const modifier = {
            id: 'mod',
            when: { game_texture: 'loose_passive' as const },
            effect: { substitute_outcome: { action: 'raise' as const } },
        };

        const modified = principle({ modifiers: [modifier] });
        const viaModifier = resolved(modified, scenario(), context({ gameTexture: 'loose_passive' }));
        expect(viaModifier.outcome.action).toBe('raise');
        expect(viaModifier.provenance.kind).toBe('modifier');

        const alsoExcepted = principle({
            modifiers: [modifier],
            exceptions: [{ when: {}, then: { action: 'fold' } }],
        });
        expect(resolved(alsoExcepted, scenario(), context({ gameTexture: 'loose_passive' })).outcome.action)
            .toBe('fold');
    });

    it('2. a modifier whose texture does not match is not applied', () => {
        const modified = principle({
            modifiers: [{
                id: 'mod',
                when: { game_texture: 'loose_passive' },
                effect: { substitute_outcome: { action: 'raise' } },
            }],
        });
        expect(resolved(modified, scenario(), context({ gameTexture: 'tight_aggressive' })).outcome.action)
            .toBe('bet');
    });

    it('2. a modifier can be gated on stack depth instead of texture', () => {
        const modified = principle({
            modifiers: [{
                id: 'mod',
                when: { stack_bracket: ['very_deep'] },
                effect: { substitute_outcome: { action: 'raise' } },
            }],
        });
        expect(resolved(modified, scenario(), context()).outcome.action).toBe('bet');
        expect(resolved(modified, scenario({ stackBracket: 'very_deep' }), context()).outcome.action)
            .toBe('raise');
    });

    it('1. an override replaces the base rule entirely', () => {
        const overridden = principle({
            status: 'overridden',
            override_rule: {
                kind: 'predicate',
                situation: { street: 'flop' },
                branches: [],
                default: { action: 'fold' },
            },
        });
        const result = resolved(overridden, scenario(), context());
        expect(result.outcome.action).toBe('fold');
        expect(result.shadowed[0]?.kind).toBe('override');
    });

    it('1. an override_rule is ignored unless the status says overridden', () => {
        const notYet = principle({
            override_rule: {
                kind: 'predicate', situation: {}, branches: [], default: { action: 'fold' },
            },
        });
        expect(effectiveRule(notYet).overridden).toBe(false);
        expect(resolved(notYet, scenario(), context()).outcome.action).toBe('bet');
    });

    it('1. an override still takes its exceptions from the principle', () => {
        const overridden = principle({
            status: 'overridden',
            override_rule: {
                kind: 'predicate', situation: {}, branches: [], default: { action: 'fold' },
            },
            exceptions: [{ when: {}, then: { action: 'call' } }],
        });
        expect(resolved(overridden, scenario(), context()).outcome.action).toBe('call');
    });
});

describe('range lookups', () => {
    const lookup = principle({
        rule: {
            kind: 'range_lookup',
            situation: { street: 'preflop' },
            range_set_id: 'rs',
            in_range: { action: 'raise', sizing: 'medium' },
            out_of_range: { action: 'fold' },
        },
    });

    const preflop = scenario({
        street: 'preflop', board: [], boardTags: [], handClass: undefined, relativeStrength: undefined,
    });

    it('raises a hand inside the range and folds one outside it', () => {
        const ranges = new Map([['rs', parseHands(['AKo'])]]);
        expect(resolved(lookup, preflop, context({ ranges })).outcome.action).toBe('raise');

        const narrow = new Map([['rs', parseHands(['AA'])]]);
        expect(resolved(lookup, preflop, context({ ranges: narrow })).outcome.action).toBe('fold');
    });

    it('names which range decided it', () => {
        const ranges = new Map([['rs', parseHands(['AKo'])]]);
        const result = resolved(lookup, preflop, context({ ranges }));
        expect(result.provenance.kind).toBe('range');
        expect(result.provenance.detail).toBe('in rs');
    });

    it('folds rather than crashing when the range was never expanded', () => {
        expect(resolved(lookup, preflop, context()).outcome.action).toBe('fold');
    });

    it('a modifier can swap the range the lookup consults', () => {
        const modified = principle({
            ...lookup,
            modifiers: [{
                id: 'wide',
                when: { game_texture: 'loose_passive' },
                effect: { substitute_range_set_id: 'wide' },
            }],
        });
        const ranges = new Map([['rs', parseHands(['AA'])], ['wide', parseHands(['AKo'])]]);

        expect(resolved(modified, preflop, context({ ranges })).outcome.action).toBe('fold');
        expect(resolved(modified, preflop, context({ ranges, gameTexture: 'loose_passive' })).outcome.action)
            .toBe('raise');
    });

    it('a substituted outcome replaces the in-range answer only — the folds stay folds', () => {
        // A loose-game modifier that raises bigger changes what you do with the
        // hands you play; it must never turn the hands the range folds into
        // large raises.
        const modified = principle({
            ...lookup,
            modifiers: [{
                id: 'bigger',
                when: { game_texture: 'loose_passive' },
                effect: { substitute_outcome: { action: 'raise', sizing: 'large' } },
            }],
        });
        const loose = context({ ranges: new Map([['rs', parseHands(['AKo'])]]), gameTexture: 'loose_passive' });
        const inRange = resolved(modified, preflop, loose);
        expect(inRange.outcome).toEqual({ action: 'raise', sizing: 'large' });
        expect(inRange.provenance.kind).toBe('modifier');

        const outOfRange = resolved(modified, preflop, context({
            ranges: new Map([['rs', parseHands(['AA'])]]), gameTexture: 'loose_passive',
        }));
        expect(outOfRange.outcome.action).toBe('fold');
        expect(outOfRange.provenance.kind).toBe('range');
    });
});
