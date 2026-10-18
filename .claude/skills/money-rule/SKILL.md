---
name: money-rule
description: Add or change a rule that computes money, time-based obligations or points (rake, call time, bonus, TDS, GST, markers, payouts, jackpot, points).
---

# Money rule

1. Write the rule in words in the PR: inputs, output, rounding, caps, effective date.
2. Add golden fixtures in `packages/testing/golden/<rule>.json`: at least one normal case, one at the cap, one at a ₹50 rounding boundary, one with zero.
3. Add property tests for the invariant the rule must keep.
4. Implement in `packages/domain/src/<rule>/`, pure functions, `Result` for expected failures.
5. If SQL also needs it, add the SQL function and its section in `supabase/tests/024_golden_twins.test.sql`, which runs it on every case of the same golden file (decision 0037). Never copy the cases into SQL by hand.
6. Run Stryker on the module; the mutation score must stay at or above 80%.
7. Ask `money-auditor` to recompute three fixtures by hand from the rule in words.
