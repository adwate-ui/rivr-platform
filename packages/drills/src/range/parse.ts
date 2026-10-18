/**
 * Standard range notation, parsed.
 *
 * ```
 * range   := token (',' token)*
 * token   := pair | suited | offsuit | any | plus | span
 * pair    := R R            "77"
 * suited  := R R 's'        "AKs"
 * offsuit := R R 'o'        "AKo"
 * any     := R R            "AK"      -> suited union offsuit
 * plus    := token '+'      "77+", "A5s+"
 * span    := token '-' token "ATs-A7s"
 * ```
 *
 * Two conventions that hand-written parsers usually get wrong, fixed here and
 * written down so they stay fixed:
 *
 * **`+` on a pair walks the PAIR up**: `77+` is 77 through AA. **`+` on
 * anything else fixes the high card and walks the KICKER up**: `A5s+` is A5s
 * through AKs, not "every suited ace above the five". The two readings differ
 * on almost every range a source will contain.
 *
 * **`-` is a span, and its endpoints must be the same shape**: `ATs-A7s` walks
 * the kicker, `99-66` walks the pair. `ATs-KQs` is not a range, it is a typo,
 * and it is reported as one rather than silently interpreted.
 */

import { RANKS, RANK_VALUE, isRankCode, type RankCode } from '../cards/cards.ts';
import {
    cellCombos,
    emptyCombos,
    unionCombos,
    type ComboSet,
} from './comboSet.ts';

/** A two-rank hand that is not a pair: the shape a kicker or diagonal ladder walks. */
type LadderToken = { kind: 'suited' | 'offsuit' | 'any'; hi: RankCode; lo: RankCode };

/** A token with no `+` and no `-`. */
type SimpleToken = { kind: 'pair'; rank: RankCode } | LadderToken;

export type RangeToken =
    | { kind: 'pair'; rank: RankCode }
    | { kind: 'suited'; hi: RankCode; lo: RankCode }
    | { kind: 'offsuit'; hi: RankCode; lo: RankCode }
    | { kind: 'any'; hi: RankCode; lo: RankCode }
    | { kind: 'plus'; base: RangeToken }
    | { kind: 'span'; from: RangeToken; to: RangeToken };

export class RangeParseError extends Error {
    constructor(readonly token: string, readonly reason: string) {
        super(`Cannot parse range token "${token}": ${reason}`);
        this.name = 'RangeParseError';
    }
}

/** The two ranks of a bare token, high first. */
function readRanks(text: string, whole: string): [RankCode, RankCode] {
    const first = text.charAt(0).toUpperCase();
    const second = text.charAt(1).toUpperCase();
    if (!isRankCode(first) || !isRankCode(second)) {
        throw new RangeParseError(whole, `"${text}" contains a rank that does not exist`);
    }
    return RANK_VALUE[first] >= RANK_VALUE[second] ? [first, second] : [second, first];
}

/** The optional suitedness marker of a bare token: '', 's' or 'o'. */
function readForm(text: string, whole: string): '' | 's' | 'o' {
    const form = text.charAt(2).toLowerCase();
    if (form === '' || form === 's' || form === 'o') return form;
    throw new RangeParseError(whole, `"${text.charAt(2)}" is not a suitedness marker`);
}

/** A bare token: two ranks and an optional s/o. No `+`, no `-`. */
function parseSimple(text: string, whole: string): SimpleToken {
    if (text.length < 2 || text.length > 3) {
        throw new RangeParseError(whole, `"${text}" is not two ranks with an optional s or o`);
    }
    const [hi, lo] = readRanks(text, whole);
    const form = readForm(text, whole);

    if (hi === lo) {
        if (form !== '') throw new RangeParseError(whole, 'a pair cannot be suited or offsuit');
        return { kind: 'pair', rank: hi };
    }
    if (form === 's') return { kind: 'suited', hi, lo };
    if (form === 'o') return { kind: 'offsuit', hi, lo };
    return { kind: 'any', hi, lo };
}

/** Both endpoints of a span must be the same shape, and a non-pair span must be a ladder. */
function checkSpanEnds(from: SimpleToken, to: SimpleToken, text: string): void {
    if (from.kind !== to.kind) {
        throw new RangeParseError(text, `endpoints disagree: ${from.kind} against ${to.kind}`);
    }
    if (from.kind === 'pair' || to.kind === 'pair') return;
    // Two legal shapes for a non-pair span, and both are in common use:
    //
    //   ATs-A7s   same high card, walk the KICKER      (A-T, A-9, A-8, A-7)
    //   JTs-76s   same gap, walk the DIAGONAL          (JT, T9, 98, 87, 76)
    //
    // The diagonal form is how sources write suited connectors and gappers, so
    // refusing it means refusing most real preflop ranges.
    const sameHigh = from.hi === to.hi;
    const sameGap = RANK_VALUE[from.hi] - RANK_VALUE[from.lo] === RANK_VALUE[to.hi] - RANK_VALUE[to.lo];
    if (!sameHigh && !sameGap) {
        throw new RangeParseError(
            text,
            `endpoints share neither a high card (${from.hi}, ${to.hi}) nor a gap, so there is no ladder between them`,
        );
    }
}

function parseSpan(trimmed: string, text: string): RangeToken {
    const parts = trimmed.split('-');
    const [left, right] = parts;
    if (parts.length !== 2 || left === undefined || right === undefined) {
        throw new RangeParseError(text, 'a span has exactly two endpoints');
    }
    const from = parseSimple(left, text);
    const to = parseSimple(right, text);
    checkSpanEnds(from, to, text);
    return { kind: 'span', from, to };
}

/** One token of range notation, parsed and checked. */
export function parseRangeToken(text: string): RangeToken {
    const trimmed = text.trim();
    if (trimmed === '') throw new RangeParseError(text, 'empty token');
    if (trimmed.includes('-')) return parseSpan(trimmed, text);
    if (trimmed.endsWith('+')) {
        return { kind: 'plus', base: parseSimple(trimmed.slice(0, -1), text) };
    }
    return parseSimple(trimmed, text);
}

/** The 169-grid cells a simple token covers. */
function simpleCells(token: SimpleToken): ComboSet {
    switch (token.kind) {
        case 'pair':
            return cellCombos(token.rank, token.rank, 'pair');
        case 'suited':
            return cellCombos(token.hi, token.lo, 'suited');
        case 'offsuit':
            return cellCombos(token.hi, token.lo, 'offsuit');
        case 'any':
            return unionCombos(cellCombos(token.hi, token.lo, 'suited'), cellCombos(token.hi, token.lo, 'offsuit'));
    }
}

const unionAll = (sets: readonly ComboSet[]): ComboSet => sets.reduce(unionCombos, emptyCombos());

/** Ranks from `from` up to `to` inclusive, walking up the rank ladder. */
function ranksBetween(from: RankCode, to: RankCode): RankCode[] {
    const low = Math.min(RANK_VALUE[from], RANK_VALUE[to]);
    const high = Math.max(RANK_VALUE[from], RANK_VALUE[to]);
    return RANKS.filter((rank) => RANK_VALUE[rank] >= low && RANK_VALUE[rank] <= high);
}

const pairsBetween = (from: RankCode, to: RankCode): ComboSet =>
    unionAll(ranksBetween(from, to).map((rank) => simpleCells({ kind: 'pair', rank })));

function plusCombos(base: RangeToken): ComboSet {
    if (base.kind === 'pair') return pairsBetween(base.rank, 'A');
    if (base.kind === 'plus' || base.kind === 'span') {
        throw new RangeParseError(`${base.kind}+`, '+ applies to a single hand, not to a range');
    }
    // Fix the high card; walk the kicker up to one below it.
    const ladder = RANKS.filter(
        (rank) => RANK_VALUE[rank] >= RANK_VALUE[base.lo] && RANK_VALUE[rank] < RANK_VALUE[base.hi],
    );
    return unionAll(ladder.map((lo) => simpleCells({ ...base, lo })));
}

const isLadder = (token: RangeToken): token is LadderToken =>
    token.kind === 'suited' || token.kind === 'offsuit' || token.kind === 'any';

/** The rank `gap` steps below `index` in the descending rank list. */
function rankBelow(index: number, gap: number): RankCode {
    const rank = RANKS[index + gap];
    if (rank === undefined) throw new RangeError(`No rank ${gap} below position ${index}`);
    return rank;
}

/** A non-pair span whose endpoints share a gap: both ranks step down together. */
function diagonalCombos(lowEnd: LadderToken, highEnd: LadderToken): ComboSet {
    const gap = RANK_VALUE[lowEnd.hi] - RANK_VALUE[lowEnd.lo];
    const topValue = Math.max(RANK_VALUE[lowEnd.hi], RANK_VALUE[highEnd.hi]);
    const bottomValue = Math.min(RANK_VALUE[lowEnd.hi], RANK_VALUE[highEnd.hi]);
    // RANKS is descending, so the rank `gap` lower in value sits `gap` places
    // further along. Index arithmetic rather than a search: the endpoints share
    // the gap, so the bottom of the walk is the lower endpoint itself and can
    // never fall off the deck.
    return unionAll(RANKS
        .map((rank, index) => ({ rank, index }))
        .filter(({ rank }) => RANK_VALUE[rank] >= bottomValue && RANK_VALUE[rank] <= topValue)
        .map(({ rank, index }) => simpleCells({ ...lowEnd, hi: rank, lo: rankBelow(index, gap) })));
}

function spanCombos(from: RangeToken, to: RangeToken): ComboSet {
    if (from.kind === 'pair' && to.kind === 'pair') return pairsBetween(from.rank, to.rank);
    if (!isLadder(from) || !isLadder(to)) {
        throw new RangeParseError(`${from.kind}-${to.kind}`, 'a span joins two hands of the same shape');
    }
    // Same high card: walk the kicker between the two low cards.
    if (from.hi === to.hi) {
        return unionAll(ranksBetween(from.lo, to.lo).map((lo) => simpleCells({ ...from, lo })));
    }
    return diagonalCombos(from, to);
}

/** Every combination a parsed token covers. */
export function tokenToCombos(token: RangeToken): ComboSet {
    if (token.kind === 'plus') return plusCombos(token.base);
    if (token.kind === 'span') return spanCombos(token.from, token.to);
    return simpleCells(token);
}

/** One token, or several separated by commas. */
export function parseRangeNotation(notation: string): ComboSet {
    return unionAll(notation
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map((part) => tokenToCombos(parseRangeToken(part))));
}

/** Every listed hand, unioned. The shape a `range_set.hands` array takes. */
export function parseHands(hands: readonly string[]): ComboSet {
    return unionAll(hands.map((hand) => tokenToCombos(parseRangeToken(hand))));
}
