# 0055 Tap to confirm is measured on a calibrated slow CPU

Date: 19 Oct 2026. Task #46.

- The spec names no dealer tablet model. The stand-in is Lighthouse's mid-range mobile setting: a CPU four times slower than a desktop.
- A fixed slowdown would punish slower hosts: GitHub's runners are slower than a development machine, so 4x there is a slower device than the tablet. The flow times a fixed piece of JavaScript at full speed and slows the page so that it runs four times slower than the reference machine (an AMD Ryzen 5 5600X, 12.7 ms for the benchmark): `rate = max(1, 4 × 12.7 / measured)`.
- One hand is logged untimed first, so the first timed tap is not a cold start; each tap waits until the last hand has reached the database, so the count never dips while it is timed.
- The time runs from the press (`pointerdown`) to the next frame drawn after "Hands this down" counts the hand. The tablet confirms from its queue (#43), before the hand is sent, so the budget measures the dealer's wait, not the network.
- If a dealer tablet model is chosen, replace the stand-in with its own benchmark time.
