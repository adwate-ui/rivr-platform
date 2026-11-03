# 0501: The first N grants a club day, with no limit a member

Date: 4 Nov 2026 · Money audit of #833 · Builds on decisions 0491 and 0499

**Why.** 20261107140000 made a version of an old rule giving "the first N grants a club day" with no limit a member as `{"perMember": "none", "maxMembersPerDay": N}`. That says N members a day, each given it again and again, where the rule meant N grants a club day in all, so it could grant without limit. Production had not run that migration yet when this was found, and the release runs it with #833, so #833 repairs it rather than leaving it for later.

**What.**
- **The safest reading.** The typed model has no grants-a-day cap, so such a version says one a club day a member and N members a day (`perMember` `per_day`, `maxMembersPerDay` N). That is never more than N grants a club day; a member can no longer take two of the N, which the old rule allowed. That is fewer grants, never more.
- **The repair** (`private.repair_first_n_a_day_versions`, run by 20261108100000) mends each version 1 converted from such a rule that is still the promotion's only version: same status, so a live one changes its limits at once. Its grants are keyed again by their club day, numbered as the engine numbers them, so a member already given it today has it no more today. Run again, it finds nothing.
- **Its limits.** At most N grants a club day from the day after the repair, or after a conversion from the old path. On that day, if M members took G of today's grants first, up to N − M more may be given where the rule allowed N − G: at most G − M extra, and only when a member took two or more that day.
- **Not repaired.** A promotion with a later version: that version was written and approved by people, and its grants keep the keys its own limits gave them. One that copied the bad limits is the owner's to change; checks found none.
- **The conversion** (20261108020000's `insert_version_from_rule`) now gives those limits directly, so a later conversion needs no repair. A rule with the first N a club day and up to more than one a member stays on the old path: members a day would let one member take several of the N.
- **No production read needed.** Read-only checks on 4 Nov: production has not applied 20261107140000 and has no such rule (28 promotions, all templates); staging has no such version (32 promotions, all templates). The repair and its test (316) stay for correctness on any database the old conversion ran on.
