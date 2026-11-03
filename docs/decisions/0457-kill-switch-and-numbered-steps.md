# 0457: The kill switch's banners and the numbered steps

Date: 3 Nov 2026. Console v3 brief, Phase 6 "Kill switch", "Practice reset" and "Purge".

- **Levels.** The prototype shows each level as a card with its description. `ChoiceChips` holds no description and is not this scope's to change, and one screen does not earn a new component (CLAUDE.md rule 7), so the level is chosen with chips and its description shows under them once chosen. Follow-up: description cards if the owner wants every level's at once.
- **Engaging.** Unchanged: a level, its target, a reason of 3 to 500 characters, then a second, confirming press.
- **Engaged.** Each engaged control is a red `Banner` with Release (its name, "Release Venue freeze", for a screen reader); Release opens the reason under it. A freeze's release still takes two super admins.
- **Steps.** `StepList` gains a `cards` look: each step a raised card with its own action and content. A later step's button shows disabled until its turn. Its card is not dimmed as in the prototype: dimmed words would fall under 4.5:1; its title is muted instead.
- **Purge has four steps, not three.** Freeze; a second super admin asks (A4-13, kept: one person never both asks and purges); the archive; the purge. The prototype's three leave out the ask. The archive's step opens only for the super admin who did not ask, and the purge's once the archive is made and recorded on this screen.
- **Practice reset.** Switch to the practice venue (for staff with both venues), then the reset, disabled until then.
