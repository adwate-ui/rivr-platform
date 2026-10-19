# 0054 Check-in from the console's front desk, by list or mobile number

Date: 19 Oct 2026. Task #72.

- The prototype's console Check-in has two lists: expected members with Check in, and who is in the room since when. Expected means members on a waitlist with no open visit: they joined from the app and have not arrived.
- Staff with `waitlist.manage` check members in: the front desk (role host), floor managers and admins. No new permission: the front desk already runs the waitlist.
- Until the membership QR exists (#71, which waits for the card templates, #67), the screen also checks a member in by mobile number, which the task's acceptance allows ("scanning the card or entering the phone"). The QR scan replaces nothing: it joins the same field.
- A door device that signs in like a dealer tablet (`device_kind` `door`) can follow; for training, staff check members in from the console.
- Checking in a member already in the room gives their open visit, so a double tap opens one visit. Check-out at the door (#82) and on final cash-out (#76) close it.
