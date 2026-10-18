import { describe, it, expect } from 'vitest';
import { PERFECT_SCORE_MIN, perfectScoreTrips } from './perfectScore.ts';

describe('the perfect-score convention', () => {
    it('trips on a perfect raw pass rate over a meaningful corpus', () => {
        expect(perfectScoreTrips({ passRate: 1, scored: 48, accuracyOnMatched: 1, matched: 48 }))
            .toHaveLength(2);
    });

    /**
     * The regression this file exists for: the post-revert corpus reads
     * accuracyOnMatched 1.0 over 33 matched hands while coverage failures
     * dilute the raw rate to 67.3% — and the first version of the guard,
     * keyed on passRate alone, waved it through. A guard that watches the
     * metric being deprecated cannot protect the metric that replaced it.
     */
    it('trips on perfect matched accuracy even when coverage dilutes the raw rate', () => {
        const trips = perfectScoreTrips({ passRate: 0.673, scored: 49, accuracyOnMatched: 1, matched: 33 });
        expect(trips).toHaveLength(1);
        expect(trips[0]).toContain('accuracy on matched');
        expect(trips[0]).toContain('33');
    });

    it('does not trip below the minimum on either denominator', () => {
        expect(perfectScoreTrips({ passRate: 1, scored: PERFECT_SCORE_MIN - 1, accuracyOnMatched: 1, matched: PERFECT_SCORE_MIN - 1 }))
            .toHaveLength(0);
    });

    it('does not trip on believably imperfect numbers', () => {
        expect(perfectScoreTrips({ passRate: 0.87, scored: 48, accuracyOnMatched: 0.94, matched: 33 }))
            .toHaveLength(0);
    });

    it('each condition reads its own denominator', () => {
        // Perfect matched accuracy over a thin matched set does not trip even
        // when the scored corpus is large...
        expect(perfectScoreTrips({ passRate: 0.3, scored: 50, accuracyOnMatched: 1, matched: 15 }))
            .toHaveLength(0);
        // ...and a perfect raw rate trips on scored size alone (matched is
        // never larger than scored when the rate is 1, but the guard must not
        // depend on that arithmetic holding).
        expect(perfectScoreTrips({ passRate: 1, scored: 20, accuracyOnMatched: 0.99, matched: 20 }))
            .toHaveLength(1);
    });
});
