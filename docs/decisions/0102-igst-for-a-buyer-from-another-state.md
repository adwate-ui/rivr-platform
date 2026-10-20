# 0102: A buyer registered in another state is charged IGST, rounded once

Date: 2026-10-20 · Task: #380 (the owner's answer to #378, point 6)

An invoice to a buyer whose GSTIN's state code, its first two digits, differs from the venue's carries
IGST at the full rate and no CGST or SGST. As with CGST and SGST (decision 0071), the tax is taken out of
what was collected, never added on: IGST is the amount times the rate over one plus the rate, rounded
once to the nearest paisa, a half paisa up, and the taxable value is the rest. So an IGST invoice can
differ by a paisa from what CGST and SGST would have come to on the same amount.

Members buy without a GSTIN, so they stay on CGST and SGST, as does a company from the venue's own state.
The states are compared only when both GSTINs are known, so the local and staging seed gives the
practice venue a made-up Haryana GSTIN too: a trainee's invoice to another state shows IGST, though a
practice invoice never carries the GSTIN. `invoice.igst_paise` is the new column; an
invoice carries IGST or CGST and SGST, never both. `@rivr/domain` `igstIncluded` and the database's
`private.igst_included` are proved on the same golden cases in `packages/testing/golden/gst.json`.
#23's refusal of other-state buyers is gone.
