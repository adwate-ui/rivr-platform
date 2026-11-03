# 0498: The word-only promotion cards retire

Date: 3 Nov 2026 · Owner's answer to a question in #829 · Closes decision 0496's open question

**Why.** High hands, the bad-beat jackpot, RIVR Rewards, Ladies' Night, the RIVR League and RIVR Sunday were promotions in name only: words on a card, no rule and no version, so they gave nothing and could not be built or approved in the v3 builder. The owner chose to retire them.

**What.**
- **Ended, kept.** A migration ends every venue's six cards (status `ended`); the rows stay for history. `private.promotion_cards` reads live promotions only, so they leave the player's Tonight, the TVs and the website; `set_promotion_live` resumes only a paused promotion, so an ended card stays ended.
- **No new ones.** `add_promotion_templates` no longer adds them, the seed no longer publishes high hands, and the practice venue's reset seed is captured again.
- **The features go on.** High hands are claimed and paid at the tables (`high_hand_claim`), the bad beat from its jackpot (`pay_bad_beat`), points, the League and RIVR Sunday from their own screens. Only the promotion cards retire.
- **The console list.** A promotion with no version that is not ended still pauses and resumes through its rule (`set_promotion_live`), now noted "Run by its rule": rules the typed model cannot say (a hand, call time, a new player, and the like) may exist from before versions, though no template or seed makes one. An ended one carries no note. The old builder's template functions are tested on a template inserted for the test.
