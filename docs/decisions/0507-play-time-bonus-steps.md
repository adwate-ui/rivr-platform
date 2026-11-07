# 0507: A play-time bonus pays each step as it is reached

Date: 8 Nov 2026 · The owner's request of 8 Nov ("flexible enough to set rewards at defined intervals") and answer ("both", paid as reached, existing ones too)

**Rule.** A play-time bonus is one step after a time, two to six set steps (rising), or chips every so many minutes. Every so often runs up to its times a visit, and never past 24 hours. Each step reached pays that step's bonus chips once a visit. Minutes are seated play inside the version's schedule at its stakes and tables, less time away, including time away still under way.

**When.** A cron each minute (`hours-bonus`) weighs open visits, and a visit's close pays any step it reached by then. Live hours versions, which paid one step at close, now pay it as it is reached.

**Keys.** A step is its own event, `hours_step:<visit>:<minutes>`, so the close-time weigh of multipliers and free spins is untouched.

**Limits.** The member limit holds for each step: its period key gets `@<minutes>`. Budget and most grants count each step.

**Replay.** The replay has no moments within a visit, so it pays a closed visit every step its time reached, at the close.

**Twins.** `@rivr/domain` `hourSteps` and `stepsReached` have SQL twins proved equal on `promotionRewards.json`: `promo_hours_steps`, `promo_grant` and `promo_period_key`.
