# 0545: A member's cancel, the veg mark and notes to the bar

Date: 9 Nov 2026 · From the 180-day audit of 8 Nov (I-36, I-37).

**Cancel.** A member cancels their own order until the bar accepts it. It is a void with one fixed reason, so it leaves the lanes as a staff void does. The console's count falls by itself. So the console also chimes, a queue counts a member's cancellation for one minute, as the bar may already hold the KOT; the last three such KOTs are named over the lanes.

**Notes are a fixed list, not free text.** The audit asked for a per-order note. F&B keeps no free text (#567): a member's words would outlive their erasure in the order, its KOT event and the audit log. So a member picks from No ice, Less sugar, Less spicy, No onion and No garlic; `private.fnb_bar_note` keeps only those words, and anything else sent is dropped. A free-text note needs erasure to reach those three places first.

**Where a note goes.** On the order's last line, so the KOT prints it at its foot, with no change to the KOT or the bar's agent.

**Veg mark.** `DietMark` draws the veg, egg or non-veg mark as a cream square edged in its colour, with a dot or a triangle, so the shape says it as well as the colour. Diet and description are set when an item is added or from the menu's file. There is no edit on an existing row yet: a one-line file changes an item.
