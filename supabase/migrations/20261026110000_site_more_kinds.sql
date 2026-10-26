-- The website in grandpokerarena.com's way, page by page (owner, 26 Oct 2026; decision 0166): the
-- club's story beside a photo with its figures, grids of cards, a line of phrases, moments down a line,
-- a small table of figures, and the live promotions. Their content is typed by @rivr/contracts
-- (siteBlockSchema), as every kind's is.

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links',
                  'story', 'cards', 'marquee', 'timeline', 'table', 'promotions'));
