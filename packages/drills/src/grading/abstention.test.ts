import { describe, it, expect } from 'vitest';
import type { Outcome, Principle } from '../ontology/types.ts';
import { expandRangeSets } from '../range/expand.ts';
import { rankCandidates, governingPrinciple } from './arbitrate.ts';
import { resolveOutcome, abstainsOn } from './resolve.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { context, principle, scenario } from './fixtures.ts';

describe('a rule that declines to answer', () => {
    /**
     * Ontology 1.3 made `default` optional.
     *
     * When it was mandatory, every rule had to answer every spot its situation
     * admitted — so a rule whose scope was too wide came back with a WRONG
     * ANSWER rather than a gap, and most predicate rules ended up defaulting to
     * check or fold. Abstention is what separates "this rule is wrong" from
     * "this rule should never have been asked".
     */
    const abstaining = principle({
        id: 'abstains',
        rule: {
            kind: 'predicate',
            situation: { street: 'flop' },
            branches: [{ when: { hand_class_any: ['set'] }, then: { action: 'bet', sizing: 'large' } }],
        },
    });

    it('returns nothing when no branch matches and there is no default', () => {
        // The scenario is top pair, so the set branch does not fire.
        expect(resolveOutcome(abstaining, scenario(), context())).toBeNull();
        expect(abstainsOn(abstaining, scenario())).toBe(true);
    });

    it('still answers where a branch does match', () => {
        const spot = scenario({ handClass: 'set' });
        expect(resolveOutcome(abstaining, spot, context())?.outcome.action).toBe('bet');
        expect(abstainsOn(abstaining, spot)).toBe(false);
    });

    it('never abstains when a default is present', () => {
        expect(abstainsOn(principle(), scenario({ handClass: 'no_pair' }))).toBe(false);
        expect(resolveOutcome(principle(), scenario({ handClass: 'no_pair' }), context())?.provenance.kind)
            .toBe('default');
    });

    it('is overridden by an exception, which runs before the branches', () => {
        const withException = principle({
            rule: abstaining.rule,
            exceptions: [{ when: { hand_class_any: ['top_pair_good_kicker'] }, then: { action: 'fold' } }],
        });
        expect(abstainsOn(withException, scenario())).toBe(false);
        expect(resolveOutcome(withException, scenario(), context())?.outcome.action).toBe('fold');
    });

    it('is overridden by a modifier that substitutes an outcome', () => {
        const withModifier = principle({
            rule: abstaining.rule,
            modifiers: [{
                id: 'm1',
                when: { stack_bracket: ['standard'] },
                effect: { substitute_outcome: { action: 'raise', sizing: 'large' } },
            }],
        });
        expect(abstainsOn(withModifier, scenario())).toBe(false);
    });

    it('never abstains on a range lookup, which always has both answers', () => {
        expect(abstainsOn(principle({
            rule: {
                kind: 'range_lookup',
                situation: { street: 'preflop' },
                range_set_id: 'rs',
                in_range: { action: 'raise' },
                out_of_range: { action: 'fold' },
            },
        }), scenario())).toBe(false);
    });

    it('keeps an abstaining principle out of the candidates entirely', () => {
        // This is what makes abstention a SCOPE mechanism rather than a third
        // outcome: the spot passes to the next principle, or to nobody.
        expect(rankCandidates(scenario(), [abstaining])).toEqual([]);
        expect(governingPrinciple(scenario(), [abstaining])).toBeNull();

        const answering = principle({ id: 'answers' });
        expect(governingPrinciple(scenario(), [abstaining, answering])?.id).toBe('answers');
    });

    it('lets a wider rule govern when the narrower one abstains', () => {
        // The narrow rule would win on specificity, but it has nothing to say
        // here — so the wide one answers rather than the spot going unclaimed.
        const narrow = principle({
            id: 'narrow',
            rule: {
                kind: 'predicate',
                situation: { street: 'flop', hero_position: ['BTN'], pot_type: ['single_raised'] },
                branches: [{ when: { hand_class_any: ['set'] }, then: { action: 'bet' } }],
            },
        });
        const wide = principle({ id: 'wide' });
        expect(governingPrinciple(scenario(), [narrow, wide])?.id).toBe('wide');
        expect(governingPrinciple(scenario({ handClass: 'set' }), [narrow, wide])?.id).toBe('narrow');
    });
});

describe('a range lookup that abstains (ontology 1.5)', () => {
    /**
     * A source may say what to do with the hands outside a range (fold them) and
     * say nothing about the hands inside it. A mandatory in_range answer would
     * make the encoder invent one, and the rule would end up folding aces.
     */
    const lookup = (sides: Partial<{ in_range: Outcome; out_of_range: Outcome }>): Principle => ({
        id: 'pr_lookup',
        source_id: 'src',
        name: 'Lookup',
        rule: {
            kind: 'range_lookup',
            situation: { street: 'preflop' },
            range_set_id: 'rs',
            ...sides,
        },
        rationale: 'Synthetic fixture.',
        feedback: { correct: 'x', too_loose: 'x' },
    });
    const ranges = expandRangeSets([{ id: 'rs', hands: ['AA'] }]);
    const spot = (first: string, second: string) => scenario({
        street: 'preflop',
        board: [],
        hole: [card(first), card(second)],
        holder: 'hero',
    });

    it('abstains on the side the source never answered', () => {
        const premiumOnly = lookup({ out_of_range: { action: 'fold' } });
        expect(resolveOutcome(premiumOnly, spot('Ah', 'Ad'), { ranges })).toBeNull();
        expect(resolveOutcome(premiumOnly, spot('7h', '2d'), { ranges })?.outcome.action).toBe('fold');
    });

    it('still answers the side it has', () => {
        const inOnly = lookup({ in_range: { action: 'raise' } });
        expect(resolveOutcome(inOnly, spot('Ah', 'Ad'), { ranges })?.outcome.action).toBe('raise');
        expect(resolveOutcome(inOnly, spot('7h', '2d'), { ranges })).toBeNull();
    });
});
