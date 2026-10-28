# 0273: Winner cards

Date: 28 Oct 2026. Issue #155; the owner's answer of 28 Oct to question #589: render in the nightly offline-pack job, so a card is ready at 17:00 IST the next day, with no change to CI.

- **Made by the events.** A trigger on the outbox makes one card per player named, once each:
  - `tournament.finished`: the winner, with their prizes;
  - `high_hand.approved`: the player seated in that seat when the hand was played, with the payout;
  - `jackpot.paid`: the loser and the winner, each with their share.
  Never at the practice venue. Prizes are gross, before TDS (question #242).
- **Drawn at night.** `render:offline-packs` draws each card not yet drawn, after the packs, into the private `winner-cards` bucket as a 4:5 feed post. It uses the existing `social.winnerCard` and `social.highHandCard` templates. It also removes images no card names any more (an erased member's).
- **Shared only by the player.** Profile lists the member's cards (feature `social.winner_cards`, every tier). Each has a link to the drawn card and a "Share on RIVR's social" switch.
  - Staff who publish marketing see a card, and can read its image, only while it is shared. They download and post it by hand, as every channel does today (decision 0269).
  - Stopping sharing takes the card off their list and out of their reach at once. A post already made by hand has to be taken down by hand.
- **A reversal takes the cards away.** `high_hand.reversed` and `jackpot.reversed` delete the cards, and the nightly job then removes their images.
- **A trigger, not an outbox consumer.** Consumers are Edge Functions for calls outside the club (rule 5). A card is a row made from the event's own payload in the same transaction, exactly once.
- **Not built:** automatic posting.
