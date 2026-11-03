# 0421: Production runs Cashfree's sandbox until the live keys arrive

Date: 3 Nov 2026. The owner, on go-live day, with Cashfree's live account still in review: "use the same keys as staging", then, told what the sandbox does: "Sandbox on prod for now".

- **What runs.** rivr-prod holds staging's TEST keys and `CASHFREE_ENVIRONMENT=sandbox`. The repository variable `PROD_CASHFREE_ENVIRONMENT=sandbox` keeps it through releases. Without the variable, a release sets `production` as before (#112), and any other value fails the release.
- **What the sandbox proves.** DigiLocker returns the member's real Aadhaar, so the name, date of birth and the 18+ check are real. The selfie's liveness and face match are answered by rote (every staging check scores 98), so a selfie proves nothing. PAN checks pass only Cashfree's test numbers. Cashfree may refuse sandbox use for real members at any time; KYC then closes, as it would with no keys.
- **Accepted by the owner,** told the above before choosing. Each release prints a warning while the variable is set.
- **Switching to live.** Set the live `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET` and `CASHFREE_PUBLIC_KEY` on rivr-prod, set `CASHFREE_ENVIRONMENT=production` (or delete the variable and release), then delete the variable. Members verified on the sandbox keep their status; whether to recheck them is the owner's call.
- **The security review's check 4** (`docs/security/2026-10-review.md`) expects the digest of `production`; it reads `sandbox` until the switch.
