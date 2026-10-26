# 0189: A partner's statement is their share of the month's net result

Date: 2026-10-26 · Task: #98

**What.** Tech plan item 23: a monthly PDF per partner and investor from the ledger and the register. A super admin (`shareholding.manage`) chooses a club month on the Shareholders screen. Each holder with a holding on the month's last day (decision 0170) is listed with their share, and their statement opens with Save as PDF. `@rivr/render` draws the same document (`document.partnerStatement`) to PDF. Edge Functions run Deno without a browser, so no Edge Function draws it: sending statements by themselves each month is a Node job on `@rivr/render`, built when the owner wants them sent.

**The figures.** The month's revenue and expenses by account and its net result come from the month's MIS (decision 0188), so the statement and the MIS agree. Before the MIS is stored on the 1st, the statement says it is provisional.

**The share.** `@rivr/domain` `holderShare`: the net result times the holding in basis points, rounded towards nothing to the paisa (golden `holderShare.json`). A loss is shared as a profit is. The holding is the one in force on the month's last day; a holding that changed mid-month is not prorated, as decision 0170 set out.

**The document.** `@rivr/ui` `PartnerStatementDocument`, an A4 page like the invoice: holder, month, holding, the club's revenue and expenses, the net, and the share. The console prints it on an A4 `PrintSheet`, so Save as PDF holds the statement alone.

**Not here.** Distributions paid to partners are not recorded, so a statement shows the month's share, not a running balance. The practice venue has no statements.
