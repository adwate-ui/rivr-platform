# Lane A: money

Ledger rules, cage, wallet, withdrawals, markers and credit, TDS, GST, treasury and the end-of-day close, expenses and payment accounts, Tally, statements and the shareholding register, the owner dashboard and alerting, backups and restore, exports and purge, the kill-switch control, AML, staff rosters, the console Tiers screen, rakeback and accommodation rewards. Money paths get line-by-line review and golden tests (`.claude/rules/money.md`).

## Tables owned

| Table | Purpose |
|---|---|
| `cage_transaction` | Buy-ins and cash-outs at the cage: method (cash, UPI with UTR, wallet, marker), amount, member, ledger transaction, idempotency key, second approver |
| `buy_in_request` | A buy-in the dealer tablet or the floor sends to the cage queue (lane B inserts through `public.request_buy_in`) |
| `payout_account` | A member's verified UPI or bank payout accounts |
| `withdrawal_request` | Withdrawals from the app: status, approver, second approver, UTR |
| `credit_line`, `marker` | Limits per member, markers issued against them, repayment, ageing, the room exposure cap. `credit_line` (#73, decision 0058): the limit in whole ₹50 chips and any raise waiting for a second super admin, with who set, proposed and approved it; seen by staff who set limits, issue markers or read the ledger |
| `tds_withholding` | TDS computed on each cash-out and tournament prize, in force or shadow, with certificate data |
| `invoice_series`, `invoice` | GST tax invoices per venue, numbered per series |
| `chip_inventory_count`, `eod_close` | Chip counts by denomination, float, chips in play, the end-of-day close and its anomalies |
| `expense_category`, `expense`, `payment_account`, `account_transfer` | Expenses with approver and attachments; cash drawer, UPI handles and bank accounts as ledger accounts |
| `tally_mapping`, `tally_export` | Ledger-to-Tally voucher mapping and the daily export files |
| `shareholding`, `holder_statement` | Partners and investors, effective-dated holdings, monthly statements |
| `aml_flag`, `sar_entry` | Cash limits, structuring flags and the suspicious-activity register |
| `staff_shift`, `staff_attendance`, `onboarding_item` | Rosters, shifts and attendance by job title; onboarding checklists linked to SOP acknowledgements (lane B owns SOPs) |
| `export_job`, `purge_run` | Every export and purge, audited |
| `alert` | Alerts for the owner dashboard and the alert WhatsApp number |
| `accommodation_rate` | Hours of play per hotel night by stake, for accommodation rewards |
| `glaza_import_line`, `glaza_statement` | Monthly F&B CSV import from Glaza, matched to visits; statements |

## Functions offered to other lanes

| Function | Used by | What it does |
|---|---|---|
| `public.cage_buy_in(venue, member, amount, method, idempotency_key, utr?, buy_in_request?)` | console (A) | Chips out to a seated member for cash, UPI (12-digit UTR, once) or wallet cash, by @rivr/domain `buyIn` and its SQL twin `private.buy_in_check` (golden `cage.json`): whole ₹50 chips, at least the table's minimum, no more than the wallet; refuses without KYC (`RVKYC`), on a break (`RVBRK`), frozen, not seated (`RVNST`); completes a waiting request; one balanced ledger transaction per request id; emits `cage.buy_in` (#57). Markers (#74) and promotions at buy-in (lane D) follow |
| `public.request_buy_in(session, amount, idempotency_key)`, `public.decline_buy_in_request(request)`, `public.cage_queue(venue)`, `public.cage_members(venue, query)` | floor and dealer tablet (B), console (A) | The table asks the cage for chips for a seated player (the floor, or the tablet at that table, #59), one waiting per seat (`RVPND`, decision 0056); a cashier declines (not while frozen); the queue, of players still in the seat that asked, with each member's KYC photo; approving a request from a seat the player has left is `RVSTL`; members found by name or mobile with KYC, wallet, bonus, markers, seat and the table's minimum (#57) |
| `public.set_credit_limit(venue, phone, limit, reason)`, `public.decide_credit_limit(line, approved, expected_limit)`, `public.credit_lines(venue)`, `public.credit_room(venue)` | console (A) | A floor manager (`markers.manage_limits`) sets a limit, in force up to `credit.config`'s approval threshold or when it is a cut, a raise above it waiting for a super admin other than the one who asked (decision 0058); no credit without `credit.config` (`RVCFG`); never before a finished identity check (`RVKYC`) and the minimum visits (`RVVIS`); whole chips (`RVCHP`); not while credit is switched off or frozen. A super admin approves or declines the amount they were shown of another's waiting limit (`RVSTL` if it changed). The lines and the room's exposure (every `member.receivable`) against its cap (#73) |
| `public.issue_marker(venue, member, amount, signature_svg, idempotency_key)`, `public.open_markers(venue)` | console (A) | A cashier (`markers.issue`) issues chips on credit to a seated member who signed (`RVSIG`), once per request id: posted to `member.receivable`, never the wallet, against chips outstanding; refused while one of their markers is past due (`RVDUE`), above their limit (`RVLIM`) or the room's cap (`RVEXP`), not whole chips (`RVCHP`), credit not set up (`RVCFG`) or switched off, and as the cage refuses chips (KYC, a break, frozen, not seated); due `markers.due_days` after issue; emits `marker.issued`. Open markers oldest first with age, due date and limit (#74) |
| `public.cage_cash_out(venue, member, amount, to, idempotency_key)` (`is_final` with #76) | console (A) | Settles open markers first, oldest first, then pays the rest in cash or to the wallet in one ledger transaction, once per request id, for a member checked in; gives the cage transaction, what it settled and what the member got; emits `cage.cash_out`, and `marker.settled` for each marker paid off (#75; `RVCHP`, `RVKYC`, `RVOUT`, frozen); computes TDS (#22), checks call time (`private.call_time_shortfall`, lane B) and needs an admin override with a reason when short; a final cash-out closes the visit (`private.close_visit`, lane C) |
| `private.debit_wallet(venue, member, amount, reason, idempotency_key)` | B (tournament entries) | Moves cash balance to the venue; refuses when insufficient, frozen or excluded |
| `private.credit_wallet(venue, member, amount, reason, idempotency_key)` | B (prizes, jackpot payouts) | Credits cash after TDS |
| `private.credit_bonus(venue, member, amount, reason, expires_at, idempotency_key)` | D (promotions) | Credits playable, non-withdrawable bonus |
| `private.tds_for(venue, member, winnings, at)` | B (tournament prizes) | TDS amount in force (or shadow amount) for winnings at a time |
| `public.request_withdrawal(...)`, `public.approve_withdrawal(...)` | player app (C screens), console (A) | Withdrawals to verified payout accounts; second approver above the configured limit; emits `withdrawal.sent` |
| `public.engage_control(...)`, `public.release_control(...)` | console (A) | Kill-switch levels; release needs a reason and, for a venue freeze, a second super admin; emits `control.engaged` / `control.released` and an alert |
| `private.raise_alert(venue, kind, detail)` | all | An owner-dashboard alert, and WhatsApp to the alert number |

## Events

- Emits: `cage.buy_in`, `cage.cash_out`, `withdrawal.requested`, `withdrawal.sent`, `marker.issued`, `marker.settled`, `invoice.issued`, `eod.closed`, `control.engaged`, `control.released`, `alert.raised`.
- Consumes: `hand.logged` (rake reports), `visit.closed` (hours for rakeback and accommodation), `tournament.finished` (overlay booking).

## Uses from other lanes

- C: `private.is_kyc_complete(member)`, `private.member_restrictions(member, at)` (limits, cool-off, self-exclusion), `private.close_visit(member, at, reason)`.
- B: `private.call_time_shortfall(member, at)`, `buy_in_request` rows through `public.request_buy_in`.
- D: `private.evaluate_promotions(venue, trigger, context)` at buy-in.

## Screens

Console: `features/cage`, `features/markers`, `features/treasury`, `features/end-of-day`, `features/withdrawals`, `features/expenses`, `features/reports`, `features/owner-dashboard`, `features/admin` (kill switch, exports, purge, devices, staff, rosters, tiers matrix and overrides, venue configuration). Player app: `features/balance` (with lane C's shell). Feature keys: `balance.deposits`; core keys for the balance view and withdrawals.

## Settings keys added

`cage.second_approver_threshold`, `cage.cash_buy_in_limit`, `tds.config` (switch, rate, threshold, basis), `gst.config` (rate, basis), `credit.config` (approval threshold, minimum visits, exposure cap; decision 0058), `markers.due_days`, `bonus.expiry_days`, `rakeback.rate` (by stake), `accommodation.hours_per_night` (by stake), `alert.thresholds`.
