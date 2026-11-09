-- The privacy notice names the WhatsApp bridge and its host (8 Nov audit, I-110); a club's own words stay; running it again
-- changes nothing; and a new club's notice says it too.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'privacy' and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'through Evolution API, a bridge Elestio hosts for RIVR'), 1, 'the notice names the bridge and its host');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'MSG91 sends codes by SMS when WhatsApp cannot.'), 1, 'and keeps MSG91');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'sends your sign-in codes and the club''s messages, and MSG91'), 0, 'in place of the old line');

create temp table privacy_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_privacy_names_the_bridge('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from privacy_before $$, 'running it again leaves the website as it is');

-- A new venue's notice says it. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c2', 'RIVR Bridge', 'bridge', false, 'RIVR test', 'Test', 'TBR');
select private.add_website('00000000-0000-4000-8000-0000000000c2');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c2', 'a bridge Elestio hosts for RIVR'), 1, 'a new club''s notice names them');

-- A club's own words stay.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c3', 'RIVR Own Notice', 'own-notice', false, 'RIVR test', 'Test', 'TON');
select private.add_website_with_evergreen_text('00000000-0000-4000-8000-0000000000c3');
update public.site_block b
set content = replace(b.content::text, 'MSG91 sends codes by SMS when WhatsApp cannot.', 'Our SMS provider sends codes when WhatsApp cannot.')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c3' and p.slug = 'privacy';
select private.website_privacy_names_the_bridge('00000000-0000-4000-8000-0000000000c3');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c3', 'Our SMS provider sends codes'), 1, 'a line the club rewrote is kept');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c3', 'Evolution API'), 0, 'and not replaced');

select * from finish();
rollback;
