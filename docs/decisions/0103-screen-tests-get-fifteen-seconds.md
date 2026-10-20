# 0103: A screen test gets fifteen seconds before it counts as hung

Date: 2026-10-20 · With four builders running checks on one machine for the training release

Tests that render React in jsdom and type into a form take two to five seconds each. With four
builders' checks sharing one machine, and on GitHub's runners, some ran just past Vitest's five-second
default and failed at random: the player's install-offer test in CI on #389 (5.2 s), and the tablet's
hand form locally on #32 (5.6 s). Each passed on its own.

`@rivr/config/vitest` now gives jsdom tests 15 seconds. What a test asserts is unchanged; only how long
it may take before Vitest stops it as hung. Node tests keep five seconds, and a package can still pass
its own `testTimeout`.
