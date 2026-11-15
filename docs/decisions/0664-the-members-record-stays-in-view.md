# 0664. The Members record stays in view as the list scrolls

The owner, 15 Nov night: "In Members table - make the side bar fixed to access the window quickly. Currently have to scroll up each time."

- **What was found.** The console's rail already stays in place while a screen scrolls: the shell is one window high and only `main` scrolls. A probe on Members at 1440 px, scrolled to row 40, found the rail at the top in Chromium and in WebKit (Safari's engine), and on an iPad-sized window; the page itself never scrolls.
- **What the owner meant.** Members opens a member's record in a 440 px panel at the right (`SplitView` `docked`, decision 0465). That panel sat at the top of the page: chosen from row 40, the record opened 1,277 px above the view, and staff scrolled up to reach it, every time.
- **The change.** In `@rivr/ui`, the docked record is held at the top of the scrolling area from 1180 px (`sticky`), so it opens in view wherever the list is scrolled to, and it is never taller than what the screen shows (`max-h-console-view`, from the header and spacing tokens); a longer record scrolls on its own. The list, its held header (#1014) and the rail are as they were.
- **Only the docked layout.** The `record` and `even` layouts (KYC review, Website) are unchanged: Website's editor holds its own sticky bar, which a record scrolling on its own would break. Members is the one docked screen.
