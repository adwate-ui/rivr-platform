/**
 * The two things a street's replayed steps do not say: the action the hero is
 * answering, and the checks the line implies but never states.
 */
import { POSTFLOP_ORDER } from '../generator/seating.ts';
import type { PostflopFacingState, Position } from '../ontology/types.ts';
import { BUCKET_FRACTION, BET_FRACTION, RAISE_MULTIPLE, roundBb } from './sizing.ts';
import { BET_LIKE, betWordFor, cappedBy, rowFor, type StreetPass } from './streetWalk.ts';
import type { HistoryRow } from './types.ts';

/**
 * The words the action being answered can already have been told in — one
 * list per facing state, matched against the last row of the street.
 */
const PENDING_WORDS: Readonly<Record<PostflopFacingState, readonly string[]>> = {
    first_to_act: [],
    facing_check: ['checks'],
    facing_bet: ['bets', 'leads', 'moves all in'],
    facing_donk: ['bets', 'leads', 'moves all in'],
    facing_raise: ['raises to', 'moves all in'],
};

/**
 * Has the line ALREADY told the action the hero is answering?
 *
 * Two conventions live in encodings: some rules end their `node_path` with the
 * pending action itself (`[..., "villain_flop_bet"]` alongside
 * `postflop_facing_state: "facing_bet"`) and the rest stop before it. Under the
 * first convention both the replay and the facing state told the bet:
 * "Villain 1 bets 7bb" and then "Villain 1 bets 5bb", one seat betting twice in
 * a row at two prices. The path's row is the pending action exactly when it is
 * the villain's and it CLOSES the street, so it is dropped and stated once, at
 * the source's bucket, by the same code that states it for every other rule.
 */
function statesPending(rows: readonly HistoryRow[], facing: PostflopFacingState | undefined): boolean {
    const last = rows.at(-1);
    if (facing === undefined || last === undefined || last.actor !== 'villain') return false;
    return PENDING_WORDS[facing].includes(last.action);
}

const pendingRow = (pass: StreetPass, action: string, amountBb?: number): HistoryRow => ({
    street: pass.street, actor: 'villain', seat: pass.walk.scenario.villainPosition, action, amountBb, pending: true,
});

/** The size of the bet being faced: the source's bucket, of the pot the generator states. */
function bucketBet(pass: StreetPass, swept: number): number {
    const { scenario } = pass.walk;
    const size = scenario.villainRaiseSize;
    if (size === 'all_in') return scenario.effectiveStackBb ?? roundBb(swept);
    return cappedBy(scenario, roundBb(swept * BUCKET_FRACTION[size ?? 'standard']));
}

/**
 * A raise raises a bet. Where the line has none on this street, the bet is the
 * hero's — that is what being raised means — and the raise is a MULTIPLE of it.
 */
function facingRaise(pass: StreetPass, swept: number): void {
    const { walk } = pass;
    const { scenario } = walk;
    if (!pass.rows.some((row) => BET_LIKE.has(row.action))) {
        walk.lastBet = cappedBy(scenario, roundBb(swept * BET_FRACTION));
        pass.rows.push(rowFor(pass, scenario.heroPosition, betWordFor(scenario, walk.lastBet, 'bets'), walk.lastBet));
    }
    const size = scenario.villainRaiseSize;
    const raiseTo = size === 'all_in'
        ? (scenario.effectiveStackBb ?? roundBb(swept))
        : cappedBy(scenario, roundBb(walk.lastBet * RAISE_MULTIPLE[size ?? 'standard']));
    pass.rows.push(pendingRow(pass, betWordFor(scenario, raiseTo, 'raises to'), raiseTo));
}

/**
 * The action being answered. The pot here is `scenario.potBb` — the
 * generator's number — and the bucket is the source's. Where the line already
 * told it, that row is dropped first (see `statesPending`), and the bet a raise
 * answers goes back to the one still on the record.
 */
export function addPendingAction(pass: StreetPass): void {
    const { walk } = pass;
    const { scenario } = walk;
    const swept = scenario.potBb ?? walk.pot;
    if (statesPending(pass.rows, scenario.postflopFacingState)) {
        pass.rows.pop();
        walk.lastBet = pass.rows.findLast((row) => BET_LIKE.has(row.action))?.amountBb ?? 0;
    }
    switch (scenario.postflopFacingState) {
        case 'facing_check':
            pass.rows.push({ street: pass.street, actor: 'villain', seat: scenario.villainPosition, action: 'checks', pending: true });
            break;
        case 'facing_bet':
        case 'facing_donk': {
            const bet = bucketBet(pass, swept);
            const word = scenario.postflopFacingState === 'facing_donk' ? 'leads' : 'bets';
            pass.rows.push(pendingRow(pass, betWordFor(scenario, bet, word), bet));
            break;
        }
        case 'facing_raise':
            facingRaise(pass, swept);
            break;
        default:
            break;
    }
}

const orderOf = (position: Position): number => POSTFLOP_ORDER.indexOf(position);
const rowOrder = (row: HistoryRow): number => (row.seat === undefined ? -1 : orderOf(row.seat));

/** Everyone in front of the street's first bettor checked before the bet came — said in seat order. */
function checksBeforeBet(pass: StreetPass, inPotOrder: readonly Position[], firstBet: number): void {
    const before = pass.rows.slice(0, firstBet);
    const bettor = pass.rows[firstBet]?.seat;
    if (bettor === undefined) return;
    const segment = [
        ...before,
        ...inPotOrder
            .filter((position) => orderOf(position) < orderOf(bettor) && !before.some((row) => row.seat === position))
            .map((position) => rowFor(pass, position, 'checks')),
    ].sort((a, b) => rowOrder(a) - rowOrder(b));
    pass.rows.splice(0, firstBet, ...segment);
}

/** A street of nothing but checks ended with everyone checking. */
function checksAround(pass: StreetPass, inPotOrder: readonly Position[]): void {
    const have = new Set(pass.rows.map((row) => row.seat));
    pass.rows.push(...inPotOrder.filter((position) => !have.has(position)).map((position) => rowFor(pass, position, 'checks')));
    pass.rows.sort((a, b) => rowOrder(a) - rowOrder(b));
}

/**
 * The untold parts: a street nobody mentions was checked through; a bet from a
 * seat that does not open the street was invited by the checks in front of it.
 * Nothing can be woven around a step that names nobody, so a path with
 * unattributed actors is left verbatim.
 */
export function addUntoldChecks(pass: StreetPass, inPotOrder: readonly Position[]): void {
    if (!pass.rows.every((row) => row.seat !== undefined)) return;
    const answered = pass.street === pass.walk.scenario.street;
    const firstBet = pass.rows.findIndex((row) => BET_LIKE.has(row.action));
    if (pass.rows.length === 0 && !answered) {
        pass.rows.push(...inPotOrder.map((position) => rowFor(pass, position, 'checks')));
    } else if (firstBet >= 0) {
        checksBeforeBet(pass, inPotOrder, firstBet);
    } else if (!answered && pass.rows.length > 0) {
        checksAround(pass, inPotOrder);
    }
}
