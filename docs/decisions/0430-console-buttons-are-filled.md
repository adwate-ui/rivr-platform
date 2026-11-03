# 0430: Console buttons are filled

Date: 3 Nov 2026. The console v3 brief: "Ghost buttons become a subtle filled surface."

- **New variants, not a changed one.** `Button`'s `secondary` (the hairline outline, and the default) stays. The player app (17 uses), the website's header, map and cookie banner, and ui's own parts use it. Filling it would change all of them.
- **`subtle`.** A faint cream fill (cream 5%, 8% under the pointer) with cream words. The console uses it where it used `secondary`.
- **`strong`.** A cream fill with ink words: the main action of each item in a list, such as a request's Approve. Gold is kept for the screen's one primary action (decision 0429).
- **Console sizes.** `compact` is 36 px at a desk and `small` is 32 px, for an action inside a row or tile. Both have 4 px corners and 44 px below 1180 px (decision 0282).
- **Left for the console's screens.** They still pass `variant="secondary"` or no variant. Each moves to `subtle` as its screen is rebuilt. Outlined cards and gold outline buttons go then too.
- **BulkBar's buttons.** They sit on a cream bar, so BulkBar draws them itself (ink fill and words) rather than add Button variants for a cream ground.
