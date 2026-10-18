/**
 * The Clopper–Pearson interval: what a small out-of-sample count can claim.
 *
 * Every out-of-sample rate is printed with this interval beside it, because
 * 6/7 is an 85.7% that a 95% interval puts at [42.1%, 99.6%]: the ratio alone
 * invites a confidence the sample cannot support.
 *
 * "Exact" rather than a normal approximation, which is worthless at n = 7. The
 * bounds are the success probabilities at which observing this few, or this
 * many, successes becomes a tail event of size α/2 — found by bisection on the
 * binomial distribution function, which for integer counts is a finite sum. No
 * continued fractions, no convergence loop, nothing that needs a guard.
 */

/** Lanczos coefficients, g = 7. */
const LANCZOS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) for x ≥ 1, which is every argument the binomial coefficient needs. */
function lnGamma(x: number): number {
    const z = x - 1;
    // The first coefficient stands alone; each later one is divided by z + i.
    const sum = LANCZOS.reduce((total, coefficient, i) => (i === 0 ? coefficient : total + coefficient / (z + i)), 0);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

const lnChoose = (n: number, k: number): number => lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);

/** P(X ≤ k) for X ~ Binomial(n, p), 0 < p < 1, summed in log space. */
function binomialCdf(k: number, n: number, p: number): number {
    let total = 0;
    for (let i = 0; i <= k; i += 1) {
        total += Math.exp(lnChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return total;
}

/**
 * The p in (0, 1) at which `binomialCdf(k, n, p)` equals `target`.
 *
 * The distribution function is strictly decreasing in p for 0 ≤ k < n, so a
 * hundred halvings of [0, 1] land within 2⁻¹⁰⁰ of the root; every probe is a
 * dyadic rational strictly inside the interval, so the log-space sum never
 * sees 0 or 1.
 */
function solveCdf(k: number, n: number, target: number): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 100; i += 1) {
        const mid = (lo + hi) / 2;
        if (binomialCdf(k, n, mid) > target) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** Refuses counts that are not a sample: the interval is undefined for them. */
function assertSample(k: number, n: number): void {
    const counts = Number.isInteger(n) && Number.isInteger(k);
    if (!counts || n < 1 || k < 0 || k > n) {
        throw new RangeError(`clopperPearson needs integers 0 <= k <= n with n >= 1, got k=${k}, n=${n}`);
    }
}

/**
 * The exact two-sided (1 − α) interval for `k` successes in `n` trials.
 *
 * `k = 0` has lower bound 0 and `k = n` upper bound 1 by definition, not by
 * numerics: no success probability is too small for zero successes.
 */
export function clopperPearson(k: number, n: number, alpha = 0.05): readonly [number, number] {
    assertSample(k, n);
    if (!(alpha > 0 && alpha < 1)) {
        throw new RangeError(`clopperPearson needs 0 < alpha < 1, got ${alpha}`);
    }
    const half = alpha / 2;
    // Lower bound: the p at which seeing at least k successes is a half-α event,
    // i.e. P(X ≤ k − 1) = 1 − α/2. Upper bound: at most k successes, P(X ≤ k) = α/2.
    const lower = k === 0 ? 0 : solveCdf(k - 1, n, 1 - half);
    const upper = k === n ? 1 : solveCdf(k, n, half);
    return [lower, upper];
}
