# 0053 Breaks from Profile now; the floor's screen and the reminder follow

Date: 19 Oct 2026. Task #56.

- A member takes a break of 24 hours, 7 days or 30 days from Profile, as the prototype offers. A break is never shortened: its rows never change, and a shorter one while a longer runs changes nothing.
- The prototype calls the player's control a "session reminder", so the session limit is a reminder after 4, 6 or 8 hours seated, not a hard stop.
- The floor sets a break through `public.set_member_break` (members.manage, 1 day to 10 years, with a reason). Its console control belongs on the member record, built in #60; until then the front desk asks the member to take the break in the app, or a super admin calls the function.
- The reminder is kept now and sent once seat sessions exist (#77, #78), which know how long a member has been seated.
- The waitlist refuses a member on a break now; the door (#72) and the cage (#57) call `private.member_restrictions` when they are built.
- Limits sit on Profile itself, as in the prototype, so `core.limits` lists `player:profile`; the separate Limits screen is gone.
