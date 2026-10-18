import { describe, it, expect } from 'vitest';
import type { Situation } from '../ontology/types.ts';
import {
    SCALAR_SLOTS,
    SLOT_DOMAINS,
    SLOTS_FORBIDDEN_BY_STREET,
    allowedValues,
    situationConflicts,
} from './slots.ts';

/**
 * The coordinates a scenario has.
 *
 * Most of these tests are about situations that contradict THE GAME rather than
 * themselves — a preflop rule asking for a monotone board, a river rule asking
 * for a flush draw. Those pass schema validation cleanly and then generate
 * nothing forever, which is the failure mode stage 4 exists to catch and this
 * is where it is actually detected.
 */

describe('slot domains', () => {
    it('gives every scalar slot a non-empty domain', () => {
        SCALAR_SLOTS.forEach((slot) => {
            expect(SLOT_DOMAINS[slot].length).toBeGreaterThan(0);
        });
    });

    it('treats an omitted slot as the whole domain', () => {
        expect(allowedValues({}, 'hero_position')).toEqual(SLOT_DOMAINS.hero_position);
    });

    it('intersects a constraint with the domain', () => {
        expect(allowedValues({ hero_position: ['BTN', 'CO'] }, 'hero_position')).toEqual(['CO', 'BTN']);
    });
});

describe('a situation that contradicts itself', () => {
    it('is fine when it constrains nothing', () => {
        expect(situationConflicts({})).toEqual([]);
    });

    it('flags a slot constrained to an empty list', () => {
        const conflicts = situationConflicts({ hero_position: [] });
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]?.slot).toBe('hero_position');
    });

    it('flags a tag that is both required and excluded', () => {
        const conflicts = situationConflicts({ board_require: ['paired'], board_exclude: ['paired'] });
        expect(conflicts.some((c) => c.reason.includes('both required and excluded'))).toBe(true);
    });

    it('flags a runout whose every allowed tag is also excluded — it admits no turn card', () => {
        const conflicts = situationConflicts({
            street: ['turn'],
            runout_any: ['brick', 'overcard'],
            runout_exclude: ['brick', 'overcard', 'flush_completing'],
        });
        expect(conflicts.some((c) => c.slot === 'runout_any' && c.reason.includes('also excluded'))).toBe(true);
    });

    it('does not flag a runout with an allowed tag left over', () => {
        const conflicts = situationConflicts({
            street: ['turn'],
            runout_any: ['brick', 'overcard'],
            runout_exclude: ['overcard'],
        });
        expect(conflicts.some((c) => c.slot === 'runout_any')).toBe(false);
    });

    it('flags an empty set-valued constraint', () => {
        expect(situationConflicts({ hand_class_any: [] })).toHaveLength(1);
    });

    it('flags a value that is not in the slot domain at all', () => {
        // The schema catches this first in a normal import, so this is the
        // belt-and-braces case: `situationConflicts` is public and must not
        // report a nonsense position as merely satisfiable.
        const nonsense: Situation = JSON.parse('{ "hero_position": ["MIDDLE"] }');
        const conflicts = situationConflicts(nonsense);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]?.reason).toContain('is a legal hero_position');
    });

    it('reports every conflict at once rather than stopping at the first', () => {
        const conflicts = situationConflicts({ hero_position: [], pot_type: [], stack_bracket: [] });
        expect(conflicts).toHaveLength(3);
    });
});

describe('a situation that contradicts the game', () => {
    it('refuses a board on a preflop decision', () => {
        const situation: Situation = { street: 'preflop', board_require: ['monotone'] };
        expect(situationConflicts(situation).some((c) => c.slot === 'board_require')).toBe(true);
    });

    it('refuses a hand class before any cards are shared', () => {
        const conflicts = situationConflicts({ street: 'preflop', hand_class_any: ['top_pair_good_kicker'] });
        expect(conflicts.some((c) => c.slot === 'hand_class_any')).toBe(true);
    });

    it('refuses a preflop facing state after the flop', () => {
        expect(situationConflicts({ street: 'flop', preflop_facing_state: ['unopened'] })
            .some((c) => c.slot === 'preflop_facing_state')).toBe(true);
    });

    it('refuses a runout on the flop, where three cards arrive at once', () => {
        expect(situationConflicts({ street: 'flop', runout_any: ['brick'] })
            .some((c) => c.slot === 'runout_any')).toBe(true);
    });

    it('allows a runout on the turn and the river', () => {
        expect(situationConflicts({ street: 'turn', runout_any: ['brick'] })).toEqual([]);
        expect(situationConflicts({ street: 'river', runout_any: ['brick'] })).toEqual([]);
    });

    it('refuses a completed flush or straight before the river', () => {
        expect(situationConflicts({ street: 'flop', board_require: ['flush_complete'] })
            .some((c) => c.reason.includes('needs the river'))).toBe(true);
        expect(situationConflicts({ street: 'turn', board_require: ['straight_complete'] })
            .some((c) => c.reason.includes('needs the river'))).toBe(true);
        expect(situationConflicts({ street: 'river', board_require: ['flush_complete'] })).toEqual([]);
    });

    it('refuses a draw on the river, because no card follows it', () => {
        expect(situationConflicts({ street: 'river', draw_class_any: ['flush_draw'] })
            .some((c) => c.slot === 'draw_class_any')).toBe(true);
    });

    it('allows draw_class none on the river', () => {
        expect(situationConflicts({ street: 'river', draw_class_any: ['none'] })).toEqual([]);
    });

    it('says nothing about street-specific slots when no street is named', () => {
        expect(situationConflicts({ board_require: ['monotone'], preflop_facing_state: ['unopened'] })).toEqual([]);
    });

    it('lists the forbidden slots for every street', () => {
        (['preflop', 'flop', 'turn', 'river'] as const).forEach((street) => {
            expect(SLOTS_FORBIDDEN_BY_STREET[street]).toBeDefined();
        });
    });
});
