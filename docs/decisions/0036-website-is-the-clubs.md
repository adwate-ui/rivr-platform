# 0036 The website shows the club's pages

Date: 18 Oct 2026. Task #9.

RIVR runs one club and a practice venue. The public views `public_site_page` and `public_site_block` hold only the published pages of venues that are not the practice venue, so the website reads them with no venue slug: they are the club's. Sign-up picks the club the same way, as the one venue that is not the practice venue. The production venue's slug is then never part of the website's configuration.

- A second club would need a venue on every website request, by hostname or by setting. That is a change to `fetchSitePage` and the views, not to the pages.
- A page's address is its `slug`; the front page is `home` and lives only at `/`.
- When the content cannot be read, every page says the website is not available (503). Any address without a page, including one with no route, is the 404 page. Both keep the visitor's referral and UTM codes on the way home.
