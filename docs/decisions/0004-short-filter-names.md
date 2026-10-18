# 0004 Short package names in --filter

Date: 18 Oct 2026

CLAUDE.md writes `pnpm test --filter domain` and `pnpm storybook --filter ui`, while the packages are named `@rivr/domain` and `@rivr/ui` so imports read `@rivr/...`. Turborepo does not match an unscoped name against a scoped package.

Decision: root scripts call Turborepo through `scripts/turbo.mjs`, which turns `--filter domain` into `--filter @rivr/domain` when `packages/domain` exists and passes every other argument through, including anything after `--`. Apps are unscoped (`player`, `console`), so `--filter player` already matches.
