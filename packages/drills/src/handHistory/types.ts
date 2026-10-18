/**
 * The shapes a hand history is told in.
 */
import type { Position, Street } from '../ontology/types.ts';
import type { Actor } from '../nodePath.ts';

export interface HistoryRow {
    readonly street: Street;
    /** Who acted: the hero, the opponent being answered, another player in the pot, or not stated. */
    readonly actor: Actor | 'field' | 'unknown';
    /** The seat, where known. Every `field` row names one. */
    readonly seat?: Position | undefined;
    /** "bets", "calls", "raises to", "checks", "limps", "folds" — past of the step where it already happened. */
    readonly action: string;
    /** In big blinds, where the model has one. */
    readonly amountBb?: number | undefined;
    /** True for the action the hero is answering — the bet in front of them now. */
    readonly pending?: boolean | undefined;
}

export type SeatRole = 'hero' | 'in_pot' | 'yet_to_act' | 'folded';

/** What each seat has put in front of it, in big blinds. */
export type Bets = Partial<Record<Position, number>>;

export interface HandHistory {
    readonly rows: readonly HistoryRow[];
    /** What is in front of each player on the current street, in blinds — chips the table draws. */
    readonly bets: Readonly<Bets>;
    /** What is in the middle, in blinds: earlier streets swept in, plus what is in front now — the number the table prints. */
    readonly potBb: number | undefined;
    /** Every seat's part in the hand. */
    readonly roles: ReadonlyMap<Position, SeatRole>;
    /** What every seat is called: "You", "Villain 1", "Villain 2", …, or "Folded". */
    readonly labels: Readonly<Record<Position, string>>;
}
