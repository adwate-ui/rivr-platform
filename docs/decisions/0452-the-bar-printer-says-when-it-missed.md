# 0452: The bar printer says when it missed a KOT

Date: 3 Nov 2026. Console v3, phase 5 (Food and drink). "Not at the bar yet" read as a delay; staff could not tell a slow bar from a KOT that never printed.

- **The flag** is `kot_print_failed` on `fnb_orders_tonight` (migration 20261107400000): the order's `fnb.ordered` event at its venue has a `bar_printer` delivery that failed after an attempt, or was closed unprinted as too old, and the order was not handed over, accepted, delivered or voided (an accepted order is at the bar). It comes from the outbox consumer's own state, never from a timer. A retry that is printing clears it; a retry that fails sets it again.
- **The card** then says "The bar printer did not get this KOT. Print it or read it to the bar.", with Print KOT (a receipt-width KOT on this computer's printer: the table, seat and lines, never the member's name, as the bar printer's own KOT; it does not mark the KOT handed over) and Bar has it (`mark_kot_sent`, for everyone who serves, fnb.manage or fnb.serve, as the database allows).
- **No agent at all** leaves the delivery pending, so no flag shows. Whether "no agent online" needs its own line is a follow-up.
- The practice venue still never reaches the bar printer: its agent claims nothing (pgTAP `310_kot_print_failed`).
- The orders sit in three lanes (To accept, Being prepared, Delivered tonight); void orders leave the lanes. A new order picks the table, then the seat with who sits there.
