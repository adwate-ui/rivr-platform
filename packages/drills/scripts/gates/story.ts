/**
 * Is a spot's hand history a table a poker player can believe?
 *
 * No action belongs to "someone", both blinds post and a folded blind folds on
 * the record, nobody raises out of turn, nobody bets more than is behind, and
 * nobody puts chips in twice in a row. Each check is one sentence a player at
 * the table would call out.
 */
import { handHistory, type HistoryRow, type SeatRole } from '../../src/handHistory.ts';
import { POSTFLOP_ORDER, PREFLOP_ORDER } from '../../src/generator/seating.ts';
import type { Position } from '../../src/ontology/types.ts';
import type { Scenario } from '../../src/generator/types.ts';

type Roles = ReadonlyMap<Position, SeatRole>;

const AGGRESSIVE = new Set(['raises to', '3-bets to', '4-bets to']);
const BET_LIKE = new Set(['bets', 'leads', 'raises to', 'moves all in']);
const POSTFLOP_STREETS = ['flop', 'turn', 'river'] as const;

const inThePot = (roles: Roles, seat: Position): boolean => roles.get(seat) === 'hero' || roles.get(seat) === 'in_pot';

/**
 * Nobody bets what is not behind on the street being answered (an earlier bet
 * went in from a bigger stack), and nobody plays on after going all in.
 */
function stackProblems(scenario: Scenario, rows: readonly HistoryRow[]): string[] {
    const behind = scenario.effectiveStackBb;
    const over = rows.find((row) => row.street === scenario.street && row.amountBb !== undefined
        && behind !== undefined && row.amountBb > behind + 1e-9);
    const shoved = rows.find((row) => row.action === 'moves all in' && row.street !== scenario.street);
    return [
        ...(over === undefined ? [] : [`${over.seat} ${over.action} ${over.amountBb}bb with ${behind}bb behind`]),
        ...(shoved === undefined ? [] : [`${shoved.seat} moves all in on the ${shoved.street} and the hand goes on`]),
    ];
}

/** Both blinds post, and a blind that folded folds on the record. */
function blindProblems(rows: readonly HistoryRow[], roles: Roles): string[] {
    return (['SB', 'BB'] as const).flatMap((seat) => [
        ...(rows.some((row) => row.seat === seat && row.action === 'posts') ? [] : [`${seat} never posts`]),
        ...(roles.get(seat) === 'folded' && !rows.some((row) => row.seat === seat && row.action === 'folds')
            ? [`${seat} folded off the record`] : []),
    ]);
}

const enteredEarlier = (before: readonly HistoryRow[], seat: Position): boolean =>
    before.some((row) => row.seat === seat && (row.action === 'limps' || AGGRESSIVE.has(row.action)));

/** Seats in the pot ahead of the first raiser that never limped in. */
const limplessAhead = (inPot: readonly Position[], raiserAt: number, before: readonly HistoryRow[]): string[] =>
    inPot.filter((seat) => PREFLOP_ORDER.indexOf(seat) < raiserAt
        && !before.some((row) => row.seat === seat && row.action === 'limps'))
        .map((seat) => `${seat} is in the pot ahead of the raiser with no limp`);

/** A raiser seated behind a caller acts later, or is shown limping in first. */
function preflopProblems(rows: readonly HistoryRow[], roles: Roles): string[] {
    const preflop = rows.filter((row) => row.street === 'preflop');
    const inPot = PREFLOP_ORDER.filter((seat) => inThePot(roles, seat));
    const problems: string[] = [];
    let last = -1;
    let firstRaiseSeen = false;
    preflop.forEach((row, index) => {
        if (!AGGRESSIVE.has(row.action)) return;
        if (row.seat === undefined) {
            problems.push('an aggressor with no seat');
            return;
        }
        const at = PREFLOP_ORDER.indexOf(row.seat);
        const before = preflop.slice(0, index);
        if (at <= last && !enteredEarlier(before, row.seat)) problems.push(`${row.seat} ${row.action} out of turn`);
        if (!firstRaiseSeen) problems.push(...limplessAhead(inPot, at, before));
        firstRaiseSeen = true;
        last = Math.max(last, at);
    });
    return problems;
}

/** A bet from a seat that does not open the street was invited by the checks in front of it. */
function uninvitedBet(street: string, earlier: readonly HistoryRow[], bettor: Position, roles: Roles): string[] {
    const acted = new Set(earlier.map((row) => row.seat));
    const bettorAt = POSTFLOP_ORDER.indexOf(bettor);
    return POSTFLOP_ORDER
        .filter((seat) => seat !== bettor && inThePot(roles, seat) && POSTFLOP_ORDER.indexOf(seat) < bettorAt && !acted.has(seat))
        .map((seat) => `${street}: ${bettor} bets while ${seat} has not acted`);
}

/** A raise or a call answers a bet. */
function unansweredProblems(street: string, row: HistoryRow, betSeen: boolean): string[] {
    if (betSeen) return [];
    if (row.action === 'raises to') return [`${street}: a raise with nothing to raise`];
    if (row.action === 'calls') return [`${street}: ${row.seat} calls with nothing to call`];
    return [];
}

/** Nobody bets twice in a row. */
const twiceInARow = (street: string, earlier: HistoryRow | undefined, row: HistoryRow): string[] =>
    (earlier !== undefined && earlier.seat === row.seat && BET_LIKE.has(earlier.action) && BET_LIKE.has(row.action)
        ? [`${street}: ${row.seat} ${earlier.action} then ${row.action}`] : []);

function actionProblems(street: string, onStreet: readonly HistoryRow[], roles: Roles): string[] {
    const problems: string[] = [];
    let betSeen = false;
    onStreet.forEach((row, index) => {
        problems.push(...unansweredProblems(street, row, betSeen));
        if (row.seat !== undefined && (row.action === 'bets' || row.action === 'leads')) {
            problems.push(...uninvitedBet(street, onStreet.slice(0, index), row.seat, roles));
        }
        problems.push(...twiceInARow(street, onStreet[index - 1], row));
        if (BET_LIKE.has(row.action)) betSeen = true;
    });
    return problems;
}

/** One postflop street: it opens with the earliest live seat, and its actions read in order. */
function streetProblems(scenario: Scenario, street: string, rows: readonly HistoryRow[], roles: Roles): string[] {
    const onStreet = rows.filter((row) => row.street === street);
    if (onStreet.length === 0) return [];
    if (onStreet.some((row) => row.seat === undefined)) return [`${street}: a row with no seat`];
    const earliest = POSTFLOP_ORDER.find((seat) => inThePot(roles, seat));
    const opener = onStreet[0]?.seat;
    const pendingTwice = street === scenario.street && onStreet.filter((row) => row.pending === true).length > 1;
    return [
        ...(opener === earliest ? [] : [`${street} opens with ${opener}, not ${earliest}`]),
        ...actionProblems(street, onStreet, roles),
        ...(pendingTwice ? [`${street}: the action being answered is told twice`] : []),
    ];
}

/** Everything about this spot's story that a player at the table would call out. */
export function storyProblems(scenario: Scenario): string[] {
    const { rows, roles } = handHistory(scenario);
    return [
        ...(rows.some((row) => row.actor === 'unknown') ? ['a row belongs to nobody'] : []),
        ...stackProblems(scenario, rows),
        ...blindProblems(rows, roles),
        ...preflopProblems(rows, roles),
        ...POSTFLOP_STREETS.flatMap((street) => streetProblems(scenario, street, rows, roles)),
    ];
}
