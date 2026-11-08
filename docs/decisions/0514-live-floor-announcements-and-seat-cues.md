# 0514: The Live floor tells new work by its count, and its seat bar keeps colour with words beside it

Date: 9 Nov 2026 · From the 180-day audit of 8 Nov (F-041, F-099) and the review of its fix PR (PR-04).

- **New requests are told once, by their count.** The requests panel is no longer a live region (it re-read every changed request and its buttons). UrgentChime's status region, already there, says "{count} urgent waiting" as the Live floor's queue grows (`liveFloor` is an urgent queue). It does not name the request ("Top-up from Ritika Bhalla, table 2"), as the audit suggested: the console stands at a desk in the room, so a screen reader would read members' names aloud. A staff member who uses one hears the count and reads the panel.
- **The seat bar is drawn, and said in words.** Open seats are now outlined at 4.36:1 against the tile (WCAG 1.4.11). Seated and needs-you seats still differ by colour on the bar, because the bar is drawn for the eye (`aria-hidden`). The same facts are in words twice: the line under it, "6 of 9 seated" with "2 need you" in gold beside a dot, and the seat button's description, "4 seated, 2 need you, 3 open". No second shape is added to the pips.
- **A and D act on the request in focus.** With the focus on an approved player's row, which takes no key, they do nothing rather than act on the oldest request.
