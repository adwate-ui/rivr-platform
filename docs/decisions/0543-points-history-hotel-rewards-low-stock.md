# 0543: Points history, rewards in hotel nights, and low stock

Date: 8 Nov 2026 · From the 180-day audit of 8 Nov (I-39, I-40, I-42).

**Points history.** It is read from the ledger (`private.points_history`), so it is what the balance is made of, one line a transaction, behind the existing `rewards.points_history` (decision 0062), on for every tier today. Each line says what the ledger says: "Points for the visit", a promotion's name, a reason given by hand. Locked points the club lets go read "Released", the word Rewards already uses: "unlock" is a banned word. Staff get the same read on the member record (PR-21).

**Rewards in hotel nights.** A tier without `rewards.accommodation` is not shown them: the read policy hides them and `redeem_reward` refuses them (42501), so the rule holds in the database as well as the app (rule 8), and their filter goes too. Hidden rather than locked, because no tier has the feature today and a locked row would offer what the club does not.

**Low stock.** Low is under five left (`LOW_STOCK` in `@rivr/domain/rewards`): few enough to prompt a restock, without flagging a small stock kept on purpose. Sold out is gold, the status that waits on staff. Low keeps the cream dot, as nothing has to happen yet. Redeemed (30 days) counts the last 30 days and leaves cancelled redemptions out.

**Filters.** The pills wrap to a second row on a phone rather than fading at the edge: all five show, and `ChoiceChips` does not change for the screens that scroll on purpose.
