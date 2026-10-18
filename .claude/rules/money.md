---
paths:
  - "packages/domain/**"
  - "supabase/**"
  - "apps/console/src/features/cage/**"
  - "apps/console/src/features/markers/**"
  - "apps/tablet/**"
---

# Money and floor rules

- Integer paise in `bigint`, only through `@rivr/domain/money`. Never floats.
- Rake: 5% of the pot, capped per table type, rounded down to ₹50. Jackpot drop and pull use the same increment.
- Double-entry ledger. A balance is a sum of entries. Entries are immutable; corrections are reversing entries. Every money function asserts its entries sum to zero.
- Idempotency keys on buy-in, cash-out, hand, marker, payout, withdrawal and invoice writes, enforced by a unique constraint.
- Configuration with `effective_from`: rake, caps, call time, TDS, GST, bonuses, credit limits, priority weights. A transaction uses the rule in force at its timestamp.
- Venue configuration holds legal entity name, GSTIN, address, UPI payee and VPA, bank details and invoice prefix. Never hard-code them.
- Store times in UTC; display IST.
- Second approver above configured limits, enforced in the database.
- Kill switch: every write function checks `control_state` first and refuses when frozen.
- When SQL must compute money, write a SQL function and a golden test proving it equals `@rivr/domain` on the same cases.

## Tests required for every change here
- Golden fixtures in `packages/testing/golden/`, readable by a non-engineer, covering normal, cap and ₹50-rounding edge cases.
- Property tests (fast-check) for invariants: entries balance, idempotent replay changes nothing, jackpot pool equals drops less payouts.
- Mutation score at least 80% (Stryker) on `money`, `rake`, `callTime`, `tds`, `gst`, `markers`, `payouts`.
- Ask the `money-auditor` subagent to recompute three cases by hand before opening the PR.
