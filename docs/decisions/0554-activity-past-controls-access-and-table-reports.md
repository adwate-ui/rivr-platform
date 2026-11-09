# 0554: Activity, Past controls, who has access, and fuller table reports

Date: 9 Nov 2026 · 8 Nov audit, I-75 (F-034).

**Activity is for super admins alone.** The screen and `activity_log` go by `control.engage`, not `audit.read`: an investor holds `audit.read`, and this log names who was frozen and why (#493 P5). The read never returns a row's before or after, which hold whole records.

**It narrows on the server,** by part of a name, kind and club day, fifty lines at a time, as the log runs to thousands of rows and the table's own filters see one page. So Activity's six columns have no filter of their own, the one exception here to decision 0512's every column filtered by its type. Export takes the lines loaded, and what it records says so while earlier ones are not.

**Points by hand now write an audit row.** Only the ledger kept them, though the screens said the audit log did. `grant_points` and `unlock_points` write `points.grant`, `points.lock` and `points.unlock`, as `bonus.give` does.

**How much** shows for points and bonus chips by hand, each in its own unit: `Gave points: 500`, `Gave bonus chips: 1,500`. An erased member's name and the reasons written about them do not show, here or on Past controls; the erasure keeps its own reason.

**Codes become words in `@rivr/i18n`** (`activityActionWord`, `activityEntityWord`). A code added later reads `Recorded` or `Record`, never as the code.

**Past controls** on Kill switch lists every released control, with both super admins for a freeze. A control is rare enough to need no cap.
