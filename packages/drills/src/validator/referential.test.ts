import { describe, it, expect, beforeEach } from 'vitest';
import { validateSource, CODES } from './index.ts';
import { stage2Referential } from './stage2.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload, principle, rangeRule } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

describe('stage 2: referential', () => {
    it('passes a payload whose ids all resolve', () => {
        expect(stage2Referential(payload())).toEqual([]);
    });

    it('catches a range set that does not exist', () => {
        const broken = payload({
            principles: [principle({ rule: rangeRule({ range_set_id: 'ghost' }) })],
        });
        expect(codes(stage2Referential(broken))).toContain(CODES.UNKNOWN_RANGE_SET);
    });

    it('catches a prerequisite that does not exist', () => {
        const broken = payload({ principles: [principle({ prerequisites: ['ghost'] })] });
        expect(codes(stage2Referential(broken))).toContain(CODES.UNKNOWN_PREREQUISITE);
    });

    it('catches an opponent type the source never defined', () => {
        const broken = payload({
            principles: [principle({
                rule: rangeRule({ situation: { street: 'preflop', villain_types: ['ghost'] } }),
            })],
        });
        expect(codes(stage2Referential(broken))).toContain(CODES.UNKNOWN_OPPONENT_TYPE);
    });

    it('catches a quiz hand pointing at an opponent type that does not exist', () => {
        // 1.2 types `villain_type_id` as a plain string, so the schema cannot
        // tell a real id from a typo. Without this the value has merely MOVED
        // from free prose into a field that LOOKS checked, which is worse — a
        // mis-referenced type silently fails to match every principle keyed on
        // that opponent, and the source still imports clean.
        const broken = payload({
            opponent_types: [{ id: 'opp_nit', label: 'Nit', canonical_archetype: 'nit' }],
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Kd'], villain_type_id: 'opp_ghost' },
                author_answer: { action: 'fold' },
            }],
        });
        const findings = stage2Referential(broken)
            .filter((finding) => finding.code === CODES.UNKNOWN_OPPONENT_TYPE);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.path).toBe('/quiz_hands/0/situation_instance/villain_type_id');
        expect(findings[0]?.objectId).toBe('q1');
    });

    it('accepts a quiz hand whose opponent type resolves, and one that omits it', () => {
        const fine = payload({
            opponent_types: [{ id: 'opp_nit', label: 'Nit', canonical_archetype: 'nit' }],
            quiz_hands: [
                {
                    id: 'q1',
                    source_id: 'src_test',
                    situation_instance: { hero_cards: ['Ah', 'Kd'], villain_type_id: 'opp_nit' },
                    author_answer: { action: 'fold' },
                },
                {
                    id: 'q2',
                    source_id: 'src_test',
                    situation_instance: { hero_cards: ['Ah', 'Kd'] },
                    author_answer: { action: 'fold' },
                },
            ],
        });
        expect(codes(stage2Referential(fine))).not.toContain(CODES.UNKNOWN_OPPONENT_TYPE);
    });

    it('catches a derived_from with no parent', () => {
        const broken = payload({ range_sets: [{ id: 'rs_1', hands: ['AA'], derived_from: 'ghost' }] });
        expect(codes(stage2Referential(broken))).toContain(CODES.UNKNOWN_PARENT_RANGE);
    });

    it('catches duplicate ids in every collection', () => {
        expect(codes(stage2Referential(payload({
            principles: [principle(), principle()],
        })))).toContain(CODES.DUPLICATE_ID);

        expect(codes(stage2Referential(payload({
            range_sets: [{ id: 'rs_1', hands: ['AA'] }, { id: 'rs_1', hands: ['KK'] }],
        })))).toContain(CODES.DUPLICATE_ID);

        expect(codes(stage2Referential(payload({
            opponent_types: [
                { id: 'opp_1', label: 'a', canonical_archetype: 'nit' },
                { id: 'opp_1', label: 'b', canonical_archetype: 'maniac' },
            ],
        })))).toContain(CODES.DUPLICATE_ID);
    });

    it('names a range derivation loop rather than recursing into it', () => {
        const broken = payload({
            range_sets: [
                { id: 'rs_1', hands: ['AA'], derived_from: 'rs_2' },
                { id: 'rs_2', hands: ['KK'], derived_from: 'rs_1' },
            ],
        });
        expect(codes(stage2Referential(broken))).toContain(CODES.RANGE_CYCLE);
    });

    it('names a prerequisite loop, which would lock every principle in it forever', () => {
        const broken = payload({
            principles: [
                principle({ id: 'a', prerequisites: ['b'] }),
                principle({ id: 'b', prerequisites: ['a'] }),
            ],
        });
        expect(codes(stage2Referential(broken))).toContain(CODES.PREREQUISITE_CYCLE);
    });

    it('catches a principle claiming a different source', () => {
        const broken = payload({ principles: [principle({ source_id: 'src_other' })] });
        expect(codes(stage2Referential(broken))).toContain(CODES.SOURCE_ID_MISMATCH);
    });

    it('catches a modifier substituting a range that does not exist', () => {
        const broken = payload({
            principles: [principle({
                modifiers: [{
                    id: 'mod_1',
                    when: { game_texture: 'loose_passive' },
                    effect: { substitute_range_set_id: 'ghost' },
                }],
            })],
        });
        expect(codes(stage2Referential(broken))).toContain(CODES.UNKNOWN_RANGE_SET);
    });

    it('checks the override rule when there is one, not the rule it replaces', () => {
        const broken = payload({
            principles: [principle({
                status: 'overridden',
                override_rule: {
                    kind: 'range_lookup',
                    situation: { street: 'preflop' },
                    range_set_id: 'ghost',
                    in_range: { action: 'raise' },
                    out_of_range: { action: 'fold' },
                },
            })],
        });
        expect(codes(stage2Referential(broken))).toContain(CODES.UNKNOWN_RANGE_SET);
    });

    it('short-circuits the pipeline', () => {
        const broken = payload({ principles: [principle({ prerequisites: ['ghost'] })] });
        expect(validateSource(broken).reached).toBe(2);
    });
});
