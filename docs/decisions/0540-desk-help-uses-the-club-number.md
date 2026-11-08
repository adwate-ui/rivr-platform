# 0540: The player app's way to the front desk uses the club's one number

Date: 8 Nov 2026 · From the 180-day audit of 8 Nov (F-184, I-45).

**Context.** The 8 Nov audit (F-184, I-45) found no way in the player app to reach the desk: errors say "Ask at the front
desk" with nothing to tap. The fix asked for one help entry, call or WhatsApp the desk, "from venue settings". No venue
setting holds a desk number. The club has one number for calls and WhatsApp (the owner, 3 Nov), which the website already
shows from a constant, and the sign-in steps that need help run before anyone is signed in, when no venue is known.

**Decision.** The number moves from the website's `links.ts` to `@rivr/contracts/club` (`CLUB_CONTACT`), a subpath, so
the player's first load gains no Zod. The player's `AppRoot` gives it to `@rivr/ui`'s `DeskHelpProvider`; `DeskHelp`
(Call the desk, WhatsApp the desk) ends every `StepScreen` and Profile, under Sign out (WCAG 3.2.6, the same place on
every screen that has it). The console gives no number, so its steps show none.

**Later.** If a second venue opens with its own desk, the number becomes a venue setting, read through a public view for
the signed-out steps.
