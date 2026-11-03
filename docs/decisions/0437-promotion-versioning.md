# 0437: Promotion versioning, four eyes, and limits across versions

Date: 2026-11-03 · Console v3, phase 7 (promotions rebuilt) · Builds on decision 0244 (a promotion waits for a super admin)

**Why.** The brief: editing a live promotion creates a new version that needs approval, the live one keeps running until then, the approver is another staff member with `promotions.approve`, and submitting needs a simulation on the current version.

**What.** `transition` in `@rivr/domain/promotions`; the database's version functions refuse the same.
- **Statuses.** draft → awaiting approval → scheduled → live ⇄ paused → ended. A rejection returns the version to draft with a reason of 3 to 300 characters.
- **Editing.** Editing a scheduled, live or paused version opens a draft of the next version. The running one keeps granting until the new one is approved; approval ends it.
- **Approval.** It needs `promotions.approve` (super admins, as before) and a person other than the one who submitted. It goes live at once when the start day has come, scheduled otherwise.
- **Simulation.** Submitting needs a simulation on these very terms (reward, who, when, limits): any change to them after the simulation asks for another. Words and channels do not.
- **Limits count the whole promotion.** Per-member periods, members a day, most grants and the budget in chips count every version's grants. Grants are unique per promotion, member and period key, without the version. The brief put the version in the key, but then an approved edit would give "once ever" or "once a day" again. A rule players see and chips paid out, so the safest reading. The version is still recorded on each grant.
- **Whole or nothing.** A grant that does not fit what is left of the budget is not given, never part of it, as decision 0140 had it.
