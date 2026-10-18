/**
 * A preflop spot's history: the blinds, what the hero is facing, and the
 * blinds who folded, with what each seat has in front of it.
 */
import type { Position, PreflopFacingState } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { PREFLOP_ORDER } from '../generator/seating.ts';
import { otherOpponents } from './seats.ts';
import { betsFrom, blindsOf, FOUR_BET_BB, OPEN_BB, preflopRaiseTo, sumBets, THREE_BET_BB } from './sizing.ts';
import type { Bets, HandHistory, HistoryRow, SeatRole } from './types.ts';

const at = (position: Position): number => PREFLOP_ORDER.indexOf(position);

const fieldRows = (action: string, amountBb: number | undefined, seats: readonly Position[]): HistoryRow[] =>
    seats.map((seat) => ({ street: 'preflop', actor: 'field', seat, action, amountBb }));

const villainRow = (scenario: Scenario, action: string, amountBb: number): HistoryRow =>
    ({ street: 'preflop', actor: 'villain', seat: scenario.villainPosition, action, amountBb });

const heroRow = (scenario: Scenario, action: string, amountBb: number): HistoryRow =>
    ({ street: 'preflop', actor: 'hero', seat: scenario.heroPosition, action, amountBb });

const pending = (rows: readonly HistoryRow[]): HistoryRow[] =>
    rows.map((row, index) => (index === rows.length - 1 ? { ...row, pending: true } : row));

/**
 * A player in the pot from IN FRONT of the raiser limped in — and their
 * response to the raise has not come yet (the action is on the hero), so the
 * limp is their only row.
 */
function raiseAndCallRows(scenario: Scenario): HistoryRow[] {
    const callers = otherOpponents(scenario);
    const raiserAt = scenario.villainPosition === undefined ? -1 : at(scenario.villainPosition);
    const raiseTo = preflopRaiseTo(scenario);
    return pending([
        ...fieldRows('limps', 1, callers.filter((caller) => at(caller) < raiserAt)),
        villainRow(scenario, 'raises to', raiseTo),
        ...fieldRows('calls', raiseTo, callers.filter((caller) => at(caller) > raiserAt)),
    ]);
}

/**
 * Same discipline around the hero's own open: a caller in front of the hero
 * limped first; a caller behind called the open before the 3-bet landed.
 */
function threeBetRows(scenario: Scenario): HistoryRow[] {
    const callers = otherOpponents(scenario);
    const hero = scenario.heroPosition;
    return [
        ...fieldRows('limps', 1, callers.filter((caller) => at(caller) < at(hero))),
        heroRow(scenario, 'raises to', OPEN_BB),
        ...fieldRows('calls', OPEN_BB, callers.filter((caller) => at(caller) > at(hero))),
        ...pending([villainRow(scenario, '3-bets to', THREE_BET_BB)]),
    ];
}

/** What the hero is facing preflop — every row, the last of them pending. */
const FACING_ROWS: Readonly<Record<PreflopFacingState, (scenario: Scenario) => HistoryRow[]>> = {
    unopened: () => [{ street: 'preflop', actor: 'field', action: 'fold to you', pending: true }],
    facing_limp: (scenario) => [
        ...fieldRows('limps', 1, otherOpponents(scenario)),
        ...pending([villainRow(scenario, 'limps', 1)]),
    ],
    facing_raise: (scenario) => pending([villainRow(scenario, 'raises to', preflopRaiseTo(scenario))]),
    facing_steal: (scenario) => pending([villainRow(scenario, 'raises to', preflopRaiseTo(scenario))]),
    facing_raise_and_call: raiseAndCallRows,
    facing_3bet: threeBetRows,
    facing_4bet: (scenario) => [
        villainRow(scenario, 'raises to', OPEN_BB),
        heroRow(scenario, '3-bets to', THREE_BET_BB),
        ...pending([villainRow(scenario, '4-bets to', FOUR_BET_BB)]),
    ],
};

/**
 * The blinds, posted — a row each, as a hand history writes them, so every
 * chip on the table has a line that put it there. BOTH of them, always: a
 * blind who then folded left dead money in the pot, and a story that never
 * mentions it cannot explain the pot it built.
 */
export function postedBlinds(scenario: Scenario): HistoryRow[] {
    const blinds = blindsOf(scenario);
    return (['SB', 'BB'] as const).map((seat) => ({
        street: 'preflop',
        actor: seat === scenario.heroPosition ? 'hero' : seat === scenario.villainPosition ? 'villain' : 'field',
        seat,
        action: 'posts',
        amountBb: blinds[seat],
    }));
}

/**
 * A preflop spot. A blind who acts before the hero and is not in the pot has
 * already folded — said at their turn: before the re-raise they never saw (the
 * blinds respond to the open before a 3-bet or 4-bet lands), after everything
 * else otherwise. Everything is in front of somebody: the blinds posted, the
 * raise, the calls; a folded blind's chips stay in front of the seat, dead.
 */
export function preflopHistory(
    scenario: Scenario,
    roles: ReadonlyMap<Position, SeatRole>,
    labels: Readonly<Record<Position, string>>,
): HandHistory {
    const blindFolds: HistoryRow[] = (['SB', 'BB'] as const)
        .filter((seat) => roles.get(seat) === 'folded')
        .map((seat) => ({ street: 'preflop', actor: 'field', seat, action: 'folds' }));
    const state = scenario.preflopFacingState;
    const facing = [...postedBlinds(scenario), ...(state === undefined ? [] : FACING_ROWS[state](scenario))];
    const reRaise = facing.findLastIndex((row) => row.action === '3-bets to' || row.action === '4-bets to');
    const splitAt = reRaise === -1 ? facing.length : reRaise;
    const rows = [...facing.slice(0, splitAt), ...blindFolds, ...facing.slice(splitAt)];
    const bets: Bets = { ...blindsOf(scenario), ...betsFrom(rows, 'preflop') };
    return { rows, bets, potBb: sumBets(bets), roles, labels };
}
