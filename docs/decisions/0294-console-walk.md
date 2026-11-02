# 0294: The console after its walk on staging

Date: 2 Nov 2026. The staging walk of the console, items C-02 to C-06 on the UI polish tracker.

- **A list with no record open (C-02, C-03).** `SplitView` gave the list two fifths of the width from 1180 px and the rest to a line saying "Choose a ...", so settings' table wrapped every header. With no record open the list now takes the full width; the record still takes three fifths beside it once opened. Members, which split half and half, shows the list across the width until a member is opened, in place, so a search typed survives opening a record.
- **A screen switched off (C-04).** A screen the club hid (the League, the Academy, tournaments) opened by its address says "This screen is switched off. Ask a super admin." rather than that it is not in the role, which a super admin read as a fault.
- **The house rules (C-05).** They said a called seat is held 10 minutes; the club's setting and the floor hold it 20. The shipped line says 20, changed only while it still reads as shipped.
- **Feedback (C-06).** The second list is everything but the open tickets (tickets dealt with, and ratings that were never tickets), so it is headed "Other feedback, last 90 days" and says "Nothing else in the last 90 days." under an open ticket, not that there was no feedback.
- **Later.** The staff page as a searchable table, the member record in sections, and the KYC review's groups are a batch of their own; a member's KYC photo missing from storage is a seed-data gap, not a product fault.
