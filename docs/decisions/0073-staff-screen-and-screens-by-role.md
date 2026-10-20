# 0073: The Staff screen, and every console screen held to the rail's rule

Date: 2026-10-20 · Task: #28 (device binding, the IP allowlist and the cage's idle lock are #384)

The console's Staff screen (Team → Staff, `staff.manage`) lists the venue's staff. Each has a job title
from the manpower plan, apart from the role that decides access. A manager adds or changes only
staff whose role they could give, as lane 0's policies and `private.can_grant_role` decide. The screen
offers only those roles (`@rivr/domain` `grantableRoles`, the same rule). So an admin gives only admin or
host: dealers, cashiers, marketing and the owner's view hold permissions an admin doesn't, and a super
admin adds them.

Three rules hold in the database:
- A number is on a venue's staff list once. Otherwise `link_my_login` would fail and lock its owner out
  of every app.
- Only a dealer, who signs in with a PIN, may have no number.
- For a request from an app (`private.staff_guard`), nobody changes their own role or turns themselves
  off, and a venue keeps two super admins able to release a freeze. That is the kill switch's own floor
  (`private.engagers`, RVLCK), so a super admin whose access is revoked doesn't count.

A freeze doesn't stop staff changes: a manager may need to turn someone off during one.

Which screen a role may open comes from the rail's own table. The frame refuses a screen whose rail
entry the role lacks, so a cashier who types an admin screen's address sees a refusal, not the screen.
The database still refuses every call they couldn't make anyway.
