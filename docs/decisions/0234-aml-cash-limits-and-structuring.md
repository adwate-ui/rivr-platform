# 0234: AML cash limits refuse at the cage, and structuring opens a register entry

Date: 2026-10-27 · Task: #105 (scope-v1 module 12)

**Cash in** (the owner's answers, 27 Oct). Cash in is a cash buy-in at the cage, or a tournament entry paid in cash at the cage. UPI, the wallet and marker repayments are not counted. `private.aml_cash_in` reads both, each with its visit: a buy-in by its seat's visit, a tournament entry by the visit open when it was paid.

**Limits.** `cage.cash_buy_in_limit` sets the most cash in for one visit and for one club day (06:00 to 06:00 IST). Cash in past either is refused, the visit's named first (`RVCLV`, `RVCLD`), and the cashier is told to take UPI or the wallet instead. Reaching a limit exactly is within it; nothing (or no setting) is no limit. Triggers on `cage_transaction` and `tournament_purchase` check it, one member at a time. Only a super admin changes the AML settings, with a reason, and the owner is alerted on every change (`aml.settings_changed`).

**Structuring.** A visit, or club day, ended just under a limit when its cash in came within the margin of it: 10%, rounded down to the paisa, the limit included. When cash in makes its own visit (or day) such a one, and enough of them began within the window (3 in 7 days unless `aml.structuring` says otherwise), the register gets an entry with their cash in attached and the owner is alerted. While it is open, later cash in of the pattern joins it. A visit (or day) already reviewed opens no new entry; the next one does. The rules are `@rivr/domain/aml` and their SQL twins, proved against `golden/aml.json`.

**Review and tipping off.** Staff with `aml.review` close an entry once, with an outcome (no action, monitor or reported) and a note of 10 to 1,000 characters. The audit log records that an entry was made and reviewed, with its kind and outcome, never the member or the note. The member's own data export (0232) leaves the register out; the full archive keeps it. Entries are never deleted, and member erasure keeps them by id.

**Not here.** Source-of-funds flags and `aml_flag` are not in #105's acceptance list.
