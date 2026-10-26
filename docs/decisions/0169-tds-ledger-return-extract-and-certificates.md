# 0169: The TDS ledger, the quarterly return extract and certificate data

Date: 2026-10-26 · Task: #93 (scope-v1 module 5) · Question: #455

**Ledger.** The withholding ledger gives each member's TDS over any run of days in India time, from the `tds_withholding` rows decision 0068 records:
- the cash-outs and what they paid;
- what was withheld;
- what would have been, as shadow, while TDS was switched off.

Ledger readers see it, with only the last four characters of a PAN.

**Extract.** The quarterly return extract lists every deduction withheld in an Indian financial-year quarter. Those quarters are the calendar's: April, July, October and January.
- **Each row:** the member's full PAN (`PANNOTAVBL` without one, as the return expects), the section, the winnings that deduction was taxed on, the rate and the TDS.
- **The PAN:** it comes from the member's identity check even if that check has since been reopened, because the deduction was made against it.
- **Not in it:** shadow TDS, which was never deducted.
- **Which amount is "paid":** the owner answered question #455: each deduction's own taxed winnings. That is the period's winnings at its cash-out above the most already taxed earlier in the period, never below nothing (@rivr/domain `tdsTaxedWinnings`, twin `private.tds_taxed_winnings`, golden `tdsReturn.json`). A period's deductions then add up to what it won. The cash-out column is not in the extract. The owner's accountant confirms before the first filing.
- **Who and how:** it is for staff who export tables (`exports.table`). Where a venue keeps money work to its computers (#384), that permission is held to the admin computer. Each extract taken is a named entry in the audit log. The practice venue has none.
- **The file:** the console saves it as a UTF-8 CSV with a byte-order mark, every cell quoted. A name that a spreadsheet would read as a formula is kept as text.

**TAN.** A TDS return and a certificate name the deductor by its TAN, so the venue configuration gains an optional `tan`, shown to staff like the GSTIN.

**Certificates.** Certificate data is a member's own TDS withheld, by venue, quarter and section, with the venue's name and TAN. Sessions shows it only when some was withheld, whatever the member's tier: every member TDS was withheld from is owed it, so it is not a tier-gated feature. Form 16A itself comes from TRACES and is not made here.
