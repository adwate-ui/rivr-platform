import { describe, it, expect } from 'vitest';
import type { PredicateRule, Situation } from '../ontology/types.ts';
import { parseHands } from '../range/parse.ts';
import { matchesSituation } from '../grading/match.ts';
import { deriveSeed } from '../prng.ts';
import { generateScenario } from './scenario.ts';
import { postflopRule, preflopRule } from './fixtures.ts';

/**
 * The property that matters: **every scenario the generator produces must
 * satisfy the situation it came from.** The generator and the matcher are two
 * independent readings of the same `situation`, so agreement between them is
 * real evidence; a hand-written example only ever proves the case somebody
 * thought of. The runout cases are where the two once disagreed.
 */

describe('every scenario satisfies the situation it came from', () => {
    const situations: Situation[] = [
        {},
        { hero_position: ['BTN', 'CO'] },
        { pot_type: ['three_bet'], player_count: ['heads_up'] },
        { stack_bracket: ['very_deep'] },
        { board_require: ['paired'] },
        { board_require: ['two_tone'], board_exclude: ['paired'] },
        { hand_class_any: ['top_pair_good_kicker', 'overpair'] },
        { draw_class_any: ['flush_draw', 'open_ended'] },
        { relative_strength_any: ['strong', 'nuts'] },
        { postflop_facing_state: ['facing_check'] },
        { villain_types: ['opp_station'] },
        { street: 'turn', board_require: ['flush_possible'] },
        { street: 'river', hand_class_any: ['two_pair'] },
        // The two that used to fail. A brick is judged WITH the hero's cards
        // by the scenario and was judged without them by the generator, so a
        // turn that paired a hole card was dealt as a brick and then carried
        // `pairs_hero` — no principle matched it and the session crashed.
        { street: 'turn', runout_any: ['brick'] },
        { street: 'river', runout_any: ['brick'], hand_class_any: ['no_pair', 'weak_pair'] },
    ];

    it.each(situations.map((situation) => [JSON.stringify(situation), situation] as const))(
        'holds for %s',
        (_label, situation) => {
            const rule = postflopRule(situation);
            let produced = 0;

            for (let attempt = 0; attempt < 40; attempt += 1) {
                const result = generateScenario(rule, { seed: deriveSeed('prop', attempt) });
                if (!result.ok) continue;
                produced += 1;
                expect(matchesSituation(result.scenario, rule.situation)).toBe(true);
            }

            expect(produced).toBeGreaterThan(0);
        },
    );

    it('holds for preflop lookups against their own range', () => {
        const range = parseHands(['77+', 'AJs+']);
        for (let attempt = 0; attempt < 30; attempt += 1) {
            const result = generateScenario(preflopRule(), { seed: attempt, range });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(matchesSituation(result.scenario, preflopRule().situation)).toBe(true);
            }
        }
    });
});

describe('runout acceptance while generating', () => {
    it('judges a brick with the hero\'s cards, so a turn that pairs the hero is never dealt as one', () => {
        // Over many seeds, no scenario from a brick-scoped rule may carry
        // `pairs_hero` — the exact disagreement that used to crash the session.
        const rule: PredicateRule = {
            kind: 'predicate',
            situation: { street: ['turn', 'river'], runout_any: ['brick'] },
            branches: [],
            default: { action: 'check' },
        };
        let produced = 0;
        for (let attempt = 0; attempt < 120; attempt += 1) {
            const result = generateScenario(rule, { seed: deriveSeed('brick', attempt) });
            if (!result.ok) continue;
            produced += 1;
            expect(result.scenario.runouts).toEqual(['brick']);
            const last = result.scenario.board.at(-1);
            expect(result.scenario.hole.some((card) => card.rank === last?.rank)).toBe(false);
        }
        expect(produced).toBeGreaterThan(60);
    });

    it('only accepts a board whose landed card carries a required tag', () => {
        // Every board this rule accepts must have a turn card that changed
        // nothing — the generator has to reject the boards whose turn card
        // completed something, exactly as the matcher would refuse them.
        const rule: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'turn', runout_any: ['brick'] },
            branches: [],
            default: { action: 'check' },
        };
        for (const seed of [3, 17, 91]) {
            const result = generateScenario(rule, { seed });
            if (!result.ok) continue;
            expect(result.scenario.runouts).toContain('brick');
        }
    });

    it('never deals a hand holding an excluded draw, and can ask for the card that pairs the hero', () => {
        const noRealDraw: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'flop', hand_class_any: ['no_pair'], draw_class_exclude: ['gutshot', 'open_ended', 'flush_draw', 'combo_draw'] },
            branches: [],
            default: { action: 'call' },
        };
        // `pairs_hero` is about the hand, not the board, so the board filter
        // must let it through to the hand stage — before this it refused every
        // board and the rule built nothing.
        const pairsHero: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'river', runout_any: ['pairs_hero'], hand_class_any: ['top_pair_good_kicker', 'top_pair_weak_kicker'] },
            branches: [],
            default: { action: 'check' },
        };
        let built = 0;
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const a = generateScenario(noRealDraw, { seed: deriveSeed('no-real-draw', attempt) });
            if (a.ok) {
                built += 1;
                expect(a.scenario.draws?.some((draw) => noRealDraw.situation.draw_class_exclude?.includes(draw))).toBe(false);
            }
            const b = generateScenario(pairsHero, { seed: deriveSeed('pairs-hero', attempt) });
            if (b.ok) {
                built += 1;
                expect(b.scenario.runouts).toContain('pairs_hero');
                const last = b.scenario.board.at(-1);
                expect(b.scenario.hole.some((card) => card.rank === last?.rank)).toBe(true);
            }
        }
        expect(built).toBeGreaterThan(60);
    });

    it('never deals a card the rule excludes, with or without a required tag beside it', () => {
        // `runout_exclude` alone: any turn but a straight or flush card.
        const exclude: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'turn', runout_exclude: ['straight_completing', 'flush_completing', 'straight_drawing', 'flush_drawing'] },
            branches: [],
            default: { action: 'bet', sizing: 'large' },
        };
        // Both together: a brick that must not pair the hero either.
        const both: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'turn', runout_any: ['brick', 'overcard'], runout_exclude: ['pairs_hero'] },
            branches: [],
            default: { action: 'bet', sizing: 'large' },
        };
        let produced = 0;
        for (let attempt = 0; attempt < 80; attempt += 1) {
            const a = generateScenario(exclude, { seed: deriveSeed('exclude', attempt) });
            if (a.ok) {
                produced += 1;
                expect(a.scenario.runouts?.some((tag) => exclude.situation.runout_exclude?.includes(tag))).toBe(false);
            }
            const b = generateScenario(both, { seed: deriveSeed('both', attempt) });
            if (b.ok) {
                produced += 1;
                expect(b.scenario.runouts).not.toContain('pairs_hero');
                expect(b.scenario.runouts?.some((tag) => tag === 'brick' || tag === 'overcard')).toBe(true);
            }
        }
        expect(produced).toBeGreaterThan(80);
    });

    it('carries the landed card\'s tags on the scenario for the matcher to read', () => {
        const rule = postflopRule({ street: 'river' });
        const result = generateScenario({ ...rule, situation: { street: 'river' } }, { seed: 5 });
        if (result.ok) {
            expect(result.scenario.runouts).toBeDefined();
            expect(result.scenario.runouts?.length).toBeGreaterThan(0);
        }
    });

    it('tags texture from the flop alone, not the full board', () => {
        // "A static flop", "a dynamic flop" — the source's texture vocabulary
        // describes the first three cards; the turn and river are the runout's
        // news. A rule requiring a low flop must accept K-high runouts.
        const rule: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'river', board_require: ['low'] },
            branches: [],
            default: { action: 'check' },
        };
        const result = generateScenario(rule, { seed: 11, boardAttemptLimit: 4000 });
        if (result.ok) {
            const flopHigh = Math.max(...result.scenario.board.slice(0, 3)
                .map((card) => '23456789TJQKA'.indexOf(card.rank) + 2));
            expect(flopHigh).toBeLessThanOrEqual(8);
        }
    });
});

describe('a runout constraint on a street with no runout', () => {
    it('finds no board, because three cards arrive at once', () => {
        // Stage 4 authoring checks forbid this; the generator still has to
        // refuse rather than misbehave when a multi-street rule samples its
        // flop leg.
        const rule: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'flop', runout_any: ['brick'] },
            branches: [],
            default: { action: 'check' },
        };
        const result = generateScenario(rule, { seed: 2, boardAttemptLimit: 10 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('board-not-found');
    });
});
