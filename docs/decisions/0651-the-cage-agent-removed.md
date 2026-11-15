# 0651. The cage agent removed

The owner, 15 Nov: the cage agent goes, the program as a whole. It never ran at the club: production enrolled no agent, the `offline-packs` bucket never held a file, and one food and drink order has been placed since 12 Nov. Decisions 0260 and 0261 stay as the history of what it did.

- **Its two jobs go with it.** The nightly offline pack on the cage computer's disk, and printing each KOT on the bar printer as the outbox consumer `bar_printer`.
- **What replaces a printed KOT** is the console's Food and drink screen, as now: each order is on it the moment it is placed, in the lane To accept, and Service accepts, sends and delivers it from there.
- **Removed:** `apps/cage-agent`; the `cage-agent` Edge Function and its config; the database's `claim_agent`, `agent_device`, `claim_agent_kots`, `finish_agent_kot`, `offline_pack` and `offline_pack_venues`; the kitchen printer adapter (`kitchen-printer`, `kitchen-printer-escpos`); the offline pack's contract, template, component and nightly workflow (`offline-pack`, not a CI gate), which only the agent read; the incidents contract, whose contact kinds only the pack read; and the runbook.
- **Data.** Agents' devices and their enrolment codes are deleted. One the removed kill switch named is revoked instead, as `control_state` is never deleted. The device kind `agent` stays: no enum change.
- **Kept, with its reader:** the console's flag on a KOT the bar printer missed (`fnb_orders_tonight`, the Food and drink screen), which reads the `bar_printer` deliveries left in the outbox. Nothing writes one now, so it shows only for deliveries made before. The `offline-packs` bucket on the hosted projects is left as it is.
