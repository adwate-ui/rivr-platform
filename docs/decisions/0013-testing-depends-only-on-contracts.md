# 0013 @rivr/testing depends only on @rivr/contracts

Date: 18 Oct 2026

The domain's own tests use `@rivr/testing` (golden loader, factories, ids). If `@rivr/testing` imported `@rivr/domain`, the two packages would depend on each other, and a domain bug could hide in a fixture built with the code under test.

Decision: `@rivr/testing` imports `@rivr/contracts` and nothing else. Fixture amounts are written in paise through `paiseSchema`, with the rupee value in a comment. Golden files hold amounts as text (`"₹2,449.50"`); the test that runs them reads the text with the domain's `parseRupees`, which has its own unit and property tests. The golden loader takes imported JSON rather than reading files, so it needs no Node built-ins and type-checks in every package.

Seed times are UTC `Date`s written as IST wall-clock times (`ist('2026-11-17 00:10')`). The design prompt's clock, "Tuesday 00:10", is taken as Tuesday 17 Nov 2026, the first Tuesday after the 15 Nov launch; Arjun's bonus expires at the end of Sunday 22 Nov.

A dependency-cruiser rule enforcing this import boundary is still to be added to `.dependency-cruiser.cjs`.
