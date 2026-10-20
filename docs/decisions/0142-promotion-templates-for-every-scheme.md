# 0142: Every scheme in the deck is a draft promotion in each venue; the engine runs only three

Date: 2026-10-20 · Task: #85 · Questions: #415, #419

Each venue starts with the eleven schemes as draft promotions (`template_key`), with their card's
words, added by migration and by `bootstrap_venue` for new venues, the practice venue included. The
floor publishes one as it stands with `publish_promotion_template`, live at once and announced as a
builder's promotion is. The floor checks its card against the club's settings first: the high-hand
amounts and the RIVR Rewards share are written on the card.

Three carry the engine's rule:
- **Buy-in bonus Tuesday:** 20% of a buy-in among the first five at a table on Tuesday, for a week. It
  has no cap or budget, as #415 asks for the builder's bonus.
- **Referral:** a ₹1,000 bonus for 30 days. The referral programme (#151) fires the `referral` trigger
  for each side and credits nothing itself.
- **Graduate first buy-in:** a ₹1,000 bonus for 30 days, once to each member of the Academy graduate
  tier, on their first buy-in while it runs (#419).

The other eight are cards only, with no rule, because another feature owns them and a rule would pay
twice:
- high hands (the floor's approval, decision 0050)
- the bad-beat jackpot (#48)
- RIVR Rewards (points from rake, #89)
- Founders' Circle priority (waitlist weights, #40)
- the cab (lane C's `cab.minimum_visits`)
- the League (#147)
- the Sunday guarantee (the tournament's overlay)

Ladies' Night is also a card only, because members carry no gender, so the floor runs it.
