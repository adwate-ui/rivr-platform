# 0023 pnpm audit ignores one dev-only braces advisory

Date: 18 Oct 2026

`pnpm audit --audit-level high` (the CI `security` job) fails on GHSA-vfj7-8cjw-p6xm: `braces` <=3.0.3 can exhaust the stack on deeply nested brace patterns, and no patched version exists. `braces` arrives only through dev tooling, `stylelint` and `@tailwindcss/cli` (`pnpm why braces`). Nothing that ships to an app depends on it, and the patterns those tools expand come from our own config files.

Decision: keep `--audit-level high` and ignore this one advisory by id in `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`), so every other high advisory still fails the build. Question #175 asks the owner to confirm. Remove the entry when a patched `braces` ships or the tools stop using it.
