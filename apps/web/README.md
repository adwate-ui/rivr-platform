# web

The public website, rendered on demand by Astro on a Cloudflare Worker (`docs/decisions/0021`). Its content lives in Supabase and is read only through the `public_*` views, which never include the practice venue.

## Run it

```
pnpm db:start
pnpm dev --filter web
```

It listens on this worktree's port `<block>45`. `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` default to the local stack.

## Structure

```
src/
  layouts/Document    the HTML document around every page: title, description, styles
  pages/              Astro pages: index.astro (the front page), [slug].astro (every other) and
                      404.astro (an address with no route)
  features/site/      loadPage (read per request into a SiteView), Website (the page, or the
                      missing or unavailable page), the blocks, and links that carry the visitor's
                      referral and UTM codes into the player app (#10, decision 0031)
```

Pages come from `site_page` and `site_block` through the `public_site_page` and `public_site_block` views (`@rivr/db/site`), which hold only the club's published pages (decision 0036). A draft or unknown address is a 404 and content that cannot be read a 503, each with a way home that keeps the codes. A block is a kind from `siteBlockSchema` in `@rivr/contracts` drawn by its `@rivr/ui` block; one the website cannot read is left out. The live blocks read `public_table_status` (games and stakes) and `public_tournament_calendar`, only on a page that has them; if either cannot be read, the page is a 503. `PUBLIC_PLAYER_URL` is the player app's address (the local one by default; `STAGING_PLAYER_URL` and `PROD_PLAYER_URL` in CI).

`astro check` runs as the typecheck. Every visible element comes from `@rivr/ui`, every word from `@rivr/i18n`.

## Who builds what

Lane C owns every page and block.
