# 0141: The promotions builder offers the prototype's choices, as rules the engine runs

Date: 2026-10-20 · Task: #84 · Question: #415

The builder has the prototype's four blocks only. **When** is days of the week and an IST window. The
end times are 20:00, 02:00, 04:00 and 06:00: the prototype's 08:00 would run past 06:00, where the club's
day turns over (decision 0140). **Who** is every stake or one table type, named as the club names it
("NLH 100/200", "Private Room"): two types share 100/200 blinds, so blinds alone cannot tell them apart.
**Reward** is double or triple points on hours played (the points earned, multiplied), or 10% of a
buy-in as bonus that expires in a week, with no cap or budget until #415 says otherwise. **Limits** is
none, the first 50 members a club day (one grant each), or once per member over the promotion; the
card states the limit, as players must know it.

Publish puts the promotion live at once with its card's words (`detail`, `runs`), kept for Home, the
TV and WhatsApp (#86), and sends `promotion.published`. Pause and resume go through
`set_promotion_live` only, so the kill switch and a venue freeze hold them as they hold publishing.
Second-role approval and simulation before publishing are #144.
