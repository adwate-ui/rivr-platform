/**
 * The amounts a hand history prints, from the generator's pot model.
 *
 * The generator has no betting history in money, only the shape of the pot: a
 * flop pot per pot type and field size, multiplied by 2.5 for every earlier
 * street that was bet and called (`potBbAt` in `generator/potAndStack.ts`). The
 * history walks the same model forward, so the amounts on screen agree with
 * the pot in the middle and with the SPR bracket the rule read.
 */
import type { Position, Street, VillainRaiseSize } from '../ontology/types.ts';
import { STREETS } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import type { Bets, HistoryRow } from './types.ts';

/** A bet is about three-quarters of the pot in front of it: pot + 2 × 0.75 pot = 2.5 pot, the generator's street factor. */
export const BET_FRACTION = 0.75;

/** A street that was bet and called grows the pot by this factor, as in the generator. */
export const STREET_GROWTH = 2.5;

/**
 * What a bucketed bet is, as a fraction of the pot — the middle of each of the
 * default bet-size brackets (small ≤ 50%, standard 51–64%, large ≥ 65%).
 * `all_in` is the stack.
 */
export const BUCKET_FRACTION: Readonly<Record<Exclude<VillainRaiseSize, 'all_in'>, number>> = {
    small: 0.4,
    standard: 0.6,
    large: 0.85,
};

/**
 * A raise as a multiple of the bet it raises — under 2.5× is small, 3× and up
 * is large, with an ordinary raise between. A raise used to be sized like a
 * BET, a fraction of the pot, which produced "raises to 14" over a bet of 18 —
 * a raise smaller than the bet it answers.
 */
export const RAISE_MULTIPLE: Readonly<Record<Exclude<VillainRaiseSize, 'all_in'>, number>> = {
    small: 2,
    standard: 2.75,
    large: 3.5,
};

/** A preflop raise, in blinds, by bucket — the default raise brackets (2.5× / 4×) with an ordinary open in the middle. */
const RAISE_TO_BB: Readonly<Record<VillainRaiseSize, number>> = {
    small: 2.5,
    standard: 3,
    large: 5,
    all_in: 0,
};
export const OPEN_BB = 3;
export const THREE_BET_BB = 9;
export const FOUR_BET_BB = 22;

/** What the opponent raised to preflop, by the size bucket the spot states. */
export const preflopRaiseTo = (scenario: Scenario): number => RAISE_TO_BB[scenario.villainRaiseSize ?? 'standard'] || OPEN_BB;

/**
 * The small blind in big blinds, read off the stakes: "2/5" posts 0.4bb, not
 * half a blind — two of five, which is what that table actually takes. Half a
 * blind only where the spot states no stakes at all.
 */
export function smallBlindBb(stakes: string | undefined): number {
    if (stakes === undefined) return 0.5;
    const [small, big] = stakes.split('/').map(Number);
    if (small === undefined || big === undefined) return 0.5;
    return Number.isFinite(small) && Number.isFinite(big) && big > 0 ? small / big : 0.5;
}

/** The two blinds, posted. */
export const blindsOf = (scenario: Scenario): Readonly<Bets> => ({ SB: smallBlindBb(scenario.stakes), BB: 1 });

/** An amount rounded to whole blinds, never below one. */
export const roundBb = (bb: number): number => Math.max(1, Math.round(bb));

/** What each seat has in front of it, read off the rows of one street. A row with no seat puts chips in front of nobody. */
export function betsFrom(rows: readonly HistoryRow[], street: Street): Bets {
    const bets: Bets = {};
    for (const row of rows) {
        if (row.street !== street || row.amountBb === undefined || row.seat === undefined) continue;
        bets[row.seat] = row.amountBb;
    }
    return bets;
}

/** Everything in front of the players, in blinds. */
export const sumBets = (bets: Readonly<Bets>): number =>
    Object.values(bets).reduce((total, bet) => total + (bet ?? 0), 0);

/** Streets after preflop up to and including the one being answered. */
export const postflopStreetsTo = (street: Street): Street[] =>
    STREETS.slice(1).filter((candidate) => STREETS.indexOf(candidate) <= STREETS.indexOf(street));

/** Seat order for sorting a list of positions. */
export const bySeat = (order: readonly Position[]) => (a: Position, b: Position): number => order.indexOf(a) - order.indexOf(b);
