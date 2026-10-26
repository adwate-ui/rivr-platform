# 0188: Reports read hand records tonight, and the MIS is stored once on the 1st

Date: 2026-10-26 · Task: #99

**Tonight.** Scope-v1 module 4: rake by table, dealer and game from hand records, for the hands played since tonight began (06:00 IST, `private.tonight_began`), with each one's jackpot drop. It reads hands by when they were played, as the live floor's "rake tonight" does. Staff who read reports (`reports.read`: admins, the owner, super admins) see it, refreshed each minute.

**The MIS.** Module 16 commits to a monthly investor MIS that "generates on the 1st with no manual input except the Glaza import". A club month runs from its first club day's 06:00 IST to the next month's. The MIS holds:
- the month's rake, by table, dealer and game;
- the month's revenue and expenses by ledger account, and the net (money accounts that are not players' money, by when each transaction was posted, as the Tally export and the rake invoice count);
- the visits opened, and the members who made them.

**Stored once.** Each morning at 07:00 IST (01:30 UTC), once the night has ended, pg_cron stores each venue's MIS for the last month that has ended, if it is not stored yet: the 1st's run stores it, and a missed or failed run is made up the next morning, with an alert (`mis.not_stored`) for a venue that could not be stored. A month already stored keeps what it said, so what investors were given does not change under them. A late posting shows in the ledger and Tally, not in a stored MIS. Before then the console shows the month so far as a preview.

**Not yet.** The Glaza F&B import (#109) joins the MIS when it is built. The partner and investor statements (#98) read the stored month's net. The practice venue has no reports.
