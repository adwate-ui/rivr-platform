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

Pages come from `site_page` and `site_block` through the `public_site_page` and `public_site_block` views (`@rivr/db/site`), which hold only the club's published pages (decision 0036). A draft or unknown address is a 404 and content that cannot be read a 503, each with a way home that keeps the codes. A block is a kind from `siteBlockSchema` in `@rivr/contracts` drawn by its `@rivr/ui` block; one the website cannot read is left out. The live blocks read `public_table_status` and `public_waitlist_length` (games and stakes, with how many wait) and `public_tournament_calendar`, only on a page that has them; if any cannot be read, the page is a 503. `/links` is the link-in-bio page (#39), out of the navigation. `PUBLIC_PLAYER_URL` is the player app's address (the local one by default; `STAGING_PLAYER_URL` and `PROD_PLAYER_URL` in CI).

The frame is grandpokerarena.com's (#616, decision 0283):
- **Top bar:** the club's contacts (`CLUB_CONTACT` in `links.ts`, placeholders until the owner gives them) and the member app.
- **Menu:** a fixed list in `SitePage`, whose The Room and Games items go to bands on the front page by their anchors. A band's anchor comes from its eyebrow, or from its kind.
- **Reserve a seat:** a WhatsApp message to the club.
- **Footer:** columns of links and the helplines.
- **Cookie banner:** offers Essential and Maps only. `Document.astro`'s script opens it while the browser holds no choice, and gives the Visit map its address once maps are allowed.

`astro check` runs as the typecheck. Every visible element comes from `@rivr/ui`, every word from `@rivr/i18n`.


A draft's preview (#129, decision 0270): `src/pages/preview/[token].astro` loads it with `loadPreview`, through a client made with the draft's `previewToken`, which `public_site_preview` reads from the `x-site-preview` header. It is never indexed (`X-Robots-Tag: noindex`) and never shows the practice venue's drafts.

## Who builds what

Lane C owns every page and block.
