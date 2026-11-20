# 0706 A visit's Bonus cap starts at its first Bonus use

Date: 20 Nov 2026. The owner's ruling, 20 Nov ("First use of the visit"), with Bonus used without a seat. Supersedes decision 0579's start point, the first seat; the rest of 0579 stands.

- **Base.** `bonus.visit_cap` is a share of the Bonus the member held as the visit's first Bonus use began: a seat's buy-in that redeems Bonus (`redeem_bonus_at_seat`, chips above 0) or a use without a seat (`use_bonus`).
- **Noted where Bonus is drawn.** `private.draw_bonus` notes it on the open visit (`visit.bonus_at_first_seat_paise`, a name kept from 0579) before it takes any. A seat without Bonus notes nothing. A use a super admin adds after the fact (`add_bonus_use`, no cap) notes nothing either.
- **Before any use** the cap is the share of the Bonus in force now, as before.
- **Undo.** A note is forgotten when a seat is undone and the visit has no Bonus use left. A seat whose buy-in used Bonus cannot be undone, so the use that noted the base stays.
- **At release**, an open visit whose note came from a seat with no Bonus loses it, and takes its base from its first use.
- **Twins.** `visitBonusCap` and `visitBonusLeft` are unchanged. Only what they are given changes, so `bonus.json` keeps its cases.
