# 0309: A daily limit on points by hand

Date: 3 Nov 2026. The owner's answer of 3 Nov to #657: a daily cap per staff member, blocking, with an alert.

- **The limit.** `points.daily_staff_cap` (Settings → Members) is the most points one staff member gives by hand in a club day, earned and locked together. It starts at the owner's 10,000 at each club venue. With none set, there is no limit.
- **Only a super admin changes it**, with a reason, and the owner is alerted (a control setting, as `rakeback.rate`). An admin who gives points could otherwise raise their own limit.
- **Two at once wait for each other.** One staff member's changes take a lock first, so two sent together, to different members, cannot both fit under the limit.
- **Past it, nothing is given.** The console says "You have reached your daily limit for giving points. A super admin can give more." The owner gets an alert (`points.daily_cap`) that a staff member tried, once a staff member a night. The alert names the staff member and the cap, never the member.
- **Who is limited.** Every role with `points.give` except super admins, who set the limit.
- **Not counted.** Unlocking locked points gives none new. League points are never spent.
- **A refusal keeps its alert.** An error would take the alert back with it, so `grant_points` answers a refused change with no transaction. A retry of a change that went through is answered with that change, before the limit is counted, so a lost answer never becomes a refusal.
