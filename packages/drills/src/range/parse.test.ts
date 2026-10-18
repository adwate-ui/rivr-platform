import { describe, it, expect } from 'vitest';
import { comboLabel, combosToList, countCombos, equalCombos, intersectCombos } from './comboSet.ts';
import { parseRangeToken, parseRangeNotation, tokenToCombos, RangeParseError } from './parse.ts';

/**
 * Range notation. Counts and labels are the assertions: a mis-parsed range
 * makes every drill generated from it ask about a spot the author never wrote.
 */

const labels = (notation: string): string[] => {
    const seen = new Set<string>();
    combosToList(parseRangeNotation(notation)).forEach(([a, b]) => seen.add(comboLabel(a, b)));
    return [...seen].sort();
};

const count = (notation: string): number => countCombos(parseRangeNotation(notation));

describe('the plus form', () => {
    it('walks a pair upward', () => {
        expect(labels('TT+')).toEqual(['AA', 'JJ', 'KK', 'QQ', 'TT']);
        expect(count('TT+')).toBe(30);
    });

    it('walks the KICKER upward for a non-pair, keeping the high card fixed', () => {
        expect(labels('A5s+')).toEqual(
            ['A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'AJs', 'AQs', 'AKs', 'ATs'].sort(),
        );
        expect(count('A5s+')).toBe(9 * 4);
    });

    it('reaches the card one below the high card, and stops there', () => {
        expect(labels('A5s+')).toContain('AKs');
        expect(labels('A5s+')).not.toContain('AAs');
    });

    it('applies to offsuit and to unspecified suitedness too', () => {
        expect(count('K9o+')).toBe(4 * 12);
        expect(count('K9+')).toBe(4 * 16);
    });

    it('includes only the ace pair for AA+', () => {
        expect(labels('AA+')).toEqual(['AA']);
    });
});

describe('the span form', () => {
    it('walks pairs between the endpoints, in either order', () => {
        expect(labels('77-JJ')).toEqual(['77', '88', '99', 'JJ', 'TT']);
        expect(labels('JJ-77')).toEqual(labels('77-JJ'));
    });

    it('walks the kicker between the endpoints', () => {
        expect(labels('ATs-A7s')).toEqual(['A7s', 'A8s', 'A9s', 'ATs']);
        expect(count('ATs-A7s')).toBe(16);
    });

    it('rejects endpoints of different shapes', () => {
        expect(() => parseRangeToken('ATs-99')).toThrow(RangeParseError);
    });

    it('rejects endpoints with different high cards', () => {
        expect(() => parseRangeToken('ATs-KQs')).toThrow(RangeParseError);
    });

    it('rejects a span with more than two endpoints', () => {
        expect(() => parseRangeToken('ATs-A7s-A5s')).toThrow(RangeParseError);
    });
});

describe('refusing to guess', () => {
    it.each([
        ['', 'empty token'],
        ['A', 'too short'],
        ['AKsx', 'too long'],
        ['ZZ', 'a rank that does not exist'],
        ['AKx', 'not a suitedness marker'],
        ['AAs', 'a pair cannot be suited'],
        ['AAo', 'a pair cannot be offsuit'],
    ])('rejects %s rather than coercing it', (notation) => {
        expect(() => parseRangeToken(notation)).toThrow(RangeParseError);
    });

    it('rejects + applied to something that is already a range', () => {
        expect(() => tokenToCombos({ kind: 'plus', base: parseRangeToken('77+') })).toThrow(RangeParseError);
        expect(() => tokenToCombos({ kind: 'plus', base: parseRangeToken('ATs-A7s') })).toThrow(RangeParseError);
    });
});

describe('parsing a whole list', () => {
    it('unions comma-separated tokens and tolerates whitespace', () => {
        expect(count('AA, KK')).toBe(12);
        expect(count('AA,KK,')).toBe(12);
    });

    it('is order-independent and idempotent', () => {
        expect(equalCombos(parseRangeNotation('AA,KK'), parseRangeNotation('KK,AA'))).toBe(true);
        expect(equalCombos(parseRangeNotation('AA,AA'), parseRangeNotation('AA'))).toBe(true);
    });

    it('normalises the order of the two ranks', () => {
        expect(equalCombos(parseRangeNotation('KAs'), parseRangeNotation('AKs'))).toBe(true);
    });

    it('is empty for an empty list', () => {
        expect(countCombos(parseRangeNotation(''))).toBe(0);
    });
});

describe('monotonicity', () => {
    it('makes a lower plus-threshold contain a higher one', () => {
        const wide = parseRangeNotation('77+');
        const narrow = parseRangeNotation('88+');
        expect(equalCombos(intersectCombos(wide, narrow), narrow)).toBe(true);
        expect(countCombos(wide)).toBeGreaterThan(countCombos(narrow));
    });

    it('makes a suited-kicker threshold behave the same way', () => {
        const wide = parseRangeNotation('A5s+');
        const narrow = parseRangeNotation('ATs+');
        expect(equalCombos(intersectCombos(wide, narrow), narrow)).toBe(true);
    });
});

describe('diagonal spans', () => {
    it('walks suited connectors down the diagonal', () => {
        // JTs-76s is the usual way to write "the suited connectors from JT to
        // 76", and a parser that refused it would refuse most real ranges.
        expect(labels('JTs-76s')).toEqual(['76s', '87s', '98s', 'JTs', 'T9s']);
    });

    it('walks one-gappers and two-gappers the same way', () => {
        expect(labels('J9s-86s')).toEqual(['86s', '97s', 'J9s', 'T8s']);
        expect(labels('T7s-96s')).toEqual(['96s', 'T7s']);
    });

    it('walks an offsuit diagonal', () => {
        expect(labels('JTo-98o')).toEqual(['98o', 'JTo', 'T9o']);
    });

    it('works whichever end is written first', () => {
        expect(labels('76s-JTs')).toEqual(labels('JTs-76s'));
    });

    it('still walks the kicker when the high card is shared', () => {
        expect(labels('ATs-A7s')).toEqual(['A7s', 'A8s', 'A9s', 'ATs']);
    });

    it('rejects endpoints sharing neither a high card nor a gap', () => {
        expect(() => parseRangeToken('ATs-KQs')).toThrow(RangeParseError);
    });

    it('counts the combinations a diagonal covers', () => {
        expect(count('JTs-76s')).toBe(5 * 4);
        expect(count('JTo-98o')).toBe(3 * 12);
    });

    it('walks all the way down to the deuce', () => {
        // 53s is the lowest two-gapper there is; the walk must reach it and stop.
        expect(labels('T8s-53s')).toEqual(['53s', '64s', '75s', '86s', '97s', 'T8s']);
    });
});
