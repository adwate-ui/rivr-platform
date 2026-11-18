# 0690 Floor and up see members' phone numbers on the Door

Date: 18 Nov 2026. Issue #1073. The owner: the Door gets a phone number column and a History column, visible to the floor and the roles above it.

- **What changes from 0513.** Decision 0513 kept members' numbers from every role but super admins (and the host queue). Now floor, admin and super admin also see a member's full mobile, on the Door only (its Mobile column), through a permission of its own, `members.phone`. The Members list's Mobile column, member search and the record stay as 0513 has them.
- **Who does not.** Hosts and cashiers read members too (`members.read`) and keep the Door as before: the database returns no number to them, and the console shows them no Phone or History column.
- **Where it shows.** On Today's players the mobile has a column after the member number and History one at the end. On Check-in the row's Check in or Check out leaves no room for two more columns at 1440 px, so the mobile is a line under the name and History sits beside the button.
- **Never in an export.** The Door's Export leaves the Mobile column out, so numbers are read one at a time on screen and never downloaded in bulk (the security review of the pull request).
- **Who is on the Door.** Members on a waitlist today who have not come in show too, with their numbers: the floor calls them.
- **History** opens in the panel at the side: hours played since the member's hours were last reset (as the Members list's Played, decision 0609), then their last ten visits. Both were already readable by `members.read`; the Door shows them to floor and up only.
