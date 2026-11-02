# 0299: The floor and the waitlist, as the owner runs them

Date: 2 Nov 2026. The owner's list after the staging walks (super admin section).

- **Stakes.** "Straddle option in NEW Stakes" and "Game type is not needed when adding stakes - reserves future flexibility". A stake is its name, its blinds and any compulsory straddle (whole ₹50 chips above the big blind, `table_type.straddle_paise`, which the website already reads). The game is no longer asked: `table_type.game` may be empty, a stake made from now has none and its code comes from its blinds (`100_200`), and a stake made before keeps its game, shown in games history as before. Changing a stake sets or takes off its straddle too.
