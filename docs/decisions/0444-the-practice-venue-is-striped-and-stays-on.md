# 0444: The practice venue is striped across the top, and stays on after a reload

Date: 3 Nov 2026. Console v3 brief, phase 1: "a striped banner across the top whenever it is on, with Back to the club. Keep it on after a page reload" (#811, the screenshot index).

- **Stripes.** `PracticeBanner` (@rivr/ui) draws gold and a darker gold (`color.practiceStripe`, new) at 135 degrees, its line in green-black and a "Back to the club" button on the rail's green-black. ui.md bars decorative gradients; this is a sign, the only stripes anywhere, so a trainee never takes the practice venue for the club.
- **Kept on the device.** The person who switched is kept in `localStorage` (`rivr.console.practice-for`), so a reload stays in the practice venue. Anyone else signing in on that device starts at the club, and signing out ends practice, as before. Not in the database: the choice is about this computer at this moment, not a setting that should follow the person.
- **Way back.** "Back to the club" in the stripe, and the Practice venue switch in the staff member's menu, which replaced the rail's foot.
