# 0681 A super admin switches food and drink on and off

Date: 16 Nov 2026. The owner: "Add a setting for super admins to turn F&B on and off. F&B on works exactly like today." Asked what goes when it is off, the owner chose no new orders, with open orders still served.

- **The setting.** `fnb.enabled` ("Orders", under Settings › Floor › Food and drink) is a venue control setting: only a super admin changes it, with a reason, and the owner is alerted. None set is on, so nothing changes until it is switched off.
- **Off means no new order, anywhere.** The database refuses any new `fnb_order` (RVFNB), whether from the member's app, a dealer's tablet or the console, so an app opened before the switch takes none either. The refusal says food and drink is not being served, and the screen then hides ordering.
- **What hides:**
  - the player app's Order to my seat, Order again, and the order page, which says food and drink is not being served;
  - the lock screen's Order; a status already on a phone changes at the member's next seat event;
  - the tablet's Food and drink, which says it is off;
  - the console's New order; the page says food and drink is off and open orders are still served.
- **What stays.** Orders already placed are served as before: the member's tracker, the console's orders and KOTs, and the F&B report. The menu can still be edited.
- **The apps ask** `fnb_on` (with no venue, the member's own), and ask again each minute. Only a known "off" hides ordering; while it is being read, ordering shows and the database still refuses.
