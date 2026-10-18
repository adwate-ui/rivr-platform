import { describe, it, expect } from 'vitest';
import type { OntologyPayload, Principle } from '../ontology/types.ts';
import { inScope, describeScope, activeFacets, gameTexturesOf, DUE_SCOPE, SESSION_LENGTHS } from './scope.ts';

/**
 * Choosing what to drill.
 *
 * The queue was the whole answer before this — FSRS decided and the reader had
 * no say, not even a filter. That is the right default and the wrong cage:
 * somebody who has just read the board-texture chapter wants board texture now,
 * not in four days.
 *
 * Two properties carry this file. A scope narrows the POOL and never reorders
 * it, so due-ness still decides what comes first. And the facets COMBINE — it
 * was one mode and one value, which made every choice exclusive and "the
 * barrelling chapter, on the turn" inexpressible.
 */

const principle = (over: Partial<Principle> = {}): Principle => ({
    id: 'pr_1',
    source_id: 'src',
    name: 'A principle',
    rule: { kind: 'predicate', situation: { street: ['flop'] }, branches: [], default: { action: 'check' } },
    rationale: 'Because.',
    feedback: { correct: 'Right.' },
    ...over,
});

const ruleFor = (situation: Principle['rule']['situation']): Partial<Principle> => ({
    rule: { kind: 'predicate', situation, branches: [], default: { action: 'check' } },
});

describe('the default scope', () => {
    it('admits everything, so the hub can count the whole pool', () => {
        expect(inScope(principle(), DUE_SCOPE, [])).toBe(true);
        expect(activeFacets(DUE_SCOPE)).toBe(0);
    });

    it('admits everything when a facet is present but empty', () => {
        // Clearing the last chapter off a filter must not leave a scope that
        // matches nothing at all.
        expect(inScope(principle(), { units: [], streets: [], stakes: [] }, [])).toBe(true);
    });

    it('offers an open-ended length as well as fixed ones', () => {
        expect(SESSION_LENGTHS).toContain(null);
        expect(SESSION_LENGTHS.filter((n) => typeof n === 'number').length).toBeGreaterThan(1);
    });
});

describe('by chapter', () => {
    it('keeps only the principles of the chosen units', () => {
        const scope = { units: ['unit_texture'] };
        expect(inScope(principle({ source_unit_id: 'unit_texture' }), scope, [])).toBe(true);
        expect(inScope(principle({ source_unit_id: 'unit_barrels' }), scope, [])).toBe(false);
        expect(inScope(principle(), scope, [])).toBe(false);
    });

    it('takes several chapters at once', () => {
        const scope = { units: ['unit_value', 'unit_texture'] };
        expect(inScope(principle({ source_unit_id: 'unit_value' }), scope, [])).toBe(true);
        expect(inScope(principle({ source_unit_id: 'unit_texture' }), scope, [])).toBe(true);
    });
});

describe('by street', () => {
    const flopOnly = { streets: ['flop' as const] };

    it('keeps a rule scoped to that street', () => {
        expect(inScope(principle(), flopOnly, [])).toBe(true);
    });

    it('drops a rule that plays on other streets only', () => {
        expect(inScope(principle(ruleFor({ street: ['river'] })), flopOnly, [])).toBe(false);
    });

    it('keeps an unscoped rule, which plays everywhere', () => {
        // The same reading the matcher gives an omitted coordinate everywhere
        // else: silence is unconstrained, not excluded.
        expect(inScope(principle(ruleFor({})), flopOnly, [])).toBe(true);
    });

    it('unions the streets chosen', () => {
        const late = { streets: ['turn' as const, 'river' as const] };
        expect(inScope(principle(ruleFor({ street: ['river'] })), late, [])).toBe(true);
        expect(inScope(principle(ruleFor({ street: ['flop'] })), late, [])).toBe(false);
    });
});

describe('by stakes', () => {
    const bigGame = { stakes: ['5/10' as const] };

    it('keeps a rule the source wrote for that game', () => {
        expect(inScope(principle(ruleFor({ street: ['flop'], stakes: ['2/5', '5/10'] })), bigGame, []))
            .toBe(true);
    });

    it('drops a rule written for a different game', () => {
        expect(inScope(principle(ruleFor({ street: ['flop'], stakes: ['1/2'] })), bigGame, []))
            .toBe(false);
    });
});

describe('by leak', () => {
    it('keeps only what the analytics called weak', () => {
        const scope = { leaksOnly: true };
        expect(inScope(principle({ id: 'pr_weak' }), scope, ['pr_weak'])).toBe(true);
        expect(inScope(principle({ id: 'pr_fine' }), scope, ['pr_weak'])).toBe(false);
    });
});

/**
 * The reason the model changed.
 *
 * One mode and one value made every choice exclusive: turn spots at 5-10, or
 * the chapter you just read at any stakes, never both.
 */
describe('facets combining', () => {
    const turnAtFive = { streets: ['turn' as const], stakes: ['5/10' as const] };

    it('requires every facet, not any of them', () => {
        expect(inScope(principle(ruleFor({ street: ['turn'], stakes: ['5/10'] })), turnAtFive, []))
            .toBe(true);
        expect(inScope(principle(ruleFor({ street: ['turn'], stakes: ['1/2'] })), turnAtFive, []))
            .toBe(false);
        expect(inScope(principle(ruleFor({ street: ['flop'], stakes: ['5/10'] })), turnAtFive, []))
            .toBe(false);
    });

    it('counts what is narrowing, for the panel to say so', () => {
        expect(activeFacets(turnAtFive)).toBe(2);
        expect(activeFacets({ units: ['a', 'b'], leaksOnly: true })).toBe(3);
        expect(activeFacets({ game: 'loose_passive' })).toBe(1);
    });

    it('does not narrow the pool by the game — the texture changes answers, not membership', () => {
        const anyRule = principle(ruleFor({ street: ['flop'] }));
        expect(inScope(anyRule, { game: 'loose_passive' }, [])).toBe(true);
    });

    it('offers only the textures the source\'s modifiers answer to', () => {
        const payload: OntologyPayload = {
            ontology_version: '1.7', source: { id: 's', title: 't', kind: 'book' },
            opponent_types: [], range_sets: [],
            principles: [
                principle(ruleFor({ street: ['flop'] })),
                {
                    ...principle(ruleFor({ street: ['flop'] })),
                    id: 'm',
                    modifiers: [
                        { id: 'x', when: { game_texture: 'loose_passive' }, effect: { substitute_outcome: { action: 'bet' } } },
                        { id: 'y', when: { stack_bracket: ['deep'] }, effect: { substitute_outcome: { action: 'bet' } } },
                    ],
                },
            ],
        };
        expect(gameTexturesOf(payload)).toEqual(['loose_passive']);
    });
});

describe('saying what was chosen', () => {
    const label = (id: string) => (id === 'unit_texture' ? 'Part 3: Reading the flop' : undefined);

    it('uses the source\'s own chapter name', () => {
        expect(describeScope({ units: ['unit_texture'] }, label))
            .toBe('Part 3: Reading the flop');
    });

    it('falls back to the id when a unit has gone missing', () => {
        expect(describeScope({ units: ['unit_gone'] }, label)).toBe('unit_gone');
    });

    it('says everything-due when nothing narrows', () => {
        expect(describeScope(DUE_SCOPE, label)).toBe('Everything due');
        expect(describeScope({ streets: [], stakes: [] }, label)).toBe('Everything due');
    });

    it('names every facet that is on', () => {
        expect(describeScope({ streets: ['turn'] }, label)).toBe('Turn');
        expect(describeScope({ stakes: ['2/5'] }, label)).toBe('2/5 games');
        expect(describeScope({ leaksOnly: true }, label)).toBe('your leaks');
        expect(describeScope({ streets: ['turn', 'river'], stakes: ['5/10'] }, label))
            .toBe('Turn & River · 5/10 games');
        expect(describeScope({ game: 'loose_passive' }, label)).toBe('loose and passive table');
    });
});
