# 0195: The website comes with the club's venue

Date: 2026-10-26 · Tasks: #406 (split from #386), #472 (the owner's choice on 26 Oct)

**The gap.** Every website page lived only in the local and staging seed (`40_site.sql` to `43_site_gpa.sql`), the privacy notice's backup statements (#386) included. Production is never seeded. The console can't create a page either: the website editor (#129, lane C) edits existing pages, and lane C is frozen until launch. So production's website would have launched empty.

**The route.** The owner chose it over adding "create a page" to #129, or a one-off copy from staging. It is a reviewed data step in a migration, `20261027000200_website_comes_with_the_venue.sql`, which CI's release applies to production like any other.

- `private.add_website(venue)` adds the club's website as the seed had it on 26 Oct: 19 pages and their blocks, the careers draft and the Privacy page included. The template was generated from the seeded database, so nothing was retyped.
- It adds each page once, by slug. A page that already exists is kept as it is, edits included.
- `private.bootstrap_venue` calls it for the club's first venue. The migration calls it for the club's venue made before, if any: production's. Staging keeps its seeded pages.
- The website is the club's (decision 0036): the public views serve every club venue's pages with no venue slug. So a later room shares the club's website rather than doubling every page, and the practice venue has none. Its one page, which proves the website never shows it, stays in `40_site.sql`.

The seed no longer inserts the club's pages: the bootstrap does, as in production, so local, staging and production start from one source. Images are the web app's own `/media` files, which deploy with it. Marketing edits the pages in the console once #129 lands; this template only seeds the club's first venue.

**After the release that carries it**, check production in the SQL editor: `select page_slug, kind from public.public_site_block where page_slug = 'privacy'` returns `hero` and `text`, and `select count(*) from public.public_site_page` returns 18 (the 19 pages less the careers draft).
