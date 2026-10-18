import { describe, it, expect } from 'vitest';
import type { Situation } from '../ontology/types.ts';
import { matchesSituation } from './match.ts';
import { scenario } from './fixtures.ts';

/**
 * Matching a spot to a situation.
 *
 * Every coordinate the schema names is scope, and each one that went unread by
 * the matcher at some point let a rule claim spots it never meant: the action
 * line, the runout, the stack-to-pot bracket, the stakes. Each has its own block
 * here so that cannot happen quietly again.
 */

describe('matching a scenario to a situation', () => {
    /*
     * node_path is SCOPE. A rule about barrelling the turn is scoped to having
     * bet the flop and been called; a matcher that discarded the path would let
     * it claim every spot on the street.
     */
    it('requires the actions the rule names to have actually happened', () => {
        const hand = scenario({ nodePath: ['preflop_raise', 'flop_bet', 'flop_call'] });
        expect(matchesSituation(hand, { node_path: ['flop_bet', 'flop_call'] })).toBe(true);
        expect(matchesSituation(hand, { node_path: ['flop_check'] })).toBe(false);
    });

    it('reads the path as a subsequence, not as the whole history', () => {
        // A rule names the actions that must have occurred, not every action
        // that did. Requiring equality would make every rule unreachable on any
        // hand recorded in more detail than the rule was written with.
        const hand = scenario({ nodePath: ['preflop_raise', 'flop_bet', 'flop_call', 'turn_check'] });
        expect(matchesSituation(hand, { node_path: ['flop_bet', 'flop_call'] })).toBe(true);
        expect(matchesSituation(hand, { node_path: ['preflop_raise', 'turn_check'] })).toBe(true);
    });

    it('insists on the order, not merely on the tokens being present', () => {
        const hand = scenario({ nodePath: ['flop_call', 'flop_bet'] });
        expect(matchesSituation(hand, { node_path: ['flop_bet', 'flop_call'] })).toBe(false);
    });

    it('treats an absent or empty path as no constraint', () => {
        expect(matchesSituation(scenario({ nodePath: [] }), {})).toBe(true);
        expect(matchesSituation(scenario({ nodePath: [] }), { node_path: [] })).toBe(true);
    });

    it('refuses a rule whose path is longer than the hand can satisfy', () => {
        expect(matchesSituation(
            scenario({ nodePath: ['flop_bet'] }),
            { node_path: ['flop_bet', 'flop_call'] },
        )).toBe(false);
    });

    it('accepts an empty situation, which constrains nothing', () => {
        expect(matchesSituation(scenario(), {})).toBe(true);
    });

    const mismatches: [string, Situation][] = [
        ['street', { street: 'turn' }],
        ['hero position', { hero_position: ['SB'] }],
        ['villain position', { villain_position: ['CO'] }],
        ['pot type', { pot_type: ['three_bet'] }],
        ['player count', { player_count: ['multiway'] }],
        ['stack bracket', { stack_bracket: ['short'] }],
        ['stakes', { stakes: ['5/10'] }],
        ['postflop facing state', { postflop_facing_state: ['facing_bet'] }],
        ['villain raise size', { villain_raise_size: ['large'] }],
        ['villain type', { villain_types: ['opp_nit'] }],
        ['hand class', { hand_class_any: ['set'] }],
        ['draw class', { draw_class_any: ['flush_draw'] }],
        ['relative strength', { relative_strength_any: ['weak'] }],
        ['a required board tag', { board_require: ['monotone'] }],
    ];
    it.each(mismatches)('rejects on a mismatched %s', (_label, situation) => {
        expect(matchesSituation(scenario(), situation)).toBe(false);
    });

    it('rejects when the board carries an excluded tag', () => {
        expect(matchesSituation(scenario(), { board_exclude: ['ace_high'] })).toBe(false);
    });

    it('accepts when every constraint is met', () => {
        expect(matchesSituation(scenario(), {
            street: 'flop',
            hero_position: ['BTN', 'CO'],
            board_require: ['rainbow'],
            board_exclude: ['monotone'],
            hand_class_any: ['top_pair_good_kicker'],
            relative_strength_any: ['strong'],
        })).toBe(true);
    });

    it('rejects a constraint on a coordinate the scenario does not have', () => {
        expect(matchesSituation(scenario({ preflopFacingState: undefined }), {
            preflop_facing_state: ['unopened'],
        })).toBe(false);
        expect(matchesSituation(scenario({ draws: undefined }), { draw_class_any: ['none'] })).toBe(false);
    });

    it('treats an empty constraint list as no constraint at all', () => {
        expect(matchesSituation(scenario(), { hero_position: [] })).toBe(true);
    });
});

describe('stakes as a coordinate', () => {
    /**
     * The same spot can have different answers in different games, so a rule
     * scoped to one game must refuse another. The UNSTATED case is the doctrine
     * that governs every coordinate here: a hand that never says what game it
     * was is not thereby every game.
     */
    it('admits a spot at the stakes it names', () => {
        expect(matchesSituation(scenario({ stakes: '2/5' }), { stakes: ['2/5'] })).toBe(true);
    });

    it('admits a rule that spans two of the three', () => {
        expect(matchesSituation(scenario({ stakes: '2/5' }), { stakes: ['1/2', '2/5'] })).toBe(true);
    });

    it('refuses a spot from a different game', () => {
        expect(matchesSituation(scenario({ stakes: '1/2' }), { stakes: ['5/10'] })).toBe(false);
    });

    it('refuses a spot that never said, rather than treating silence as any', () => {
        expect(matchesSituation(scenario({ stakes: undefined }), { stakes: ['1/2'] })).toBe(false);
    });

    it('ignores the coordinate entirely when the rule does not constrain it', () => {
        expect(matchesSituation(scenario({ stakes: undefined }), {})).toBe(true);
        expect(matchesSituation(scenario({ stakes: '5/10' }), {})).toBe(true);
    });
});

describe('runout and SPR as coordinates', () => {
    /**
     * Two more fields that are real scope: a rule about brick turns must not
     * claim the turn card that improves every hand that called.
     */
    it('admits a spot whose landed card carries a required runout tag', () => {
        expect(matchesSituation(
            scenario({ runouts: ['brick'] }), { runout_any: ['brick', 'overcard'] },
        )).toBe(true);
    });

    it('refuses the connecting card a brick-scoped rule never claimed', () => {
        expect(matchesSituation(
            scenario({ runouts: ['straight_completing'] }), { runout_any: ['brick'] },
        )).toBe(false);
    });

    it('refuses a hand that never said what the card changed', () => {
        expect(matchesSituation(scenario({ runouts: undefined }), { runout_any: ['brick'] })).toBe(false);
    });

    it('refuses a hand holding an EXCLUDED draw, whatever else it holds', () => {
        // A rule meant for hands with no real draw. `draw_class_any: [none,
        // backdoor_flush]` would admit a gutshot that also backed into a flush;
        // the exclusion does not.
        const noRealDraw: Situation = { draw_class_exclude: ['gutshot', 'open_ended', 'flush_draw', 'combo_draw'] };
        expect(matchesSituation(scenario({ draws: ['backdoor_flush'] }), noRealDraw)).toBe(true);
        expect(matchesSituation(scenario({ draws: ['none'] }), noRealDraw)).toBe(true);
        expect(matchesSituation(scenario({ draws: ['gutshot', 'backdoor_flush'] }), noRealDraw)).toBe(false);
        // Preflop there are no draws to exclude.
        expect(matchesSituation(scenario({ draws: undefined }), noRealDraw)).toBe(true);
    });

    it('refuses a landed card carrying an EXCLUDED tag, and admits the overcard a brick scope would have lost', () => {
        // A rule that barrels unless the turn brings straight trouble: an
        // overcard is not a brick and is still a barrel; the card that fills or
        // adds a straight draw is what stops it.
        const unlessStraightTrouble: Situation = { runout_exclude: ['straight_completing', 'straight_drawing'] };
        expect(matchesSituation(scenario({ runouts: ['overcard'] }), unlessStraightTrouble)).toBe(true);
        expect(matchesSituation(scenario({ runouts: ['straight_completing'] }), unlessStraightTrouble)).toBe(false);
        expect(matchesSituation(scenario({ runouts: ['overcard', 'straight_drawing'] }), unlessStraightTrouble)).toBe(false);
        // Nothing landed yet (a flop spot): nothing to exclude.
        expect(matchesSituation(scenario({ runouts: undefined }), unlessStraightTrouble)).toBe(true);
        // On the river the exclusion reads the TURN card too: "the draws
        // missed" is about the board, and a flush completed on the turn is a
        // flush that got there. `runout_any` stays the latest card.
        const missed: Situation = { runout_exclude: ['flush_completing'] };
        expect(matchesSituation(scenario({ runouts: ['brick'], priorRunouts: ['flush_completing'] }), missed)).toBe(false);
        expect(matchesSituation(scenario({ runouts: ['brick'], priorRunouts: ['overcard'] }), missed)).toBe(true);
        expect(matchesSituation(scenario({ runouts: ['brick'], priorRunouts: ['flush_completing'] }), { runout_any: ['brick'] })).toBe(true);
    });

    it('admits at the stated stack-to-pot bracket and refuses at another', () => {
        // Top pair with less than a pot behind is usually all in, and the same
        // hand at a deep stack-to-pot ratio is a medium bet, which is why the
        // bracket has to be matchable at all.
        expect(matchesSituation(scenario({ sprBracket: 'very_low' }), { spr_bracket: ['very_low', 'low'] })).toBe(true);
        expect(matchesSituation(scenario({ sprBracket: 'high' }), { spr_bracket: ['very_low', 'low'] })).toBe(false);
        expect(matchesSituation(scenario({ sprBracket: undefined }), { spr_bracket: ['low'] })).toBe(false);
    });
});
