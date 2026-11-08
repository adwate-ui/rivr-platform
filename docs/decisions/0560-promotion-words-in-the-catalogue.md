# 0560: Promotion words live in the catalogue

Date: 9 Nov 2026 · Audit of 8 Nov (F-055)

**Why.** The sentence a promotion is described in was written in `@rivr/domain`, against the rule that every string is a catalogue key. Domain may import only contracts, so it cannot read the catalogue.

**What.** The words are not a business rule, so `describePromotion`, `cardWords` and `whoAndWhen` moved to the console's promotions feature, the only place that uses them, each phrase a key under `console.promotions.words`. `@rivr/db` no longer builds a card's words: the builder hands them to `saveDraft`.
