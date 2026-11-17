# 0686 pnpm audit skips the picomatch advisory until a fix ships

Date: 17 Nov 2026. Question #1069.

`pnpm audit --audit-level high` (the CI `security` job) began failing every branch on GHSA-fc5q-39xc-vjpf: `picomatch` <=4.0.7 can take very long on a crafted glob with single-branch repeated extglobs. No patched version exists. `picomatch` reaches us through `astro` and `@astrojs/cloudflare` (`unstorage` > `anymatch`, in the website's server build) and through dev tooling (`@tailwindcss/cli` > `@parcel/watcher` > `micromatch`). The slow match needs the pattern to be crafted; every pattern these packages match comes from our own code and config, never from a request.

Decision: as decision 0023 does for `braces`, keep `--audit-level high` and skip this one advisory by id in `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`), so every other high advisory still fails the build. Unlike `braces`, this one ships in the website's server build, which question #1069 asks the owner to accept. Remove the entry when a patched `picomatch` ships.
