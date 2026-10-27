# 0248: A member's phone number is changed by a super admin, never by the member

Date: 2026-10-27 · Task: #502 · Question: #496 item 1 (the owner's answer of 27 Oct); the owner chose super admin only.

**Why.** A member's phone number is their login. Auth lets a signed-in user change it through `PUT /user`, which sends a code to the new number. The app never offered that, but anyone signed in could call it directly, and CAPTCHA does not cover it. Five accounts asking once a minute would use up the project's sign-in code limit and lock everyone out, and could send paid messages to any number. And whoever changes a member's number can sign in as them.

**What.**
- **The sign-in hook sends no code for a phone change.** That is a code for a number other than the login's own, or one sent while a change is waiting. The member is told their number is changed at the club (`sendSmsHookSchema`, `handleSendSmsHook`).
- **A super admin changes the number** in the console's member record (`members.change_phone`, super admin only), with a reason (`private.change_member_phone`).
- **The change.** The member's record and their login move to the new number together, so they sign in with it from then on. A number another member or login holds is refused.
- **Records.** The change is in the audit log with its reason, and the owner is alerted (`member.phone_changed`, by member number, never the numbers).
