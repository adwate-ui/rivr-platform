# 0192: The owner dashboard is one snapshot, read again when the venue's owner topic signals

Date: 2026-10-26 · Task: #101 (tech plan item 22)

**Who.** The owner (`owner_view`) and super admins: `dashboards.read`. A console screen, Owner, laid out in one column for a phone. The practice venue has none.

**What.** One database read, `owner_snapshot`:
- tonight's rake and hands since 06:00 (from hand records, as Reports' tonight);
- the tables running, who is seated and who is in the room;
- the cash position: each payment account's balance, and what the club holds for players (their cash balances, and the chips in play);
- the ten latest alerts, by kind only, in the words of the owner's WhatsApp (#100);
- the rake of the last fourteen club nights, drawn with `@rivr/ui` `Chart`.

**Live.** As the TV boards are (decision 0051): a hand logged, an alert raised, a ledger posting, a table opened or closed, a seat taken or left, a visit opened or closed broadcasts once a statement on the venue's private Realtime topic `owner:<venue id>`, naming nothing. Only staff who read the venue's dashboards may listen. The screen reads the snapshot again a second after the first signal of a burst.

**Not here.** Sentry's own alerts wait for its webhook (decision 0191).
