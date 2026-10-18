import { describe, it, expect, beforeEach } from 'vitest';
import type { Situation } from '../ontology/types.ts';
import { CODES } from './index.ts';
import { stage3Vocabulary } from './stage3.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { betSmallPayload, checkRule, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

const only = (code: string) => (findings: ReturnType<typeof stage3Vocabulary>) =>
    findings.filter((finding) => finding.code === code);

describe('a branch on a coordinate the rule never claims', () => {
    it('refuses a branch that reads a coordinate its own rule never claims', () => {
        const dead = (situation: Situation, when: Situation) => only(CODES.BRANCH_READS_UNCLAIMED_SLOT)(stage3Vocabulary(payload({
            principles: [principle({
                rule: { kind: 'predicate', situation, branches: [{ when, then: { action: 'call' } }] },
            })],
        })));

        // The generator leaves `villain_raise_size` unset unless the rule
        // claims it, so this branch fires for the author's quiz hand — which
        // states a size — and never for a reader. One real rule declined 93%
        // of its spots this way.
        const found = dead({ street: ['flop'], pot_type: ['single_raised'] }, { villain_raise_size: ['small'] });
        expect(found).toHaveLength(1);
        expect(found[0]?.severity).toBe('error');
        expect(found[0]?.message).toMatch(/can never fire/);
        expect(found[0]?.witness).toBe('small');
        // Claimed by the situation, so the generator samples it: reachable.
        expect(dead(
            { street: ['flop'], pot_type: ['single_raised'], villain_raise_size: ['small', 'standard'] },
            { villain_raise_size: ['small'] },
        )).toHaveLength(0);
        // The same trap on the opponent type.
        expect(dead({ street: ['flop'] }, { villain_types: ['opp_x'] })).toHaveLength(1);
        // Coordinates the generator always samples are not affected.
        expect(dead({ street: ['flop'] }, { pot_type: ['three_bet'] })).toHaveLength(0);
        expect(dead({ street: ['flop'] }, { hand_class_any: ['set'] })).toHaveLength(0);
    });

    it('reads a user override in place of the rule it replaced', () => {
        // Every stage-3 check inspects `override_rule ?? rule`: an override
        // is what the reader is actually graded by, so a dead branch inside
        // one is just as dead.
        const overridden = only(CODES.BRANCH_READS_UNCLAIMED_SLOT)(stage3Vocabulary(payload({
            principles: [principle({
                rule: checkRule({ street: ['flop'] }),
                override_rule: {
                    kind: 'predicate',
                    situation: { street: ['flop'] },
                    branches: [{ when: { villain_raise_size: ['large'] }, then: { action: 'fold' } }],
                    default: { action: 'call' },
                },
            })],
        })));
        expect(overridden).toHaveLength(1);
        expect(overridden[0]?.path).toContain('/override_rule/branches/0/when/villain_raise_size');
    });

    it('checks an exception the same way, and leaves concepts alone', () => {
        const withException = (drillable: boolean) => only(CODES.BRANCH_READS_UNCLAIMED_SLOT)(stage3Vocabulary(payload({
            principles: [principle({
                drillable,
                rule: checkRule({ street: ['flop'] }),
                exceptions: [{ when: { villain_raise_size: ['all_in'] }, then: { action: 'fold' } }],
            })],
        })));
        expect(withException(true)).toHaveLength(1);
        expect(withException(false)).toHaveLength(0);
    });
});

describe('a postflop rule that never names its pot', () => {
    it('warns when a postflop rule never says what kind of pot it is about', () => {
        const potTypes = (situation: Situation) => only(CODES.POT_TYPE_UNSTATED)(stage3Vocabulary(betSmallPayload(situation)));
        // An omitted pot_type claims the four-bet pot as loudly as the limped
        // one: in one real encoding eleven rules omitted it and each dealt a
        // quarter of its spots as four-bet pots.
        const omitted = potTypes({ street: ['turn'] });
        expect(omitted).toHaveLength(1);
        expect(omitted[0]?.severity).toBe('warning');
        expect(omitted[0]?.message).toMatch(/four-bet/);
        expect(potTypes({ street: ['turn'], pot_type: ['single_raised'] })).toHaveLength(0);
        // A rule with no street at all plays on every one of them.
        expect(potTypes({})).toHaveLength(1);
        // Preflop has its own pot-building vocabulary, and a concept rule
        // is not generated from at all.
        expect(potTypes({ street: ['preflop'] })).toHaveLength(0);
        const concept = payload({
            principles: [principle({ drillable: false, rule: checkRule({ street: ['turn'] }) })],
        });
        expect(only(CODES.POT_TYPE_UNSTATED)(stage3Vocabulary(concept))).toHaveLength(0);
    });
});

describe('a postflop rule that never looks at the hand', () => {
    it('refuses a postflop rule that answers every hand without ever stating one', () => {
        const hands = (situation: Situation) => only(CODES.HAND_NEVER_EXAMINED)(stage3Vocabulary(betSmallPayload(situation)));
        // The defect it exists for: a rule pinning several table coordinates
        // and no hand coordinate answered a set and seven-high with one
        // `raise`, and gave both the same bluff argument.
        const silent = hands({ street: ['flop'], board_require: ['ace_high'] });
        expect(silent).toHaveLength(1);
        expect(silent[0]?.severity).toBe('error');
        // Writing the list out is a CLAIM, and passes: a source may really
        // mean every hand.
        expect(hands({ street: ['flop'], hand_class_any: ['no_pair', 'set'] })).toHaveLength(0);
        // So does saying it by draw class or by relative strength.
        expect(hands({ street: ['flop'], draw_class_any: ['flush_draw'] })).toHaveLength(0);
        expect(hands({ street: ['flop'], relative_strength_any: ['weak'] })).toHaveLength(0);
        // Preflop the hand IS the range lookup, and a rule with no street
        // plays on the flop among others.
        expect(hands({ street: ['preflop'] })).toHaveLength(0);
        expect(hands({})).toHaveLength(1);
    });

    it('counts a branch that reads the hand as having looked', () => {
        const branched = (situation: Situation, when: Situation) => only(CODES.HAND_NEVER_EXAMINED)(stage3Vocabulary(payload({
            principles: [principle({
                rule: { kind: 'predicate', situation, branches: [{ when, then: { action: 'bet' } }], default: { action: 'check' } },
            })],
        })));
        expect(branched({ street: ['turn'], hand_class_any: ['no_pair', 'set'] }, { hand_class_any: ['set'] })).toHaveLength(0);
        expect(branched({ street: ['turn'] }, { relative_strength_any: ['nuts'] })).toHaveLength(0);
    });

    it('leaves a concept and a range lookup alone', () => {
        const concept = payload({
            principles: [principle({ drillable: false, rule: checkRule({ street: ['turn'] }) })],
        });
        expect(only(CODES.HAND_NEVER_EXAMINED)(stage3Vocabulary(concept))).toHaveLength(0);
        // A range rule's hand IS its range, and there is nothing to state.
        expect(only(CODES.HAND_NEVER_EXAMINED)(stage3Vocabulary(payload({
            principles: [principle({
                rule: {
                    kind: 'range_lookup',
                    situation: { street: ['turn'] },
                    range_set_id: 'rs_1',
                    in_range: { action: 'bet', feedback: { correct: 'x' } },
                },
            })],
        })))).toHaveLength(0);
    });
});
