-- The privacy notice's Sentry line covers every app and the website (decision 0673); running it again changes nothing; a
-- new club's notice says it; a club's own words stay.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'privacy' and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'gets a report when one of RIVR''s apps or this website hits an error:'), 1,
  'the club''s notice says every app and the website report');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'gets a report when the app hits an error:'), 0, 'in place of the app alone');

create temp table privacy_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_privacy_sentry_for_every_app('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from privacy_before $$, 'running it again leaves the website as it is');

-- A new venue's notice says it. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c6', 'RIVR Every App', 'every-app', false, 'RIVR test', 'Test', 'TEA');
select private.add_website('00000000-0000-4000-8000-0000000000c6');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c6', 'one of RIVR''s apps or this website'), 1, 'a new club''s notice says it');

-- A club's own words stay.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c7', 'RIVR Own Line', 'own-line', false, 'RIVR test', 'Test', 'TOL');
select private.add_website_naming_sentry_for_the_app('00000000-0000-4000-8000-0000000000c7');
update public.site_block b
set content = replace(b.content::text, 'gets a report when the app hits an error:', 'hears of our app''s errors:')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c7' and p.slug = 'privacy';
select private.website_privacy_sentry_for_every_app('00000000-0000-4000-8000-0000000000c7');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c7', 'hears of our app''s errors:'), 1, 'a line the club rewrote is kept');

select * from finish();
rollback;
