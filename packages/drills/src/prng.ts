/**
 * Seeded randomness.
 *
 * A drill scenario has to be reproducible from its seed — that is what lets an
 * attempt be replayed, a validator failure be shown to the author, and a
 * property test shrink to a case you can paste into a bug report. `Math.random`
 * gives none of that, and nothing in this package may call it.
 *
 * mulberry32 for the stream, splitmix32 to decorrelate seeds, cyrb128 to turn a
 * string into one. All three are public-domain, ~10 lines each, and chosen over
 * a dependency because the whole point is that the sequence is auditable.
 *
 * `>>> 0` everywhere is not decoration: JavaScript bitwise operators produce
 * SIGNED 32-bit results, and a negative intermediate turns the arithmetic below
 * into a different generator than the published one.
 */

/** A seeded stream. Deterministic in the seed and in nothing else. */
export interface Rng {
    /** Uniform in [0, 1). */
    next(): number;
    /** Uniform integer in [0, maxExclusive). Throws below 1. */
    nextInt(maxExclusive: number): number;
    /** Uniform choice. Throws on an empty array. */
    pick<T>(items: readonly T[]): T;
    /** A new array, Fisher–Yates shuffled. Does not mutate its input. */
    shuffle<T>(items: readonly T[]): T[];
}

export class EmptyPickError extends Error {
    constructor() {
        super('Cannot pick from an empty array');
        this.name = 'EmptyPickError';
    }
}

export class RangeTooSmallError extends Error {
    constructor(readonly maxExclusive: number) {
        super(`nextInt needs a bound of at least 1, got ${maxExclusive}`);
        this.name = 'RangeTooSmallError';
    }
}

/** Mixes a 32-bit seed so that 1 and 2 do not produce visibly related streams. */
export function splitmix32(seed: number): number {
    let z = (seed + 0x9e3779b9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
}

/**
 * Hashes a string to a 32-bit seed.
 *
 * Used for `deriveSeed('principle-id', attempt)`, so two principles drilled in
 * the same session do not walk the same sequence of boards.
 */
export function cyrb128(input: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i += 1) {
        h = Math.imul(h ^ input.charCodeAt(i), 16777619) >>> 0;
    }
    return splitmix32(h);
}

/** Combines any mix of strings and numbers into one seed, order-sensitively. */
export function deriveSeed(...parts: readonly (string | number)[]): number {
    let seed = 0x811c9dc5 >>> 0;
    for (const part of parts) {
        const contribution = typeof part === 'number' ? splitmix32(part >>> 0) : cyrb128(part);
        seed = splitmix32((seed ^ contribution) >>> 0);
    }
    return seed >>> 0;
}

/**
 * Whether `index` lies inside `items`, narrowing the element read there.
 *
 * An in-bounds read of a dense array is the element itself (which is
 * `undefined` only if `T` allows it), so this is the bounds check the type
 * checker cannot make on its own. Kept a plain comparison: `pick` and
 * `shuffle` sit inside the generator's hottest loops.
 */
function isInBounds<T>(items: readonly T[], index: number, _item: T | undefined): _item is T {
    return index >= 0 && index < items.length;
}

/** Two elements of `out` swapped in place. */
function swap<T>(out: T[], i: number, j: number): void {
    const a = out[i];
    const b = out[j];
    if (!isInBounds(out, i, a) || !isInBounds(out, j, b)) throw new RangeError(`cannot swap ${i} and ${j}`);
    out[i] = b;
    out[j] = a;
}

/** A seeded stream: mulberry32 over a splitmix32-mixed seed. */
export function makeRng(seed: number): Rng {
    let state = splitmix32(seed >>> 0);

    const nextUint32 = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
        t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
        return (t ^ (t >>> 14)) >>> 0;
    };

    const next = (): number => nextUint32() / 4294967296;

    /**
     * Rejection sampling, not `Math.floor(next() * n)`.
     *
     * The naive form is biased whenever n does not divide 2^32: the low
     * remainder of values map to one extra outcome each. Nothing about a
     * fixed-seed test can see that — the sequence is still perfectly
     * reproducible — so the only symptom would be the drill quietly serving
     * some positions more often than others, forever, and an accuracy
     * cross-tab built on a skewed sample. Cheap to do right, invisible when
     * done wrong, so it is done right.
     */
    const nextInt = (maxExclusive: number): number => {
        if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
            throw new RangeTooSmallError(maxExclusive);
        }
        const limit = 4294967296 - (4294967296 % maxExclusive);
        let value = nextUint32();
        while (value >= limit) value = nextUint32();
        return value % maxExclusive;
    };

    const pick = <T,>(items: readonly T[]): T => {
        if (items.length === 0) throw new EmptyPickError();
        const index = nextInt(items.length);
        const item = items[index];
        if (!isInBounds(items, index, item)) throw new EmptyPickError();
        return item;
    };

    const shuffle = <T,>(items: readonly T[]): T[] => {
        const out = [...items];
        for (let i = out.length - 1; i > 0; i -= 1) {
            swap(out, i, nextInt(i + 1));
        }
        return out;
    };

    return { next, nextInt, pick, shuffle };
}
