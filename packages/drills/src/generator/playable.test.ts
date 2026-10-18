import { describe, it, expect } from 'vitest';
import type {
    Position, PreflopFacingState, Principle, RangeLookupRule, RangeSet, Rule,
} from '../ontology/types.ts';
import { expandRangeSets } from '../range/expand.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { comboIndex, countCombos, hasCombo, type ComboSet } from '../range/comboSet.ts';
import type { HeroPreflopAction } from './preflopLine.ts';
import { preflopPlayable } from './playable.ts';

/**
 * The hands the source's own preflop rules would have played, per seat.
 *
 * Derived from the encoding rather than authored beside it, so the check is
 * that it reads an encoding's preflop rules back exactly: a seat opens what its
 * opening rule lists, and a hand nobody opens from early position is not dealt
 * to a hero the story shows opening there. The encoding below is invented for
 * this test; its ranges come from no published source.
 */

const RANGE_SETS: RangeSet[] = [
    { id: 'early_open', hands: ['AA-99', 'AKs-AJs', 'KQs', 'AKo-AQo'] },
    {
        id: 'late_open',
        hands: ['AA-55', 'AKs-A2s', 'KQs-K9s', 'QJs-Q9s', 'JTs-J9s', 'T9s', '98s', 'AKo-ATo', 'KQo-KJo', 'QJo'],
    },
    { id: 'blind_open', hands: ['AA-77', 'AKs-ATs', 'KQs', 'AKo-AJo'] },
    { id: 'reraise', hands: ['AA-QQ', 'AKs', 'AKo'] },
    { id: 'flat', hands: ['JJ-77', 'AQs-ATs', 'KQs', 'QJs'] },
];

const principleWith = (id: string, rule: Rule): Principle => ({
    id, source_id: 'src_invented', name: id, rationale: 'r', feedback: { correct: 'c' }, rule,
});

interface RangeRuleSpec {
    readonly seats: Position[];
    readonly facing: PreflopFacingState[];
    readonly rangeSetId: string;
    readonly action: 'raise' | 'call';
}

const rangeRule = (id: string, spec: RangeRuleSpec): Principle => principleWith(id, {
    kind: 'range_lookup',
    situation: { street: ['preflop'], hero_position: spec.seats, preflop_facing_state: spec.facing },
    range_set_id: spec.rangeSetId,
    in_range: { action: spec.action },
    out_of_range: { action: 'fold' },
});

const PRINCIPLES: Principle[] = [
    rangeRule('open_early', { seats: ['UTG', 'UTG1', 'UTG2', 'LJ'], facing: ['unopened'], rangeSetId: 'early_open', action: 'raise' }),
    rangeRule('open_late', { seats: ['CO', 'BTN'], facing: ['unopened'], rangeSetId: 'late_open', action: 'raise' }),
    rangeRule('raise_limpers_from_the_blind', { seats: ['BB'], facing: ['facing_limp'], rangeSetId: 'blind_open', action: 'raise' }),
    rangeRule('reraise_on_the_button', { seats: ['BTN'], facing: ['facing_raise'], rangeSetId: 'reraise', action: 'raise' }),
    rangeRule('flat_on_the_button', { seats: ['BTN'], facing: ['facing_raise'], rangeSetId: 'flat', action: 'call' }),
];

const ranges = expandRangeSets(RANGE_SETS);
const playable = preflopPlayable(PRINCIPLES, ranges);

const combo = (a: string, b: string): number => comboIndex(card(a), card(b));

const rangeOf = (id: string): ComboSet => {
    const set = ranges.get(id);
    if (set === undefined) throw new Error(`no range ${id}`);
    return set;
};

const cell = (seat: Position, action: HeroPreflopAction): ComboSet => {
    const set = playable(seat, action);
    if (set === undefined) throw new Error(`no cell ${seat}:${action}`);
    return set;
};

describe('an encoding with preflop range rules', () => {
    it('opens exactly the seat ranges the encoding states, and no more', () => {
        const early = cell('UTG', 'raise');
        const button = cell('BTN', 'raise');
        expect(early).toEqual(rangeOf('early_open'));
        expect(button).toEqual(rangeOf('late_open'));
        // Counted by hand: six pairs (36), three suited aces (12), KQs (4) and
        // two offsuit aces (24) early; ten pairs (60), twelve suited aces (48),
        // eleven other suited hands (44), four offsuit aces (48) and three
        // offsuit broadways (36) late.
        expect(countCombos(early)).toBe(76);
        expect(countCombos(button)).toBe(236);
        // Aces open from anywhere; Q-4 offsuit opens from nowhere.
        expect(hasCombo(early, combo('Ah', 'As'))).toBe(true);
        expect(hasCombo(early, combo('Qs', '4c'))).toBe(false);
        expect(hasCombo(button, combo('Qs', '4c'))).toBe(false);
        // The button's extra hands are the ones early position folds.
        expect(hasCombo(button, combo('Kh', '9h'))).toBe(true);
        expect(hasCombo(early, combo('Kh', '9h'))).toBe(false);
        // A seat no opening rule names is left free rather than guessed at.
        expect(playable('HJ', 'raise')).toBeUndefined();
    });

    it('separates 3-betting from flatting, and both from opening', () => {
        const threeBet = cell('BTN', '3bet');
        const flat = cell('BTN', 'call');
        // Aces reraise; the flatting list keeps the middle of the range.
        expect(hasCombo(threeBet, combo('Ah', 'As'))).toBe(true);
        expect(hasCombo(flat, combo('Ah', 'As'))).toBe(false);
        expect(hasCombo(flat, combo('8h', '8s'))).toBe(true);
        expect(hasCombo(threeBet, combo('8h', '8s'))).toBe(false);
    });

    it('fills the two cells the encoding never states, from the nearest it does', () => {
        // The encoding gives no small-blind opening range and no limping range,
        // and "no range" used to mean ANY TWO CARDS. Both cells are narrowed to
        // what the source plays from the seat: a weaker claim than the ranges
        // around them, and stated as one in `fillGaps`.
        expect(cell('SB', 'raise')).toEqual(cell('BB', 'raise'));
        const limp = cell('BTN', 'limp');
        expect(limp).toEqual(cell('BTN', 'raise'));
        // 7-2 offsuit is not in it, which is the whole point.
        expect(hasCombo(limp, combo('7h', '2c'))).toBe(false);
    });

    it('leaves the big blind free in a limped pot, and says nothing off the line', () => {
        // The big blind did not limp — they checked their option, and they do
        // that with every hand they are dealt. A filter here would be the same
        // fault pointing the other way.
        expect(playable('BB', 'limp')).toBeUndefined();
        expect(playable('BTN', 'none')).toBeUndefined();
    });
});

describe('reading an encoding', () => {
    const base: RangeLookupRule = {
        kind: 'range_lookup',
        situation: { street: ['preflop'], hero_position: ['CO'], preflop_facing_state: ['unopened'] },
        range_set_id: 'rs',
        in_range: { action: 'raise' },
    };
    const rule = (over: Partial<RangeLookupRule> = {}): Principle => principleWith('p', { ...base, ...over });

    const oneRange = new Map([['rs', rangeOf('late_open')]]);

    it('skips what cannot speak for a seat and an action', () => {
        const concept = { ...rule(), drillable: false };
        expect(preflopPlayable([concept], oneRange)('CO', 'raise')).toBeUndefined();
        // A predicate rule is not a range statement.
        const predicate = principleWith('p', {
            kind: 'predicate', situation: { street: ['preflop'] }, branches: [], default: { action: 'raise' },
        });
        expect(preflopPlayable([predicate], oneRange)('CO', 'raise')).toBeUndefined();
        // A one-sided rule that only folds says nothing about what is played.
        const { in_range: _played, ...foldsOnly } = base;
        const folds = principleWith('p', { ...foldsOnly, out_of_range: { action: 'fold' } });
        expect(preflopPlayable([folds], oneRange)('CO', 'raise')).toBeUndefined();
        // A postflop range rule is not a preflop statement.
        const postflop = rule({ situation: { street: ['flop'], hero_position: ['CO'], preflop_facing_state: ['unopened'] } });
        expect(preflopPlayable([postflop], oneRange)('CO', 'raise')).toBeUndefined();
        // A range id nothing resolves.
        expect(preflopPlayable([rule({ range_set_id: 'nope' })], oneRange)('CO', 'raise')).toBeUndefined();
        // A rule with no facing state claims no (seat, action) cell.
        const noFacing = rule({ situation: { street: ['preflop'], hero_position: ['CO'] } });
        expect(preflopPlayable([noFacing], oneRange)('CO', 'raise')).toBeUndefined();
    });

    it('claims every seat when the rule names none, and every street when it names none', () => {
        const anySeat = rule({ situation: { preflop_facing_state: ['facing_raise'] } });
        const built = preflopPlayable([anySeat], oneRange);
        expect(built('UTG', '3bet')).toBeDefined();
        expect(built('BB', '3bet')).toBeDefined();
        // An in-range CALL facing a raise is the flatting list, not the open.
        const flats = preflopPlayable(
            [rule({ situation: { preflop_facing_state: ['facing_steal'] }, in_range: { action: 'call' } })],
            oneRange,
        );
        expect(flats('CO', 'call')).toBeDefined();
        expect(flats('CO', 'raise')).toBeUndefined();
    });
});
