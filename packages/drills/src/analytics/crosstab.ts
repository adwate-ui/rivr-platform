/**
 * Errors, cut by scenario attribute rather than only by principle.
 *
 * **This is the feature that makes the product more than a quiz.** Ninety
 * percent on a barrelling rule overall and forty percent on it at very deep
 * stacks is a leak no source taught — it only exists to be found because the
 * generator varies coordinates nobody authored, and only becomes visible
 * because every attempt row wrote those coordinates down.
 *
 * The statistics matter as much as the grouping. Without a significance floor
 * this page reports "100% error rate on monotone boards" off two attempts, and
 * a tool that confidently misleads is worse than no tool.
 */

import { ERROR_CLASS_LABEL, type ErrorClass } from '../grading/classifyError.ts';
import type { AttemptRow } from './attempt.ts';
import {
    ANSWER_KINDS, BOARD_TAGS, DRAW_CLASSES, HAND_CLASSES, PLAYER_COUNTS, POSITIONS, POT_TYPES,
    RELATIVE_STRENGTHS, STACK_BRACKETS, STAKES, STREETS, VILLAIN_ARCHETYPES,
} from '../ontology/types.ts';

export const DIMENSIONS = [
    'principleId', 'answerKind', 'stakes', 'street', 'heroPosition', 'potType', 'playerCount',
    'stackBracket', 'villainArchetype', 'handClass', 'relativeStrength',
    'boardTag', 'drawClass', 'errorClass',
] as const;

export type Dimension = typeof DIMENSIONS[number];

/** Below this many attempts a cell says nothing, whatever its rate. */
export const MIN_ATTEMPTS = 12;

/**
 * Dimensions where one attempt lands in SEVERAL cells.
 *
 * A board carries more than one tag, so these columns sum to more than the
 * attempt total. That is correct and it looks like a bug, which is why the
 * fact is exported rather than left for the reader to work out.
 */
export const SET_VALUED: readonly Dimension[] = ['boardTag', 'drawClass'];

/**
 * The order a dimension's values belong in.
 *
 * Almost every dimension here is an ORDERED SCALE, and the cross-tab used to
 * lay both of its axes out with a bare `.sort()` — so streets read "flop,
 * preflop, river" and stack depths ran "deep, short, very deep". Alphabetical
 * order on an ordinal scale is not a neutral default; it actively destroys the
 * thing the axis is for, which is reading a trend along it.
 *
 * `principleId` is deliberately absent: its keys are ids and its cells display
 * names, so sorting the keys produced an order with no relationship to
 * anything on screen. Those fall through to the label comparator below.
 */
const DIMENSION_ORDER: Readonly<Partial<Record<Dimension, readonly string[]>>> = {
    stakes: STAKES,
    street: STREETS,
    heroPosition: POSITIONS,
    potType: POT_TYPES,
    playerCount: PLAYER_COUNTS,
    stackBracket: STACK_BRACKETS,
    villainArchetype: VILLAIN_ARCHETYPES,
    handClass: HAND_CLASSES,
    relativeStrength: RELATIVE_STRENGTHS,
    boardTag: BOARD_TAGS,
    drawClass: DRAW_CLASSES,
    answerKind: ANSWER_KINDS,
    // Derived from the label map, not written out. This used to be a hand-typed
    // list, and it was one of the two places the compiler cannot check: when
    // `wrong_label`, `too_few` and `too_many` arrived, `ERROR_CLASS_LABEL`
    // refused to compile until it knew them and this list said nothing at all.
    // The new classes would have sorted to the end as unknowns. `Record` keys
    // keep insertion order, so the label map's order IS the reading order.
    errorClass: Object.keys(ERROR_CLASS_LABEL),
};

/**
 * Puts a dimension's values in the order a reader expects to meet them.
 *
 * `label` is how the value is spelled on screen, and is what orders the
 * dimensions that have no canonical scale — a principle axis reads
 * alphabetically by NAME rather than by id.
 *
 * A value the enum does not know about sorts to the end rather than being
 * dropped: an attempt row recorded under an older ontology still has to
 * appear, and silently losing a column would be worse than an odd one.
 */
export function orderValues(
    dimension: Dimension,
    keys: readonly string[],
    label: (key: string) => string = (key) => key,
): string[] {
    const canonical = DIMENSION_ORDER[dimension];
    if (canonical === undefined) {
        return [...keys].sort((a, b) => label(a).localeCompare(label(b)));
    }
    const rank = new Map(canonical.map((value, index) => [value, index]));
    return [...keys].sort((a, b) => (
        (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER)
        || label(a).localeCompare(label(b))
    ));
}

export interface Cell {
    readonly key: string;
    readonly attempts: number;
    readonly errors: number;
    /** Errors over attempts, in [0, 1]. */
    readonly rate: number;
    readonly byErrorClass: Readonly<Partial<Record<ErrorClass, number>>>;
    /** True once there are enough attempts for the rate to mean anything. */
    readonly significant: boolean;
}

type ScalarDimension = Exclude<Dimension, 'boardTag' | 'drawClass' | 'answerKind'>;

/** The one value an attempt carries on each single-valued dimension; absent is `undefined`, never null. */
const SCALAR_READERS: Readonly<Record<ScalarDimension, (row: AttemptRow) => string | undefined>> = {
    principleId: (row) => row.principleId,
    stakes: (row) => row.stakes,
    street: (row) => row.street,
    heroPosition: (row) => row.heroPosition,
    potType: (row) => row.potType,
    playerCount: (row) => row.playerCount,
    stackBracket: (row) => row.stackBracket,
    villainArchetype: (row) => row.villainArchetype,
    handClass: (row) => row.handClass,
    relativeStrength: (row) => row.relativeStrength,
    errorClass: (row) => row.errorClass,
};

/** The value(s) an attempt contributes on a dimension. */
function valuesFor(row: AttemptRow, dimension: Dimension): string[] {
    switch (dimension) {
        case 'boardTag':
            return [...row.boardTags];
        case 'drawClass':
            return [...row.drawClasses];
        case 'answerKind':
            // Absent on every row written before answer kinds existed, and
            // absent means `action`, the only kind there was. Rows are never
            // migrated, so the default is applied where they are read.
            return [row.answerKind ?? 'action'];
        default: {
            const value = SCALAR_READERS[dimension](row);
            return value === undefined ? [] : [value];
        }
    }
}

/** Attempts cut by one dimension: spots, wrong answers and rate per value, in the dimension's order. */
export function crosstab(
    rows: readonly AttemptRow[],
    dimension: Dimension,
    minAttempts: number = MIN_ATTEMPTS,
): Cell[] {
    const buckets = new Map<string, { attempts: number; errors: number; byErrorClass: Partial<Record<ErrorClass, number>> }>();

    for (const row of rows) {
        for (const key of valuesFor(row, dimension)) {
            const bucket = buckets.get(key) ?? { attempts: 0, errors: 0, byErrorClass: {} };
            bucket.attempts += 1;
            if (!row.correct) {
                bucket.errors += 1;
                bucket.byErrorClass[row.errorClass] = (bucket.byErrorClass[row.errorClass] ?? 0) + 1;
            }
            buckets.set(key, bucket);
        }
    }

    return [...buckets.entries()]
        .map(([key, bucket]) => ({
            key,
            attempts: bucket.attempts,
            errors: bucket.errors,
            rate: bucket.errors / bucket.attempts,
            byErrorClass: bucket.byErrorClass,
            significant: bucket.attempts >= minAttempts,
        }))
        .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts || (a.key < b.key ? -1 : 1));
}

/**
 * Lower bound of the Wilson score interval.
 *
 * Used instead of the raw rate so a cell has to EARN its place on the leak
 * list. Two errors out of two is a raw rate of 100% and a Wilson lower bound of
 * about 34%; twenty out of thirty is a raw rate of 67% and a lower bound near
 * 49%. Ranking by the bound puts the second one first, which is the honest
 * order.
 */
export function wilsonLowerBound(successes: number, total: number, z = 1.96): number {
    if (total === 0) return 0;
    const p = successes / total;
    const z2 = z * z;
    const centre = p + z2 / (2 * total);
    const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
    return Math.max((centre - spread) / (1 + z2 / total), 0);
}

export interface Leak extends Cell {
    /** Wilson lower bound on the error rate. The ranking key. */
    readonly confidentRate: number;
    /** How much worse than the overall rate, in points. */
    readonly excess: number;
}

/**
 * Cells that are genuinely worse than this user's own baseline.
 *
 * Compared against the reader's overall error rate rather than an absolute
 * threshold: someone at 20% overall has a different idea of "bad" from someone
 * at 55%, and an absolute cut would tell the first everything is fine and the
 * second that everything is broken.
 */
export function findLeaks(
    rows: readonly AttemptRow[],
    dimension: Dimension,
    minAttempts: number = MIN_ATTEMPTS,
): Leak[] {
    if (rows.length === 0) return [];
    const baseline = rows.filter((row) => !row.correct).length / rows.length;

    return crosstab(rows, dimension, minAttempts)
        .filter((cell) => cell.significant)
        .map((cell) => ({
            ...cell,
            confidentRate: wilsonLowerBound(cell.errors, cell.attempts),
            excess: cell.rate - baseline,
        }))
        .filter((cell) => cell.confidentRate > baseline)
        .sort((a, b) => b.confidentRate - a.confidentRate);
}

/**
 * The dimensions worth ASKING for a leak in.
 *
 * `errorClass` is excluded and the exclusion is not a preference. A cell's
 * error rate is `errors / attempts`, and on that dimension every value except
 * `correct` is by construction 100% wrong — so it would report a confident leak
 * on every mistake a reader has ever made, out-score every real finding, and
 * open this page on a tautology. It is still a perfectly good CUT, which is
 * where it stays; it is just not a thing to be worse at.
 */
export const LEAK_DIMENSIONS: readonly Dimension[] =
    DIMENSIONS.filter((dimension) => dimension !== 'errorClass');

/**
 * The worst leak on each dimension that has one.
 *
 * The page used to open on `stackBracket` and mark nothing, so a reader had to
 * try dimensions until something looked bad — while this answer was computable
 * for every one of them the whole time. `findLeaks` already sorts by confidence
 * and already refuses to call anything a leak below `MIN_ATTEMPTS`, so this only
 * has to ask it thirteen times and keep the heads.
 */
export function topLeaks(rows: readonly AttemptRow[]): Map<Dimension, Leak> {
    const found = new Map<Dimension, Leak>();
    for (const dimension of LEAK_DIMENSIONS) {
        const [worst] = findLeaks(rows, dimension);
        if (worst !== undefined) found.set(dimension, worst);
    }
    return found;
}

/**
 * The single clearest gap, or nothing.
 *
 * "Nothing" is a real answer and says so on screen: with fewer than
 * `MIN_ATTEMPTS` anywhere, or with a reader who is evenly good, there is no
 * dimension to open on and the page keeps its default.
 */
export function leakiestDimension(
    rows: readonly AttemptRow[],
): { readonly dimension: Dimension; readonly leak: Leak } | null {
    let best: { dimension: Dimension; leak: Leak } | null = null;
    for (const [dimension, leak] of topLeaks(rows)) {
        // Strictly greater, so a tie keeps the earlier dimension and the page
        // opens on the same one twice for the same history.
        if (best === null || leak.confidentRate > best.leak.confidentRate) {
            best = { dimension, leak };
        }
    }
    return best;
}

export interface MatrixCell extends Cell {
    readonly row: string;
    readonly column: string;
}

/** Every (row, column) cell an attempt lands in; more than one where a dimension is set-valued. */
function cellKeys(row: AttemptRow, rowDimension: Dimension, columnDimension: Dimension): { rowKey: string; columnKey: string }[] {
    const columns = valuesFor(row, columnDimension);
    return valuesFor(row, rowDimension).flatMap((rowKey) => columns.map((columnKey) => ({ rowKey, columnKey })));
}

/** Two dimensions at once, for the heatmap. */
export function crosstab2(
    rows: readonly AttemptRow[],
    rowDimension: Dimension,
    columnDimension: Dimension,
    minAttempts: number = MIN_ATTEMPTS,
): MatrixCell[] {
    const groups = new Map<string, { rowKey: string; columnKey: string; group: AttemptRow[] }>();
    for (const row of rows) {
        for (const { rowKey, columnKey } of cellKeys(row, rowDimension, columnDimension)) {
            const key = `${rowKey}\u0000${columnKey}`;
            const existing = groups.get(key);
            if (existing === undefined) groups.set(key, { rowKey, columnKey, group: [row] });
            else existing.group.push(row);
        }
    }

    return [...groups.entries()].map(([key, { rowKey, columnKey, group }]) => {
        const errors = group.filter((row) => !row.correct).length;
        const byErrorClass: Partial<Record<ErrorClass, number>> = {};
        group.forEach((row) => {
            if (row.correct) return;
            byErrorClass[row.errorClass] = (byErrorClass[row.errorClass] ?? 0) + 1;
        });

        return {
            row: rowKey,
            column: columnKey,
            key,
            attempts: group.length,
            errors,
            rate: errors / group.length,
            byErrorClass,
            significant: group.length >= minAttempts,
        };
    });
}

export interface OverallSummary {
    readonly attempts: number;
    readonly correct: number;
    readonly rate: number;
    readonly medianLatencyMs: number;
}

/**
 * A latency as a reader reads it.
 *
 * One definition, because the verdict now prints the spot's own time against
 * the reader's median and Review prints the median on its own — two screens
 * quoting the same measurement, which have to agree to the decimal or the
 * comparison the verdict is making stops being checkable.
 */
export const secondsLabel = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** The middle value, or the mean of the two middle values; 0 for no values. */
function medianOf(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const upper = sorted[middle];
    if (upper === undefined) return 0;
    const lower = sorted[middle - 1];
    return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}

/** The whole history at a glance: attempts, correct, rate and median latency. */
export function summarise(rows: readonly AttemptRow[]): OverallSummary {
    if (rows.length === 0) return { attempts: 0, correct: 0, rate: 0, medianLatencyMs: 0 };
    const correct = rows.filter((row) => row.correct).length;
    return {
        attempts: rows.length,
        correct,
        rate: correct / rows.length,
        medianLatencyMs: medianOf(rows.map((row) => row.latencyMs)),
    };
}
