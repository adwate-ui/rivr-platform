# 0266: The spin wheel

Date: 28 Oct 2026. Issue #150; additions "Spin wheel".

- **Qualifying.** A member qualifies through a promotion with the spin effect. The template deck gains Spin the wheel: a spin after four hours at the tables, once a club day. The floor (`floor.manage`) sees the spins waiting in the console and spins each one with the member.
- **Prizes and odds.** The wheel's prizes are points, bonus in whole ₹50 chips, or nothing, each with a weight from 1 to 1,000. A prize's odds are its weight out of the weights of the prizes that can be drawn now. Staff who run promotions add prizes and take them off; a prize taken off is kept, because spins name it.
- **Budget.** `spin.budget` caps the bonus that spins give in a club month. A bonus prize more than what is left is off the wheel for that spin, and the other prizes share its rolls. With no budget set, there are no bonus prizes. Points prizes are not budgeted, since points have their own catalogue. When no prize can be drawn, the spin waits. The console marks a bonus the budget cannot pay, and the TV shows only the prizes that can be won.
- **The draw.** The server draws the roll from `gen_random_bytes`, and `spinPrize` in `@rivr/domain` lands it on a prize. Its SQL twin is `private.spin_prize`, and both are proved on `packages/testing/golden/spin.json`. The roll and the odds are stored with each spin.
- **The kill switch.** Switching promotions off stops spins and changes to the wheel, as it stops every other promotion payout.
- **Posting.** Points post through `credit_points`, and a bonus through `credit_bonus` with seven days to use it. The grant is then fulfilled. Spins are taken one at a time at a venue, so two cannot both spend the last of the budget.
- **The TV.** The spin wheel mode shows the prizes with their odds and tonight's last six spins, named as on the other boards. Each spin tells the TVs at once.
