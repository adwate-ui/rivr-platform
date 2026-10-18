import { describe, it, expect, beforeEach } from 'vitest';
import type { Principle } from '../ontology/types.ts';
import { CODES } from './index.ts';
import { isConstantRule } from './constantRule.ts';
import { stage6Coverage } from './stage6.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { checkRule, codes, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

const counts = (count: number) => new Map([['pr_1', count]]);

/*
 * The constant-rule check.
 *
 * The naive form of this — "a predicate with no branches is suspect" — is
 * wrong in the one way that matters: it punishes the correct repair. A rule
 * whose discrimination lives in its SITUATION rather than in a branch is
 * exactly what you get after moving a mis-placed exception where it belongs,
 * and flagging that shape pushes an author back toward the broken one. So
 * most of these tests are about what it must NOT flag.
 */
describe('stage 6: a rule that says one word to every spot', () => {
    const constant = (over: Partial<Principle> = {}) => principle({ rule: checkRule({ street: ['flop'] }), ...over });

    it('flags a rule that says one word to every spot on its street', () => {
        const findings = stage6Coverage({
            payload: payload({ principles: [constant()] }),
            scenarioCounts: counts(500),
        });
        const flag = findings.find((finding) => finding.code === CODES.CONSTANT_RULE);
        expect(flag?.severity).toBe('warning');
        expect(isConstantRule(constant())).toBe(true);
    });

    it('does not flag a branchless rule whose SITUATION discriminates', () => {
        // "Fold to flop aggression when multiway" is constant by construction.
        expect(isConstantRule(constant({
            rule: {
                kind: 'predicate',
                situation: { street: ['flop'], player_count: ['multiway'], postflop_facing_state: ['facing_bet'] },
                branches: [],
                default: { action: 'fold' },
            },
        }))).toBe(false);
    });

    it('does not flag a rule discriminated by a branch condition', () => {
        expect(isConstantRule(constant({
            rule: {
                kind: 'predicate',
                situation: { street: ['flop'] },
                branches: [{ when: { hand_class_any: ['set'] }, then: { action: 'bet' } }],
                default: { action: 'check' },
            },
        }))).toBe(false);
    });

    it('treats a branch with an empty condition as no discrimination at all', () => {
        // An empty `when` is a default wearing a branch's clothes.
        expect(isConstantRule(constant({
            rule: {
                kind: 'predicate',
                situation: { street: ['flop'] },
                branches: [{ when: {}, then: { action: 'bet' } }],
                default: { action: 'check' },
            },
        }))).toBe(true);
    });

    it('does not flag a rule an exception or a modifier can redirect', () => {
        expect(isConstantRule(constant({
            exceptions: [{ when: { hand_class_any: ['set'] }, then: { action: 'raise' } }],
        }))).toBe(false);
        expect(isConstantRule(constant({
            modifiers: [{
                id: 'm1',
                when: { game_texture: 'loose_passive' },
                effect: { substitute_outcome: { action: 'bet' } },
            }],
        }))).toBe(false);
    });

    it('never flags a range lookup, where the cards do the discriminating', () => {
        expect(isConstantRule(principle({
            rule: {
                kind: 'range_lookup',
                situation: { street: ['preflop'] },
                range_set_id: 'rs_test',
                in_range: { action: 'raise' },
                out_of_range: { action: 'fold' },
            },
        }))).toBe(false);
    });

    it('says nothing about a concept principle, which has no decision to make', () => {
        expect(codes(stage6Coverage({
            payload: payload({ principles: [constant({ drillable: false })] }),
            scenarioCounts: counts(500),
        }))).not.toContain(CODES.CONSTANT_RULE);
    });

    it('reads the override rule when there is one', () => {
        expect(isConstantRule(constant({
            override_rule: {
                kind: 'predicate',
                situation: { street: ['flop'], hero_position: ['BTN'] },
                branches: [],
                default: { action: 'bet' },
            },
        }))).toBe(false);
    });
});

describe('stage 6: a rule that can never answer', () => {
    it('refuses a rule with no branches and no default, which can never answer', () => {
        // Abstention arrived with 1.3 and brought one way to write a rule that
        // does nothing at all: it matches spots and declines every one of them.
        const dead = payload({
            principles: [principle({ rule: { kind: 'predicate', situation: { street: ['flop'] }, branches: [] } })],
        });
        const findings = stage6Coverage({ payload: dead, scenarioCounts: counts(500) });
        const flag = findings.find((finding) => finding.code === CODES.RULE_NEVER_ANSWERS);
        expect(flag?.severity).toBe('error');
    });

    it('accepts a rule that abstains but has a branch to fall back on', () => {
        const abstaining = payload({
            principles: [principle({
                rule: {
                    kind: 'predicate',
                    situation: { street: ['flop'] },
                    branches: [{ when: { hand_class_any: ['set'] }, then: { action: 'bet' } }],
                },
            })],
        });
        expect(codes(stage6Coverage({ payload: abstaining, scenarioCounts: counts(500) })))
            .not.toContain(CODES.RULE_NEVER_ANSWERS);
    });
});
