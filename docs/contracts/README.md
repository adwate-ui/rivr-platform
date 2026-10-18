# Lane contracts

Four lanes build in parallel from 19 Oct: A money, B floor, C member and web, D growth and content. Each contract says what a lane owns and what it offers the others, so two lanes never edit the same file and never guess at each other's interfaces. The schema foundation, these contracts and the task issues froze when Lane 0 merged. A lane changes another lane's contract, or the foundation, only through a `question` issue that the reviewer session decides.

- [Lane A: money](lane-a.md)
- [Lane B: floor](lane-b.md)
- [Lane C: member and web](lane-c.md)
- [Lane D: growth and content](lane-d.md)

## Rules every lane follows

- **Tables.** A lane creates and migrates only the tables it owns. Every table follows `.claude/rules/database.md`: `venue_id`, timestamps, RLS with default deny, grants, pgTAP tests including another venue and the practice venue. `supabase/tests/001_schema_rules.test.sql` fails a table that forgets.
- **Calling another lane.** A lane calls another lane only through the functions in that lane's contract, never by reading or writing its tables. Function signatures in a contract are stable; a change goes through a `question` issue.
- **Money.** Every rupee moves through `private.post_ledger_transaction` with an idempotency key, using the account codes in [the chart of accounts](#chart-of-accounts). Write functions call `private.assert_writable` first. Money rules live in `@rivr/domain`; when SQL computes money it has a golden test against domain.
- **Events.** A business event writes one `outbox_event` row through `private.emit` in the same transaction. Event types are `area.past_tense` (`hand.logged`). The emitting lane lists them in its contract; consumers list what they consume.
- **Member-facing features.** Each has a key in `packages/contracts/src/features.ts` (and a migration inserting it), a `FeatureGate` in the app, and `private.has_feature` in its policies and write functions.
- **Settings.** Rules that change over time are setting keys (`packages/contracts/src/settings.ts` and a migration), read with `private.setting_at(venue, key, subject, at)` at the transaction's own time.
- **Apps.** A lane owns the feature folders listed in its contract, in whichever app they sit. Shared files (an app's `router.tsx`, `packages/ui/src/index.ts`, catalogue `index.ts` files) take one-line additions; rebase rather than reformat them.
- **Copy.** Each feature area gets its own catalogue namespace file in `packages/i18n/src/catalogue/{en,hi}/`, registered in both `index.ts` files.
- **UI.** Anything visible comes from `@rivr/ui`; a lane adds the components it needs with the `new-ui-component` skill. If two lanes need the same new component, the first to need it builds it and the other waits on that issue.

## The Lane 0 foundation (all lanes use; nobody changes without a question issue)

| Area | Tables | Functions |
|---|---|---|
| Venues | `venue`, `venue_config` | `private.bootstrap_venue` (operations only) |
| Staff and access | `staff`, `staff_credential`, `role_permission`, `device` | `private.venues_where(permission)`, `private.staff_venues()`, `private.has_permission(venue, permission)`, `private.current_staff_id(venue)`, `private.current_device_id()` |
| Members and tiers | `member`, `tier` | `private.current_member_id()`, `private.current_member_venue_id()` |
| Tier-gated features | `feature`, `tier_feature`, `member_feature_override` | `private.has_feature(member, key)`, `private.feature_state(member, key)`, `public.my_feature_access()` |
| Settings | `setting_key`, `setting` | `private.setting_at(venue, key, subject, at)` |
| Audit | `audit_log` | `private.audit(...)`, trigger `private.audit_row_change()` |
| Kill switch | `control_state` | `private.assert_writable(venue, feature?, member?)` (refusals `RVFRZ`, `RVKIL`, `RVMBR`), `private.is_messaging_stopped(venue)` |
| Outbox | `outbox_event`, `outbox_delivery` | `private.emit(venue, type, payload, key?)`, `public.claim_outbox_deliveries(...)`, `public.finish_outbox_delivery(...)` |
| Ledger | `ledger_account`, `ledger_transaction`, `ledger_entry`, `chip_denomination` | `private.post_ledger_transaction(...)`, `private.reverse_ledger_transaction(...)`, view `ledger_balance` |
| Public surfaces | views `public_venue`, `public_venue_status` | |

Packages: `@rivr/contracts`, `@rivr/domain` (money, ledger), `@rivr/db` (`useFeature`, `useControlState`, the client and provider), `@rivr/ui`, `@rivr/i18n`, `@rivr/adapters`, `@rivr/offline`, `@rivr/render`, `@rivr/testing`, `@rivr/drills`.

## Chart of accounts

Account codes posted to by each lane. Lane A owns the chart and adds accounts by migration; a lane needing a new account asks lane A in a `question` issue.

| Code | Kind | Created by | Posted to by |
|---|---|---|---|
| `member.cash` | liability, players' money | every member | A (cage, wallet, withdrawals), B (tournament entries from the wallet, through A's functions) |
| `member.bonus` | liability | every member | A, D (promotion effects through `private.credit_bonus`) |
| `member.points` | liability, points | every member | D (earning, redemption through `private.credit_points` and `private.debit_points`) |
| `member.receivable` | asset | every member | A (markers) |
| `venue.cash_drawer`, `venue.bank` | asset | bootstrap | A |
| `venue.chips_outstanding` | liability, players' money | bootstrap | A (buy-ins, cash-outs) |
| `venue.rake` | revenue | bootstrap | B (hands, through `private.post_hand`) |
| `venue.jackpot.main`, `.season`, `.freeroll` | liability, players' money | bootstrap | B (drops and payouts) |
| `venue.bonus_expense` | expense | bootstrap | A, D |
| `venue.points_issued` | expense, points | bootstrap | D |
| `venue.opening_balance`, `venue.points_opening_balance` | equity | bootstrap | seed and A (opening balances) |

Lane A adds the TDS payable, GST payable, tournament prize pool, fee revenue, overlay expense, expense and payment-account accounts in its migrations.
