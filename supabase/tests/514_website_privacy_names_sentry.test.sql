-- The privacy notice names Sentry (decision 0672); a club's own words stay; running it again changes nothing; and a new
-- club's notice says it too.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'privacy' and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Sentry, run by Functional Software in the United States'), 1,
  'the club''s notice names Sentry');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'and Cloudflare serves the app and this website. Sentry'), 1,
  'after the line it follows, which stays');

create temp table privacy_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_privacy_names_sentry('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from privacy_before $$, 'running it again leaves the website as it is');

-- A new venue's notice says it. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c4', 'RIVR Sentry', 'sentry', false, 'RIVR test', 'Test', 'TSE');
select private.add_website('00000000-0000-4000-8000-0000000000c4');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c4', 'Sentry, run by Functional Software'), 1, 'a new club''s notice names Sentry');

-- A club's own words stay.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c5', 'RIVR Own Words', 'own-words', false, 'RIVR test', 'Test', 'TOW');
select private.add_website_before_sentry('00000000-0000-4000-8000-0000000000c5');
update public.site_block b
set content = replace(b.content::text, 'and Cloudflare serves the app and this website.', 'and Cloudflare serves our pages.')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c5' and p.slug = 'privacy';
select private.website_privacy_names_sentry('00000000-0000-4000-8000-0000000000c5');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c5', 'Cloudflare serves our pages.'), 1, 'a line the club rewrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c5', 'Sentry'), 0, 'and not added to');

select * from finish();
rollback;
