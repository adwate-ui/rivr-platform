# 0271: Re-checking KYC checks made in person

Date: 28 Oct 2026. Issue #259; follows #246 and the owner's answer to #237. Cashfree is the KYC vendor (owner, 28 Oct).

- **Once each.** The `kyc-recheck` function runs every minute. It claims each check made in person (`method = 'manual'`) that is verified and not yet re-checked. It runs the PAN and date of birth the reviewer entered, with the member's registered name, through the vendor's PAN check. The answer is stored on the check (`pan_recheck`, `pan_rechecked_at`), so the check is never asked about again.
- **A match keeps the check.** Any difference sends the check back to `needs_review`, which stops play until a reviewer decides. The difference can be a PAN the vendor does not know, another name or another date of birth. The queue gives the reason (`recheck_*`). A check approved again from the queue stays re-checked.
- **Trouble asks again.** A vendor that cannot answer (an outage, a refused or unconfigured call) never sends a check to review. Sending them would stop every member checked in person when a key rotates. The check is asked again with growing gaps (2, 4, 8, 16, 32 minutes, then hourly) until the vendor answers, so an outage or wrong keys never leave a check un-re-checked for good (review, 28 Oct).
- **Paused at a frozen venue, or with KYC switched off (`kyc_signup`).** A real venue's checks are claimed only once Cashfree's keys are set. The practice venue's go to the fake and reach nothing outside.
- **No face search.** Cashfree has none (decision 0197), so the in-person photo is not searched for a duplicate face. Question #255's reading stands.
- **No paid-call budget.** Each check is asked once, plus retries on trouble only. `begin_kyc_vendor_call`'s per-member daily cap is for members starting checks themselves.
