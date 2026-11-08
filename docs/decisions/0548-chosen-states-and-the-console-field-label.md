# 0548: Chosen states, and the console field's label

Date: 9 Nov 2026 · From the 180-day audit of 8 Nov (I-58, I-59, I-60, I-105).

**A chosen chip or segment has a gold edge inside it** (`inset-ring`), so nothing moves as it is chosen. A marked palette result has a gold bar at its start, and its field a cream line while it has the focus. Each passes 3:1; the tints alone were 1.11 to 1.38:1. This is not one system: a PickList's current row and `ChoiceChips`' `card` look keep their own chosen treatments, a tint and a gold border.

**The console's subtle field has its label above it**, 13 px and muted, as a boxed field's. The audit offered this or a label floating inside, as the inset field has. A 36 px field has no room for one inside at 12 px or more, so the rows that held a field and its button on one centre line now line up at their foot.

**On a cream band** the hairline, a control's edge and the gold edge are ink at 50% (`color.inkEdge`). The gold button's fill stays, and it gains an edge in `gold-edge`, gold on gold and so unseen elsewhere, which a cream band turns to ink.
