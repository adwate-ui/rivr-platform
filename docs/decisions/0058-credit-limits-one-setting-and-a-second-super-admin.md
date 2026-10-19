# 0058 Credit limits: one setting, and a second super admin above the threshold

Date: 19 Oct 2026. Task: #73.

- **One setting.** Lane A's contract named `credit.approval_threshold` and `credit.exposure_cap`. The rules are one setting, `credit.config`, read and changed together: the approval threshold, the minimum visits before any credit, and the room's exposure cap. A venue without it gives no credit (`RVCFG`).
- **A second approver.** A raise above the threshold waits for a super admin who did not ask for it, even when a super admin asks (money.md: a second approver above configured limits, enforced in the database). The scope's "approved by the owner above a threshold" is a super admin's approval.
- **The amount shown.** The approver approves the amount they saw. If another was asked for meanwhile, the database refuses it (`RVSTL`).
- **Cuts.** A cut, or a limit within the threshold, is in force at once.
- **Who is a super admin.** Only one active at the venue with access not revoked, as `current_staff_id` finds them.
