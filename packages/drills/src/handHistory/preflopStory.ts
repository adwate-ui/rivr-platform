/**
 * How the preflop pot of a postflop spot got built — a story a poker player can
 * believe.
 *
 * Every raise is attributed to a player IN the pot, in an order the game
 * allows: the path's own preflop steps first (`hero_preflop_3bet` means the
 * villain opened and the HERO re-raised — this was once told backwards, as the
 * small blind raising right after posting); the postflop initiative next; and
 * a raiser who sits BEHIND another player in the pot got there because that
 * player limped first, so the limp is shown. A raise is never conjured out of
 * turn, and no chip belongs to "someone".
 */
import type { Position } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { PREFLOP_ORDER } from '../generator/seating.ts';
import { impliedAggressor } from '../generator/preflopLine.ts';
import type { Actor, PathStep } from '../nodePath.ts';
import { FOUR_BET_BB, OPEN_BB, THREE_BET_BB } from './sizing.ts';
import type { HistoryRow, SeatRole } from './types.ts';

interface Story {
    readonly scenario: Scenario;
    readonly steps: readonly PathStep[];
    readonly hero: Position;
    /** Everyone in the pot, hero included, in preflop order. */
    readonly participants: readonly Position[];
    /** Blinds not in the pot: they folded, and say so at their turn. */
    readonly foldedBlinds: readonly Position[];
}

const order = (seat: Position): number => PREFLOP_ORDER.indexOf(seat);

const took = (story: Story, actor: Actor, action: string): boolean =>
    story.steps.some((step) => step.street === 'preflop' && step.actor === actor && step.action === action);

function row(story: Story, seat: Position, action: string, amountBb?: number): HistoryRow {
    const actor = seat === story.hero ? 'hero' : seat === story.scenario.villainPosition ? 'villain' : 'field';
    return { street: 'preflop', actor, seat, action, amountBb };
}

const foldRows = (story: Story, seats: readonly Position[]): HistoryRow[] => seats.map((seat) => row(story, seat, 'folds'));

/**
 * The seat holding the initiative when the path is silent: the implied
 * aggressor where that player is named, the earliest participant otherwise.
 */
function impliedSeat(story: Story): Position {
    const actor = impliedAggressor(story.scenario.postflopFacingState, story.steps);
    const seat = actor === 'hero' ? story.hero : story.scenario.villainPosition;
    return seat !== undefined && story.participants.includes(seat) ? seat : story.participants[0] ?? story.hero;
}

/** Everyone in, in order; the big blind already has a blind in and checks the option. A blind NOT in the pot folded. */
function limpedRows(story: Story): HistoryRow[] {
    return [
        ...story.participants.map((seat) => (seat === 'BB' ? row(story, seat, 'checks') : row(story, seat, 'limps', 1))),
        ...foldRows(story, story.foldedBlinds),
    ];
}

/**
 * Any preflop raise step marks the raiser — a `3bet` step in a pot the rule
 * calls single-raised still says whose hand held the initiative.
 */
function singleRaiseOpener(story: Story): Position {
    const villain = story.scenario.villainPosition;
    if (took(story, 'hero', 'raise') || took(story, 'hero', '3bet')) return story.hero;
    const villainRaised = took(story, 'villain', 'raise') || took(story, 'villain', '3bet');
    return villainRaised && villain !== undefined ? villain : impliedSeat(story);
}

/**
 * A participant sitting BEFORE the raiser was already in: they limped, and they
 * call the raise when it comes back around. Behind the raiser, every seat
 * answers in order — a caller calls, a blind who is out of the hand folds
 * exactly at their turn.
 */
function singleRaisedRows(story: Story): HistoryRow[] {
    const opener = singleRaiseOpener(story);
    const limpers = story.participants.filter((seat) => order(seat) < order(opener));
    const foldsAhead = story.foldedBlinds.filter((seat) => order(seat) < order(opener));
    const responses = PREFLOP_ORDER.slice(order(opener) + 1).flatMap((seat) => {
        if (story.participants.includes(seat)) return [row(story, seat, 'calls', OPEN_BB)];
        return story.foldedBlinds.includes(seat) ? [row(story, seat, 'folds')] : [];
    });
    return [
        ...limpers.map((seat) => row(story, seat, 'limps', 1)),
        ...foldRows(story, foldsAhead),
        row(story, opener, 'raises to', OPEN_BB),
        ...responses,
        ...limpers.map((seat) => row(story, seat, 'calls', OPEN_BB)),
    ];
}

/**
 * The re-raiser: the path's 3-bet step names them; a plain raise step names the
 * OPENER, so the other player re-raised; the postflop initiative decides when
 * the path is silent (the 3-bettor is usually the one c-betting the 3-bet pot).
 */
function reRaiser(story: Story): Position {
    const villain = story.scenario.villainPosition;
    if (took(story, 'hero', '3bet')) return story.hero;
    if (villain !== undefined && (took(story, 'villain', '3bet') || took(story, 'hero', 'raise'))) return villain;
    return took(story, 'villain', 'raise') ? story.hero : impliedSeat(story);
}

interface ReRaise {
    readonly opener: Position;
    readonly threeBetter: Position;
    /** Everyone else in the pot. */
    readonly rest: readonly Position[];
}

/** How a re-raised pot closes: the opener calls the 3-bet, or 4-bets and is called. */
function closingRows(story: Story, { opener, threeBetter, rest }: ReRaise): HistoryRow[] {
    if (story.scenario.potType === 'three_bet') {
        return [row(story, opener, 'calls', THREE_BET_BB), ...rest.map((seat) => row(story, seat, 'calls', THREE_BET_BB))];
    }
    return [
        row(story, opener, '4-bets to', FOUR_BET_BB),
        row(story, threeBetter, 'calls', FOUR_BET_BB),
        ...rest.map((seat) => row(story, seat, 'calls', FOUR_BET_BB)),
    ];
}

/**
 * Anyone in the pot from IN FRONT of the opener — the 3-bettor or a
 * cold-caller — got there by limping in first. A blind folds at their turn:
 * before the 3-bet if they sit before the 3-bettor, after it otherwise.
 */
function reRaisedRows(story: Story): HistoryRow[] {
    const threeBetter = reRaiser(story);
    const villain = story.scenario.villainPosition;
    const opener = threeBetter === story.hero
        ? (villain ?? story.participants.find((seat) => seat !== story.hero) ?? story.hero)
        : story.hero;
    const rest = story.participants.filter((seat) => seat !== opener && seat !== threeBetter);
    const limpers = [...(order(threeBetter) < order(opener) ? [threeBetter] : []),
        ...rest.filter((seat) => order(seat) < order(opener))]
        .sort((a, b) => order(a) - order(b));
    const fromOpener = story.foldedBlinds.filter((seat) => order(seat) >= order(opener));
    return [
        ...limpers.map((seat) => row(story, seat, 'limps', 1)),
        ...foldRows(story, story.foldedBlinds.filter((seat) => order(seat) < order(opener))),
        row(story, opener, 'raises to', OPEN_BB),
        ...foldRows(story, fromOpener.filter((seat) => order(seat) < order(threeBetter))),
        row(story, threeBetter, '3-bets to', THREE_BET_BB),
        ...foldRows(story, fromOpener.filter((seat) => order(seat) > order(threeBetter))),
        ...closingRows(story, { opener, threeBetter, rest }),
    ];
}

/** The preflop rows of a postflop spot, told from its pot type and line. */
export function preflopStory(scenario: Scenario, steps: readonly PathStep[], roles: ReadonlyMap<Position, SeatRole>): HistoryRow[] {
    const hero = scenario.heroPosition;
    const story: Story = {
        scenario,
        steps,
        hero,
        participants: [...new Set<Position>([hero, ...scenario.villainPositions])].sort((a, b) => order(a) - order(b)),
        foldedBlinds: (['SB', 'BB'] as const).filter((seat) => roles.get(seat) === 'folded'),
    };
    switch (scenario.potType) {
        case 'limped':
            return limpedRows(story);
        case 'single_raised':
            return singleRaisedRows(story);
        case 'three_bet':
        case 'four_bet_plus':
            return reRaisedRows(story);
        default:
            return [];
    }
}
