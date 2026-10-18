/**
 * Attempt rows for the analytics tests. Test-only.
 */
import { cardOrThrow as card } from '../cards/cards.ts';
import type { Scenario } from '../generator/types.ts';
import { toAttemptRow, type AttemptRow } from './attempt.ts';


/** A flop spot on the button, facing a check with top pair, unless `over` says otherwise. */
export const scenario = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'flop',
    heroPosition: 'BTN',
    potType: 'single_raised',
    playerCount: 'heads_up',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    stackBracket: 'standard',
    postflopFacingState: 'facing_check',
    board: [card('Ah'), card('7c'), card('2d')],
    hole: [card('As'), card('Kd')],
    holder: 'hero',
    boardTags: ['rainbow', 'high'],
    handClass: 'top_pair_good_kicker',
    draws: ['none'],
    relativeStrength: 'strong',
    nodePath: [],
    seed: 1,
    ...over,
});

const baseRow = (): AttemptRow => toAttemptRow({
    id: 'a1',
    sessionId: 's1',
    sourceId: 'src',
    sourceHash: 'hash',
    principleId: 'pr',
    scenario: scenario(),
    submittedAction: 'bet',
    correctAction: 'bet',
    provenanceKind: 'branch',
    errorClass: 'correct',
    grade: 3,
    latencyMs: 4_000,
    correct: true,
    now: 1_760_000_000_000,
});

/** One correct attempt on `scenario()`, with `over` applied. */
export const row = (over: Partial<AttemptRow> = {}): AttemptRow => ({ ...baseRow(), ...over });

/** `count` such attempts. */
export const many = (count: number, over: Partial<AttemptRow> = {}): AttemptRow[] =>
    Array.from({ length: count }, (_, index) => row({ id: `a${index}`, ...over }));
