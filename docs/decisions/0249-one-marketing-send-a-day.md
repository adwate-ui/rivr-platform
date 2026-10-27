# 0249: One marketing send a day to a member

Date: 2026-10-27 · Task: #501 · Question: #494 item 6 (the owner's answer of 27 Oct)

**Why.** The owner asked for two limits. A bonus promotion whose grant is above ₹25,000, or which has no budget, waits for a super admin's approval. And members get at most one marketing WhatsApp send a day.

**What.**
- **The approval half is already in place.** Since #144 (decision 0244), every promotion, whatever its size, waits for a super admin, who never approves their own. No separate ₹25,000 setting is needed.
- **One send a day.** Today the only marketing sends are promotion offers: a promotion going live offers itself to each member who opted in (`promotion.offered`).
  - A member already offered one this club day (06:00 to 06:00 IST) is not offered another until the next club day (`private.announce_promotion`).
  - One venue's promotions are announced one at a time (an advisory lock), so two going live together cannot both reach the same member.
  - Each member counts on their own: someone who opts in later the same night is still offered the next promotion.
- **An offer that was never sent still counts.** If an offer was created but not sent (the opt-in withdrawn, or marketing sends switched off), it still counts as that member's one offer for the night. That is the safe side of "at most one".
- **Future marketing sends must check the same cap.** Any new kind of marketing send (a lapsed-player message, say) checks the same rule before it goes out.
