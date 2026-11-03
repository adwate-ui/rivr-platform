# 0440: Hand over at the Door, and a 60 px console header

Date: 3 Nov 2026. The owner's choices during console v3's integration (proposed by the coordinator, confirmed by the owner the same day).

- **Hosts and Hand over.** Decision 0443 stands: a host sees no Marketing, so no Rewards screen. The Door gains a third tab, Hand over (`/door?tab=handover`), for staff with `rewards.hand_over`, showing the same redemptions list as Rewards' Hand over (`features/rewards` `HandOverScreen`). A host therefore still hands members what they redeemed, at the door. Rewards keeps its own Hand over for staff who run rewards.
- **Header height.** The console's header is 60 px, as the prototype draws it, with the rail's wordmark row level with it: a token of its own, `size.consoleHeader`, so the phone and tablet shells' 56 px `size.header` is unchanged. The account menu keeps the standard 46 x 28 switch (#786).
- **Proof.** The rail test shows a host's Door tabs as Check-in, Today's players and Hand over; the console shell's visual baselines are retaken at 60 px.
