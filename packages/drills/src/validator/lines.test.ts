import { describe, it, expect, beforeEach } from 'vitest';
import type { Situation } from '../ontology/types.ts';
import { CODES } from './index.ts';
import { stage3Vocabulary } from './stage3.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { betSmallPayload, checkRule, codes, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

describe('node_path steps checked against the source\'s own hands', () => {
    it('spell-checks node_path against the steps the source\'s own hands record', () => {
        // `node_path` is real scope now that matching reads it, but it is an
        // array of free strings — so `flop_called` for `flop_call` does not
        // error, the rule just silently stops matching. That is the worst
        // failure mode a scope field can have, and this is the closest thing to
        // a guard available without closing the vocabulary.
        const typo = payload({
            principles: [principle({ rule: checkRule({ street: ['flop'], node_path: ['flop_called'] }) })],
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Kd'], action_log: ['flop_bet', 'flop_call'] },
                author_answer: { action: 'check' },
            }],
        });
        const findings = stage3Vocabulary(typo)
            .filter((finding) => finding.code === CODES.UNKNOWN_PATH_STEP);
        expect(findings).toHaveLength(1);
        // A warning, not an error: a rule may name a line no worked example
        // happens to cover, and the generator replays the path regardless.
        expect(findings[0]?.severity).toBe('warning');
        expect(findings[0]?.path).toBe('/principles/0/rule/situation/node_path/0');
    });

    it('says nothing when the step is one the hands do record', () => {
        const fine = payload({
            principles: [
                principle({ rule: checkRule({ street: ['flop'], node_path: ['flop_bet'] }) }),
                // A rule that names no line at all has nothing to spell-check.
                principle({ id: 'pr_2', rule: checkRule({ street: ['flop'] }) }),
            ],
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Kd'], action_log: ['flop_bet'] },
                author_answer: { action: 'check' },
            }],
        });
        expect(codes(stage3Vocabulary(fine))).not.toContain(CODES.UNKNOWN_PATH_STEP);
    });

    it('has nothing to check against when no hand records a line', () => {
        // With no quiz hands, or none carrying an action log, there is no
        // vocabulary to compare with — so it stays quiet rather than flagging
        // every step in the source.
        const noHands = payload({
            principles: [principle({ rule: checkRule({ street: ['flop'], node_path: ['anything'] }) })],
        });
        expect(codes(stage3Vocabulary(noHands))).not.toContain(CODES.UNKNOWN_PATH_STEP);
        expect(codes(stage3Vocabulary({
            ...noHands,
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Kd'] },
                author_answer: { action: 'check' },
            }],
        }))).not.toContain(CODES.UNKNOWN_PATH_STEP);
    });
});

describe('a line that contradicts its own situation', () => {
    // A reader was once told they were out of position while sitting in
    // position: the flop line seated the villain behind the hero, and the
    // turn's `facing_check` seated them in front.
    const contradictions = (situation: Situation) =>
        stage3Vocabulary(betSmallPayload(situation)).filter((finding) => finding.code === CODES.FACING_CONTRADICTS_PATH);

    it('flags a facing state on the wrong side of the line, either way round', () => {
        const villainBehind = ['hero_flop_check', 'villain_flop_bet', 'hero_flop_call'];
        const behind = contradictions({ street: ['turn'], node_path: villainBehind, postflop_facing_state: ['facing_check', 'first_to_act'] });
        expect(behind).toHaveLength(1);
        expect(behind[0]?.severity).toBe('error');
        expect(behind[0]?.message).toMatch(/in front of the hero.*behind/);

        const villainInFront = ['villain_flop_check', 'hero_flop_bet', 'villain_flop_call'];
        const front = contradictions({ street: ['turn'], node_path: villainInFront, postflop_facing_state: ['first_to_act'] });
        expect(front).toHaveLength(1);
        expect(front[0]?.message).toMatch(/behind the hero.*in front/);
        // A bet the hero's own check invited reads as behind; a cold bet as in front.
        expect(contradictions({ street: ['turn'], node_path: [...villainInFront, 'hero_turn_check'], postflop_facing_state: ['facing_bet'] })).toHaveLength(1);
        expect(contradictions({ street: ['turn'], node_path: villainBehind, postflop_facing_state: ['facing_bet', 'facing_donk'] })).toHaveLength(2);
    });

    it('says so when the line disagrees with itself, and stays quiet where nothing is fixed', () => {
        const twoSided = ['hero_flop_check', 'villain_flop_bet', 'villain_turn_check', 'hero_turn_bet'];
        const both = contradictions({ street: ['river'], node_path: twoSided, postflop_facing_state: ['facing_raise'] });
        expect(both).toHaveLength(1);
        expect(both[0]?.message).toMatch(/both sides at once/);
        // A raise can come from either side; a preflop-only line fixes no side.
        expect(contradictions({ street: ['turn'], node_path: ['hero_flop_check', 'villain_flop_bet'], postflop_facing_state: ['facing_raise'] })).toHaveLength(0);
        expect(contradictions({ street: ['turn', 'preflop'], node_path: ['hero_preflop_raise'], postflop_facing_state: ['facing_check'] })).toHaveLength(0);
        expect(contradictions({ street: 'turn', node_path: ['hero_flop_check', 'villain_flop_bet'] })).toHaveLength(0);
        expect(contradictions({ node_path: ['hero_flop_check', 'villain_flop_bet'], postflop_facing_state: ['facing_check'] })).toHaveLength(0);
    });

    it('requires a heads-up count once an earlier street of the line was bet', () => {
        const settled = (situation: Situation) =>
            stage3Vocabulary(betSmallPayload(situation)).filter((finding) => finding.code === CODES.MULTIWAY_WITH_SETTLED_LINE);
        const line = ['hero_flop_bet', 'villain_flop_call'];
        const omitted = settled({ street: ['turn'], node_path: line, postflop_facing_state: ['first_to_act'] });
        expect(omitted).toHaveLength(1);
        expect(omitted[0]?.severity).toBe('error');
        expect(omitted[0]?.message).toMatch(/omitting player_count/);
        const bigger = settled({ street: ['turn'], node_path: line, player_count: ['heads_up', 'multiway'], postflop_facing_state: ['first_to_act'] });
        expect(bigger).toHaveLength(1);
        expect(bigger[0]?.message).toMatch(/a bigger player_count/);
        // Pinned heads-up, or a line with only checks before the decision, is fine.
        expect(settled({ street: ['turn'], node_path: line, player_count: ['heads_up'], postflop_facing_state: ['first_to_act'] })).toHaveLength(0);
        expect(settled({ street: ['turn'], node_path: ['hero_flop_check', 'villain_flop_check'], postflop_facing_state: ['first_to_act'] })).toHaveLength(0);
        expect(settled({ street: ['flop'], node_path: line })).toHaveLength(0);
    });
});
