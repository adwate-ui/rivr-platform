# 0610 A sign-in for top-ups only

Date: 15 Nov 2026. Issue 975 (redesign RD-32; the owner, 15 Nov: a role for guest relations that sees only top-up requests).

- A new role, `guest_relations`, with one permission, `top_ups.manage`. Its rail has one entry, Top-ups, which is where it lands; every other address refuses it.
- Admins and super admins hold `top_ups.manage` too. The database lets a staff member give only a role whose every permission they hold (`private.can_grant_role`), so this is what lets an admin give the role on the Staff screen. They get the Top-ups entry with it. The floor, hosts and cashiers go on handling top-ups from Requests by `waitlist.manage`, and get no second entry.
- `top_ups.manage` appears in no policy on any table. Top-up requests have no policy at all: they are read and changed only through `top_ups_tonight`, `top_up_history`, `set_top_up` and `undo_top_up`, which let in whoever handles top-ups (`private.may_handle_top_ups`: the floor's permission or this one).
- Each request says who accepted it and who marked it done, and how long each step took: asked to accepted, accepted to done, in minutes and seconds as the wait beside a request already counts. The table already kept both people and both moments; nothing new is stored.
- Past requests are read a club day at a time, fifty to a page, counted and paged on the server (`top_up_history`), in the shared data table's server mode.
- `/top-ups` is a screen again; since console v3 it only led to Requests.
- Not narrowed here: what every staff sign-in reads of its own venue by policies that name no permission (the venue's name and configuration, its tables and stakes, its settings, colleagues' names and numbers, devices). A dealer and Service read the same today. Narrowing that for one role means rewriting some thirty policies and belongs to an issue of its own; the security review should weigh it.
