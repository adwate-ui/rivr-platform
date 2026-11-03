# 0489: A setting's change says why, in 3 characters or more

Date: 3 Nov 2026. Console v3 brief, Phase 6 "Settings": change a value inline, from now or a later day, never backwards.

- **The rule.** The database's control-setting guard (`private.guard_control_settings`) refuses a reason under 3 characters for a super admin's setting, such as `points.daily_staff_cap`. Every setting's form now asks the same (`REASON_MIN`), so one rule holds wherever a reason is typed; the longest stays 200.
- **Said before sending.** The rule is in the field's label, "Reason, 3 characters or more" (copy.md folds hints into labels), and a shorter one is refused in the form, with "Say why, in 3 to 200 characters.", before any request.
- **In the row.** Change opens the value under the setting's row: what it applies to for a scoped setting, its fields, then Takes effect (Now or From a later day), the reason and Save on one line. A later day only; the database refuses the past too. The setting's panel (opened by its name) keeps its history, the changes to come and Withdraw.
- **Who.** An admin sees no Change on a super admin's setting; the panel shows it read-only, as before.
- **Notices.** Beside the notice, a live preview: the banner members' Home shows, with the words as typed.
