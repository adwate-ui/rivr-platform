import { describe, it, expect, beforeEach } from 'vitest';
import { HAND_CLASSES, type Situation } from '../ontology/types.ts';
import { THIN_SCENARIO_THRESHOLD } from './index.ts';
import { checkSituation, countDistinctSpots } from './satisfiability.ts';
import { jointRealisability, resetTagCompatibilityCache } from './tagCompatibility.ts';

beforeEach(() => resetTagCompatibilityCache());

describe('stage 4: searching the cards', () => {
    it('searches every postflop street when the rule names none', () => {
        // A full house needs a paired board under a pocket pair or a set, and
        // nothing says which street; the search has to find a board on its own.
        const result = checkSituation({ hand_class_any: ['full_house_plus'] }, { seed: 3, limit: 4000 });
        expect(result.result).toBe('satisfiable');
        expect(result.witness?.board.split(' ').length).toBeGreaterThanOrEqual(3);
    });

    it('refuses a texture only a completed board could carry, on any street', () => {
        // Texture is the flop's on every street, so `flush_complete` is not a
        // spot that can ever be generated — and the answer is a proof, not a
        // search that gave up.
        const result = checkSituation({ street: ['turn', 'river'], board_require: ['flush_complete'] }, { seed: 3 });
        expect(result.result).toBe('unsatisfiable');
        expect(result.attempts).toBe(0);
    });

    it('searches for a hand WITHOUT an excluded draw, and reads the exclusion as needing cards', () => {
        const result = checkSituation(
            { street: 'flop', draw_class_exclude: ['gutshot', 'open_ended', 'flush_draw', 'combo_draw'] },
            { seed: 7 },
        );
        expect(result.result).toBe('satisfiable');
        expect(result.attempts).toBeGreaterThan(0);
    });

    it('searches for a hand that has the demanded draw, not just the demanded board', () => {
        const result = checkSituation({ street: 'flop', draw_class_any: ['flush_draw'] }, { seed: 5 });
        expect(result.result).toBe('satisfiable');
        expect(result.witness).toBeDefined();
    });

    it('rejects a hand whose class is wrong even when the board matches', () => {
        const result = checkSituation(
            { street: 'flop', board_require: ['monotone'], hand_class_any: ['full_house_plus'] },
            { seed: 11, limit: 50 },
        );
        // Monotone flop plus a full house is rare enough that a 50-draw budget
        // will not find one — and the answer is "not found", never "impossible".
        expect(result.result).toBe('not-found');
    });

    it('needs no search for a preflop situation, which has no cards to constrain', () => {
        const result = checkSituation({ street: 'preflop', hero_position: ['BTN'] });
        expect(result.result).toBe('satisfiable');
        expect(result.attempts).toBe(0);
    });

    it('checks satisfiability across every street a rule names', () => {
        expect(checkSituation({ street: ['turn', 'river'], board_require: ['monotone'], hand_class_any: ['flush'] }, { seed: 2 }).result)
            .toBe('satisfiable');
        expect(checkSituation({ street: ['preflop'], board_require: ['monotone'] }).result)
            .toBe('unsatisfiable');
    });
});

describe('the distinct-spot estimate', () => {
    it('counts free slots to estimate how many distinct spots a rule covers', () => {
        expect(countDistinctSpots({})).toBeGreaterThan(THIN_SCENARIO_THRESHOLD);

        const everySlotPinned: Situation = {
            street: 'flop', hero_position: ['BTN'], pot_type: ['single_raised'],
            player_count: ['heads_up'], stack_bracket: ['standard'],
        };
        // Postflop and hand class unstated means every class is still reachable,
        // so this is one spot per class rather than one spot. Scoring the absent
        // case as 1 made pinning the hand look free, which is backwards: a rule
        // that claims every holding covers strictly more than one that names one.
        expect(countDistinctSpots(everySlotPinned)).toBe(HAND_CLASSES.length);
        expect(countDistinctSpots({ ...everySlotPinned, hand_class_any: ['set'] })).toBe(1);
    });

    it('does not multiply a preflop rule by hand classes it cannot have', () => {
        // There is no board preflop, so there is no made hand to classify and
        // the ontology forbids the slot. A preflop rule's variety comes from its
        // range, which this estimate deliberately does not model.
        expect(countDistinctSpots({
            street: 'preflop', hero_position: ['BTN'], pot_type: ['single_raised'],
            player_count: ['heads_up'], stack_bracket: ['standard'],
        })).toBe(1);
    });

    it('counts a multi-street rule as covering more spots than a single-street one', () => {
        expect(countDistinctSpots({ street: ['turn', 'river'] }))
            .toBeGreaterThan(countDistinctSpots({ street: 'turn' }));
    });
});

describe('which board tags can co-occur', () => {
    it('proves an impossible pair impossible — the flop is enumerated, not sampled', () => {
        expect(jointRealisability(['monotone', 'rainbow'])).toBe('impossible');
        expect(jointRealisability(['low', 'high'])).toBe('impossible');
    });

    it('confirms a possible pair', () => {
        expect(jointRealisability(['monotone', 'high'])).toBe('realisable');
        expect(jointRealisability([])).toBe('realisable');
    });

    it('knows a completed flush or straight is no flop texture at all', () => {
        // Texture is the flop's on every street (the generator and the harness
        // tag the flop), so the two tags only a five-card board can carry are
        // unreachable everywhere — and saying so here is what stops a rule
        // demanding one from passing stage 4 and then generating nothing.
        expect(jointRealisability(['flush_complete'])).toBe('impossible');
        expect(jointRealisability(['straight_complete'])).toBe('impossible');
    });

    it('proves tags impossible together on every street, because texture is the flop\'s', () => {
        // Monotone means one suit, which means every rank distinct, so a
        // monotone board can never also be paired — on any street.
        expect(jointRealisability(['monotone', 'paired'])).toBe('impossible');
    });

    it('caches, so a second question costs nothing', () => {
        const first = Date.now();
        jointRealisability(['paired']);
        const cold = Date.now() - first;

        const second = Date.now();
        jointRealisability(['trips']);
        expect(Date.now() - second).toBeLessThanOrEqual(cold);
    });
});
