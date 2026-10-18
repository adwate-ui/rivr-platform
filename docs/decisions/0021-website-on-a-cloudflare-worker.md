# 0021 The website runs on a Cloudflare Worker

Date: 18 Oct 2026

`docs/engineering/stack.md` puts every web surface on Cloudflare Pages. The website is Astro rendered on demand, and the current Astro Cloudflare adapter (14) builds for Cloudflare Workers with static assets, Cloudflare's recommended target for server-rendered sites, not for Pages.

Decision: the website deploys as a Worker: `rivr-web-staging` on merge, `rivr-web` on a release tag, and a preview version per pull request with the alias `pr-<n>`. The Vite apps (player, console, display, tablet and driver bundles) and Storybook stay on Pages. `scripts/ci/cloudflare-deploy.mjs` handles both, with the same API token.

The adapter declares a KV binding, `SESSION`, for Astro sessions. Wrangler provisions it on the first deploy; the website does not use sessions yet. `wrangler deploy --dry-run` from `apps/web` passes.
