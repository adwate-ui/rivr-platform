-- The front page in the Grand Poker Arena style (#441, decision 0118): a statement set large across the
-- page, a gallery of the club's own photos, and one picture beside its words. Their content is typed by
-- @rivr/contracts (siteBlockSchema), as every kind's is; its media is the website's own files.

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links'));
