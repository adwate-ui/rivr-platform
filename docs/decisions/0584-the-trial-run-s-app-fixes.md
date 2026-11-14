# 0584. The trial run's app fixes

From the trial run of 13 Nov (#923 to #927). The owner, 15 Nov: "Fix all of these issues."

- **A new version as the app starts (#923).** Phones that last opened the player app days before ran the old copy through sign-in and the identity check, since an update waited until the page was out of sight and never came on those screens (#252). Now a version that arrives in the first minute, before anything is typed, is taken at once; and one still waiting is taken at the next screen, where nothing is half typed. After that the old rule stands: out of sight, never mid-step.
- **Seat waits for its answer (#924).** The seat sheet's Seat is busy until the seating is answered. For a member on the list whose identity check is not done, the sheet offers Check ID in place of Seat to staff who may check (decision 0503), and tells the rest to send the member to the desk, without asking the database.
- **A fresh security check on return (#925).** Coming back to the page renews the Turnstile token, as one from before may have run out while the member was in WhatsApp.
- **Four jobs off (#926).** live-status, native-push, social-wall and channel-analytics are not set up on either project and answered 503 about 3,100 times a day each. They are unscheduled, as audit F-109 did for five others; the runbook says how each goes back on.
- **Seats left open (#927).** At 06:15 IST the owner is alerted, once a night, if a seat taken before the night's end is still open (`floor.seats_left_open`, with the count). Nothing ends the seats: a player who stays past 06:00 is not cut short (decision 0561).
- **Not built:** reporting of errors from the apps (#928) waits for the owner, as it adds a vendor.
