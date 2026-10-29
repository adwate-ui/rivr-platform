-- The website comes with the club's venue (#406, #472; decision 0195), so production, which is never seeded,
-- has it: the club's bootstrap gave it, every page and block; a later room shares the club's and the practice
-- venue has none; and adding it again changes nothing. The Privacy page says what the privacy notice promises.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select results_eq(
  $$ select p.title, p.is_published, p.nav_position from public.site_page p
     where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'privacy' $$,
  $$ values ('Privacy'::text, true, null::integer) $$,
  'the club has its published Privacy page, linked from the footer, from its bootstrap');
select ok((select b.content ->> 'body' from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'privacy' and b.kind = 'text')
          ~ 'kept for 35 days, and one backup a month for 400 days.*\n\nErasure\..*made again before the restored records are used\.$',
  'which says how long backups keep personal data, and that erasures are made again after a restore');
select is((select count(*)::integer from public.site_page where venue_id = '00000000-0000-4000-8000-000000000001'), 23,
  'the club has its whole website: the front page, the header''s and footer''s pages, the journal, the Leaderboard (#619), links and the careers draft');

select private.bootstrap_venue('00000000-0000-4000-8000-000000000a06', 'RIVR Elsewhere', 'website-test', false, 'Test Ltd', 'Somewhere', 'TST');
select private.bootstrap_venue('00000000-0000-4000-8000-000000000a07', 'Practice Elsewhere', 'website-practice', true, 'Test Ltd', 'Somewhere', 'TSP');
select is_empty($$ select * from public.site_page where venue_id = '00000000-0000-4000-8000-000000000a06' $$,
  'a later room shares the club''s website, so the public pages are never doubled');
select is_empty($$ select * from public.site_page where venue_id = '00000000-0000-4000-8000-000000000a07' $$,
  'a practice venue has no website');

-- What a venue gets: the club's every page and block, as the bootstrap gave them.
select private.add_website('00000000-0000-4000-8000-000000000a06');
create temporary table elsewhere as
select p.slug, p.title, p.description, p.nav_position, p.is_published, b.position, b.kind, b.content
from public.site_page p left join public.site_block b on b.page_id = p.id
where p.venue_id = '00000000-0000-4000-8000-000000000a06';
select set_eq(
  $$ select * from elsewhere $$,
  $$ select p.slug, p.title, p.description, p.nav_position, p.is_published, b.position, b.kind, b.content
     from public.site_page p left join public.site_block b on b.page_id = p.id
     where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'the same pages and blocks the club''s bootstrap gave it');

update public.site_block b set content = '{"body": "Edited by marketing."}'
from public.site_page p where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000a06' and p.slug = 'privacy' and b.kind = 'text';
delete from public.site_page where venue_id = '00000000-0000-4000-8000-000000000a06' and slug = 'terms';
select private.add_website('00000000-0000-4000-8000-000000000a06');
select is((select b.content ->> 'body' from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000a06' and p.slug = 'privacy' and b.kind = 'text'),
  'Edited by marketing.', 'adding it again leaves a page, and any edit to it, as it is');
select is((select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000a06'), (select count(*)::integer from elsewhere),
  'and adds back only the page that is missing, with its blocks');

set local role anon;
select results_eq(
  $$ select page_slug, kind from public.public_site_block where venue_slug = 'gurugram' and page_slug = 'privacy' order by position $$,
  $$ values ('privacy'::text, 'hero'::text), ('privacy', 'text') $$,
  'anyone reads the Privacy page on the website');
reset role;

select * from finish();
rollback;
