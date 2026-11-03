# 0457: The kill switch's banners and the numbered steps

Date: 3 Nov 2026. Console v3 brief, Phase 6 "Kill switch", "Practice reset" and "Purge".

- **Levels.** Each level is a card with what it does, as in the prototype: `ChoiceChips look="card"` with each option's `description`, read as the choice's description. Chosen, a card is gold-edged, as every console choice is; the prototype's red edge is left out, as red is kept for the engaged control.
- **Engaging.** Unchanged: a level, its target, a reason of 3 to 500 characters, then a second, confirming press.
- **Engaged.** Each engaged control is a red `Banner` with Release (its name, "Release Venue freeze", for a screen reader); Release opens the reason under it. A freeze's release still takes two super admins.
- **Steps.** `StepList` gains a `cards` look: each step a raised card with its own action and content. A later step's button shows disabled until its turn. Its card is not dimmed as in the prototype: dimmed words would fall under 4.5:1; its title is muted instead.
- **Purge has four steps, not three.** Freeze; a second super admin asks (A4-13, kept: one person never both asks and purges); the archive; the purge. The prototype's three leave out the ask. The archive's step opens only for the super admin who did not ask, and the purge's once the archive is made and recorded on this screen.
- **Practice reset.** Switch to the practice venue (for staff with both venues), then the reset, disabled until then.
