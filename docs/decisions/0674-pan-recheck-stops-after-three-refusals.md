# 0674 A PAN re-check Zoop refuses: ask again, pause, or stop after three

Date: 16 Nov 2026. Task #1026, from PR #1025's review. Amends decision 0271 (re-checking checks made in person); Zoop per decision 0671.

- **The problem.** `kyc-recheck` read every vendor failure as "no answer" and asked again, hourly at most, for ever. With Zoop a PAN check is two billed products, so a check whose Pan Demographic call is refused paid for Pan Lite every hour, up to 50 checks a run.
- **Three kinds of failure** (`panRecheckFailure` in `@rivr/adapters`, from the failure's `cause`):
  - An outage, even after a paid call (Zoop keeps it a refusal so the call is not given back, but marks its cause): asked again as before (2, 4, 8, 16, 32 minutes, then hourly), uncounted.
  - Zoop refusing RIVR's account: a key it does not take, a product not on the app or a key for the other host (401, 403), a low wallet (402, 112), or a reply that is not Zoop's. Every check would get the same, so every real venue's re-check pauses for six hours (`private.kyc_recheck_pause`) and the owner hears of it once (`kyc.recheck_paused`). No member's re-check is spent on it, and one Pan Lite at most is paid each pause.
  - Zoop turning down this check's request (106, 102 and the like): noted with the check as `recheck: Zoop <code>` and counted. The third ends the re-check: `pan_recheck` is `not_checked`, the check is never claimed again, and the owner hears of it (`kyc.recheck_not_checked`).
- **The member keeps playing.** A check made in person stands: the vendor's trouble never sends a check to review (decision 0271). Staff send it back by reopening it.
- **Counted per check.** A check made again (reopened, checked again at the desk, sent back to review) starts afresh: its tries, refusals and a refusal's note go (a trigger on `kyc_record`). An answer after one or two refusals stands, and clears the note.
- **Accepted.** Two overlapping runs (one longer than two minutes) can claim a check twice, as before; the first answer recorded stands.
