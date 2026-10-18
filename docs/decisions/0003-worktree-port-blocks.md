# 0003 One port block and Supabase project per worktree

Date: 18 Oct 2026

Four lanes and a reviewer run local Supabase stacks side by side. CLAUDE.md gives each worktree a port block: root 543xx, lanes A to D 544xx to 547xx.

Decision:
- `supabase/config.template.toml` is committed; `supabase/config.toml` is generated (and gitignored) by `scripts/supabase.mjs` on every `pnpm supabase` and `pnpm db:*` run, with `project_id` set to the worktree folder name and every port taken from the block.
- The block comes from the folder name: `rivr-platform` 543, `rivr-lane-a` to `rivr-lane-d` 544 to 547, and `rivr-review` 548 (the reviewer runs pgTAP too).
- `RIVR_PORT_BLOCK`, or a gitignored `.rivr-port-block` file, overrides it when another project already holds the ports. On the first build machine the root checkout uses 549, because a poker-settle stack holds 543xx.
- App dev servers use ports 40 to 45 in the same block, so Playwright runs in two worktrees do not collide.
- Studio, analytics and the mail catcher are disabled so four stacks fit in memory.
