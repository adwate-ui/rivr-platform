# 0237: AML alerts, audit rows and settings are for AML reviewers, and the alert number is a super admin's

Date: 2026-10-27 · Task: #492 · Questions: #484, #493 P8 (the owner's answers of 27 Oct)

**Why.** An AML alert or audit row names no member, but its time matches a cash buy-in in the ledger an investor can read, so an investor could work out who was flagged. And the structuring rule (count, window, margin) tells anyone who reads it how to stay under it.

**Hidden from staff without `aml.review`.** Super admins and admins hold it; investors, cashiers, dealers, hosts and marketing do not.
- Alerts of an `aml.` kind, on the owner dashboard and in `alert`.
- Their `alert.raised` events in the outbox, and those events' deliveries.
- Audit rows with an `aml.` action, about the register (`sar_entry`, `sar_entry_transaction`), about an AML alert, or about an `aml.` setting.
- `aml.` settings, unless the staff member configures the venue (`venue.configure`).

**The alert WhatsApp number.** Every alert, AML ones included, goes to `venue_config.alert_whatsapp`. The owner chose to keep it that way: the number must belong to a super admin, never an investor. `docs/runbooks/create-a-venue.md` carries this as a step.

**Accepted.** The owner dashboard's realtime signal still fires on an AML alert, and hidden audit rows leave gaps in the audit ids. Neither names anything.
