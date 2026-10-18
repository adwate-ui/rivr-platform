/**
 * FSRS-5, implemented here rather than taken from a package.
 *
 * Three reasons, in the order they mattered. The one-dependency budget was
 * spent on the schema validator. `ts-fsrs` is `Date`-object-based, which
 * collides with the injected-clock requirement and with this package's
 * framework-free rule, so wrapping it would have been more code than the
 * algorithm. And this is the thing that decides what somebody studies for two
 * weeks — 120 lines of arithmetic with the published equations written beside
 * them is auditable in a way a package is not.
 *
 * FSRS-5 rather than v4 or v4.5: it is the current Anki default, it models
 * short-term memory explicitly instead of v4's same-day-review hack, and
 * picking it means one implementation rather than a migration later.
 *
 * There is no `Date` anywhere in this file. Time arrives as elapsed days.
 */

/** 1 again, 2 hard, 3 good, 4 easy. */
export type Grade = 1 | 2 | 3 | 4;

export interface MemoryState {
    /** Days at which recall probability falls to `requestRetention`. */
    readonly stability: number;
    /** 1 (easiest) to 10 (hardest). */
    readonly difficulty: number;
}

export interface SchedulerConfig {
    readonly weights: readonly number[];
    readonly requestRetention: number;
    readonly maximumIntervalDays: number;
    readonly decay: number;
}

/** The published FSRS-5 defaults. Nineteen of them; order is load-bearing. */
export const FSRS5_DEFAULT_WEIGHTS: readonly number[] = [
    0.40255, 1.18385, 3.173, 15.69105,
    7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395,
    0.11, 0.29605, 2.2698, 0.2315,
    2.9898, 0.51655, 0.6621,
];

export const DEFAULT_CONFIG: SchedulerConfig = {
    weights: FSRS5_DEFAULT_WEIGHTS,
    requestRetention: 0.9,
    maximumIntervalDays: 365 * 3,
    decay: -0.5,
};

const FACTOR = 19 / 81;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.01;

const clamp = (value: number, low: number, high: number): number =>
    Math.min(Math.max(value, low), high);

/** Weight `w[index]`. A configuration without it is a bug, not a state to schedule from. */
function weight(config: SchedulerConfig, index: number): number {
    const value = config.weights[index];
    if (value === undefined) throw new RangeError(`FSRS weight w${index} is missing`);
    return value;
}

/** w[G-1], the initial stability for a first rating. */
export function initialStability(grade: Grade, config: SchedulerConfig): number {
    return Math.max(weight(config, grade - 1), MIN_STABILITY);
}

/** D0(G) = w4 - e^(w5 (G-1)) + 1 */
export function initialDifficulty(grade: Grade, config: SchedulerConfig): number {
    return clamp(weight(config, 4) - Math.exp(weight(config, 5) * (grade - 1)) + 1, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/** The memory state after a card's first rating. */
export function initialState(grade: Grade, config: SchedulerConfig = DEFAULT_CONFIG): MemoryState {
    return {
        stability: initialStability(grade, config),
        difficulty: initialDifficulty(grade, config),
    };
}

/**
 * R(t, S) = (1 + FACTOR t/S)^decay
 *
 * The probability the card is still recallable after `elapsedDays`. Falls to
 * `requestRetention` exactly at the scheduled interval, which is what makes
 * the interval mean something.
 */
export function retrievability(elapsedDays: number, stability: number, config: SchedulerConfig = DEFAULT_CONFIG): number {
    return (1 + FACTOR * (Math.max(elapsedDays, 0) / stability)) ** config.decay;
}

/** The interval at which retrievability reaches the requested retention. */
export function intervalDays(stability: number, config: SchedulerConfig = DEFAULT_CONFIG): number {
    const raw = (stability / FACTOR) * (config.requestRetention ** (1 / config.decay) - 1);
    return clamp(Math.round(raw), 1, config.maximumIntervalDays);
}

/** Difficulty drifts on a miss and reverts toward the easy anchor. */
function nextDifficulty(previous: number, grade: Grade, config: SchedulerConfig): number {
    const w6 = weight(config, 6);
    const w7 = weight(config, 7);
    const delta = previous - w6 * (grade - 3);
    // Mean reversion toward D0(4), which stops difficulty ratcheting upward
    // forever on a card that is merely being reviewed often.
    const reverted = w7 * initialDifficulty(4, config) + (1 - w7) * delta;
    return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/** S' after a successful recall. Grows more the longer it was left. */
function stabilityAfterRecall(
    state: MemoryState,
    retention: number,
    grade: Grade,
    config: SchedulerConfig,
): number {
    const w = (index: number): number => weight(config, index);
    const hardPenalty = grade === 2 ? w(15) : 1;
    const easyBonus = grade === 4 ? w(16) : 1;

    const growth = Math.exp(w(8))
        * (11 - state.difficulty)
        * state.stability ** -w(9)
        * (Math.exp((1 - retention) * w(10)) - 1)
        * hardPenalty
        * easyBonus;

    return Math.max(state.stability * (1 + growth), MIN_STABILITY);
}

/** S' after a lapse. Always lower, and floored so a card never dies. */
function stabilityAfterForget(
    state: MemoryState,
    retention: number,
    config: SchedulerConfig,
): number {
    const w = (index: number): number => weight(config, index);
    const next = w(11)
        * state.difficulty ** -w(12)
        * ((state.stability + 1) ** w(13) - 1)
        * Math.exp((1 - retention) * w(14));

    // Never above the stability it already had: forgetting cannot be progress.
    return Math.max(Math.min(next, state.stability), MIN_STABILITY);
}

/**
 * The next memory state.
 *
 * `previous` is null for a card being seen for the first time, which is the
 * only case that does not consult elapsed time — there is nothing to have
 * forgotten yet.
 */
export function nextState(
    previous: MemoryState | null,
    elapsedDays: number,
    grade: Grade,
    config: SchedulerConfig = DEFAULT_CONFIG,
): MemoryState {
    if (previous === null) return initialState(grade, config);

    const retention = retrievability(elapsedDays, previous.stability, config);
    const difficulty = nextDifficulty(previous.difficulty, grade, config);
    const stability = grade === 1
        ? stabilityAfterForget(previous, retention, config)
        : stabilityAfterRecall(previous, retention, grade, config);

    return { stability, difficulty };
}
