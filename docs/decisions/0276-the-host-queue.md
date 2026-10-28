# 0276: The host queue

Date: 28 Oct 2026. Issue #165; scope-v1: "Keep GPA's host queue; trigger from visit gaps."

- **Found from visit gaps.** Each club day, at 06:00 IST, pg_cron runs `private.queue_lapsed_players()`. It queues a member who came at least `visits` times in the six months before and has not come for `days` days. These come from the setting `host.lapse`; with none set they are 3 and 21.
  - **Once for each lapse:** a member already queued for this last visit is not queued again.
  - **Never queued, never shown:**
    - a member on a break, or back from one since their last visit (the break is the gap, not a lapse);
    - one without marketing consent (an offer is marketing, under DPDP);
    - one frozen, or at a frozen venue;
    - an erased member;
    - anyone at the practice venue.
  - **A break taken later** closes the player's item.
- **The host's call.** Staff with `members.manage` see the queue (Players → Host queue), longest lapsed first. A call records:
  - why the player stopped coming, one of `HOST_CHURN_REASONS`;
  - the offer, as one of the promotion engine's own effects, checked by `promotionEffectSchema` and in the database by `private.is_promotion_rule`: points, a bonus in whole chips lasting 30 days, a free spin, or a message;
  - a note.

  A host closes a player when done.
- **Won back by a visit.** The player's next visit marks the item won back.
- **Recorded, not paid.** The offer is recorded as the effect promised. It is not granted by itself: whoever honours it does so through the cage or a promotion, as today. Whether it should be granted automatically is question #598; until it is answered, nothing moves without a person.
- **Erasure deletes** a member's items.
