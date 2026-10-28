# 0270: The website editor

Date: 28 Oct 2026. Issue #129; features "Website editing"; additions flow 17.

- Staff with `website.edit` choose a page in the console's Website screen. Marketing has `website.edit`, and a super admin has every permission. The page's words are changed in place, block by block. Links, pictures and addresses stay as they are, and a page's blocks are not added to, removed or moved, as there is no page builder.
- **Draft.** Saving makes the page's draft, one a page. The first save keeps what the page showed until then as its first version.
- **Preview.** The draft is previewed by the website itself, at `/preview/<token>`, framed in the console, so it is drawn by the same blocks. The token is the draft's own and is not indexed. The console finds the website at `VITE_WEB_URL`: locally that is the worktree's website, and in a deploy the release names it. Until then the console says the preview needs the address, and publishing still works.
- **Publish.** A draft is published now, or scheduled for a time; pg_cron publishes it within the minute, and raises an alert if the website cannot show it. Publishing replaces the page's blocks, which the public views read.
- **Cache.** The website renders each page on request, with no edge cache on its pages, so a publish is live at once and there is no cache to purge. The cache-purge adapter waits for a page cache, if one is added.
- **History.** Every version is kept: each published, and each one it replaced. Publishing an earlier one again makes it a new version, so the history only grows.
