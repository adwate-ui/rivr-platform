# 0623. The high hand on the Live floor

Issue #967 (RD-24). Decided while building:

- **The strip is a new `@rivr/ui` component, `SummaryStrip`.** `Banner` is one line of one weight read out as a status, `PromptBar` a prompt with buttons, `StatRow` stacked figures: none holds a label, a bold lead, facts and a part that gives way. The label, the lead, the facts and the button keep their width; the last hit is the part cut short, so the strip is one line at 1440 px and at tablet width with five-figure numbers.
- **Who reads, who logs.** Everyone who sees the Live floor reads the strip and tonight's hits (`members.read`, `floor.manage`, `waitlist.manage`), and those who manage promotions. Only those who add Bonus by hand (`bonus.give`) see Log a high hand, as 0621 has it and the owner ruled, not the issue's "the same roles that seat players".
- **The strip shows while a version is live**, and counts that promotion's hits of tonight, as its record does; one that ended earlier tonight is not added in. Paused, scheduled or ended, no strip. A hit refreshes every floor console through the floor's signal; a promotion going live or pausing has no signal, so the strip asks again each minute.
- **Rules start unconfirmed.** The floor turns on each rule the promotion holds, and the players dealt in always; until then there is no line and Pay stays off. The prototype draws them on; confirming is the floor's act.
- **The line and the button come from the domain's rule** (`highHandPayout`) on the hands and rules read with the strip; the database decides again when it pays. A full house of three aces says Aces full where the promotion lists it.
- **Only tables with players are offered**, then the players seated at the table chosen. The promotion's own tables and stakes are checked by the database, which refuses in words.
- **A retry is the same hit.** The panel keeps one request id until the table, player, hand or rank changes.
- **A hand with no rank goes as a blank**, which `log_high_hand` reads as none: the generated types give the argument no null.
- **Activity** files a hit under Bonus: 'Paid a high hand: 5,000', 'High hand · Devansh Malik', and in Why 'Four Jacks · Table 2, seat 3'. `activity_page` returns the table, seat and hand as `high_hand`, so the words stay in `@rivr/i18n`; `activity_log`, which the console no longer reads, is left as it was.
- **From the promotions record**, Log a high hand opens the floor at `/?log=high-hand`: once the floor has read whether a high hand runs, the panel opens if it may and the address is cleared either way, so a panel closed stays closed.
- **The panel keeps the high hand it opened with.** One paused meanwhile leaves the panel up, and Pay is refused in words. The panel has no line under its name (correction 23).
