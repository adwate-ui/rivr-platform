import { describe, it, expect } from 'vitest';
import type { Position } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { seatRoles } from '../handHistory.ts';
import { scenario } from './fixtures.ts';

/**
 * Every seat has a part — in the pot, still to act, or folded — with the
 * opponents numbered.
 */

describe('who is at the table', () => {
    const roles = (over: Partial<Scenario>) => {
        const { roles: r, labels } = seatRoles(scenario(over));
        return { role: (seat: Position) => r.get(seat), label: (seat: Position) => labels[seat] };
    };

    it('preflop, the seats behind the hero have not acted — they hold cards and are not folded', () => {
        // UTG+1 raised, UTG+2 called; the hero is in the lojack. UTG folded
        // (acted before the raiser), the seats after the hero are still to act.
        const table = roles({
            street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState: 'facing_raise_and_call',
            heroPosition: 'LJ', villainPosition: 'UTG1', villainPositions: ['UTG1', 'UTG2'], nodePath: [],
        });
        expect(table.role('UTG')).toBe('folded');
        expect(table.role('UTG1')).toBe('in_pot');
        expect(table.role('UTG2')).toBe('in_pot');
        expect(table.role('LJ')).toBe('hero');
        for (const seat of ['HJ', 'CO', 'BTN', 'SB', 'BB'] as const) expect(table.role(seat)).toBe('yet_to_act');
        // Villain 1 is the raiser; the others follow in seat order.
        expect(table.label('UTG1')).toBe('Villain 1');
        expect(table.label('UTG2')).toBe('Villain 2');
        expect(table.label('HJ')).toBe('Villain 3');
        expect(table.label('BB')).toBe('Villain 7');
        expect(table.label('UTG')).toBe('Folded');
        expect(table.label('LJ')).toBe('You');
    });

    it('facing a 3-bet, the seats between the hero and the 3-bettor folded and the ones after it are still to act', () => {
        const table = roles({
            street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState: 'facing_3bet',
            heroPosition: 'HJ', villainPosition: 'SB', villainPositions: ['SB'], nodePath: ['hero_preflop_raise'],
        });
        expect(table.role('CO')).toBe('folded');
        expect(table.role('BTN')).toBe('folded');
        expect(table.role('SB')).toBe('in_pot');
        expect(table.role('BB')).toBe('yet_to_act');
        expect(table.label('BB')).toBe('Villain 2');
    });

    it('postflop, everyone not in the pot has folded', () => {
        const table = roles({ villainPositions: ['BB', 'BTN'] });
        expect(table.role('BTN')).toBe('in_pot');
        expect(table.role('UTG')).toBe('folded');
        expect(table.role('SB')).toBe('folded');
        expect(table.label('BB')).toBe('Villain 1');
        expect(table.label('BTN')).toBe('Villain 2');
    });

    it('in an unopened pot, everyone behind the hero is still to act and numbered from the first of them', () => {
        const table = roles({
            street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState: 'unopened',
            heroPosition: 'CO', villainPosition: undefined, villainPositions: [], nodePath: [],
        });
        expect(table.role('BTN')).toBe('yet_to_act');
        expect(table.label('BTN')).toBe('Villain 1');
        expect(table.label('BB')).toBe('Villain 3');
        expect(table.role('UTG')).toBe('folded');
    });
});
