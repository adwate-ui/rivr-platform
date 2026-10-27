# 0248: A member's phone number is changed by a super admin, never by the member

Date: 2026-10-27 · Task: #502 · Question: #496 item 1 (the owner's answer of 27 Oct); the owner chose super admin only.

**Why.** A member's phone number is their login. Auth lets a signed-in user change it through `PUT /user`, which sends a code to the new number. The app never offered that, but anyone signed in could call it directly, and CAPTCHA does not cover it. Five accounts asking once a minute would use up the project's sign-in code limit and lock everyone out, and could send paid messages to any number. And whoever changes a member's number can sign in as them.

**What.**
- **The sign-in hook sends a code only to the login's own number.** A phone change through `PUT /user` asks for a code to a new number, and a login with no number has none of its own, so neither gets one; the member is told their number is changed at the club (`sendSmsHookSchema`, `handleSendSmsHook`). This stops codes to any number and a member moving their own login. It may not stop the lockout: Auth appears to count a code against the project's limit before it calls the hook, so a member calling `PUT /user` in a loop could still use up the hourly limit. #544 checks this on staging; the hook cannot prevent it.
- **A super admin changes the number** in the console's member record (`members.change_phone`, super admin only), with a reason (`private.change_member_phone`).
- **The change.** The member's record and their login move to the new number together, so they sign in with it from then on, and every session of the login ends, so a lost phone is signed out. A number another member or login holds is refused, and so is a login that is also a staff member's or a device's (RVSTF), which would let one super admin sign in as another member of staff. It is admin-computer work, as erasure is. The reason is held to the erasure reason's rules, since the audit log keeps it.
- **Records.** The change is in the audit log with its reason, and the owner is alerted (`member.phone_changed`, by member number, never the numbers).
