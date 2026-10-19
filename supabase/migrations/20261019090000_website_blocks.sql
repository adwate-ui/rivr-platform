-- The website's other blocks (#35): house rules, questions, careers and how to find the club.
-- Their content's shape is @rivr/contracts siteBlockSchema; the website skips a block it cannot read.

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'text', 'rules', 'faq', 'careers', 'map'));
