-- The website promises no WhatsApp call (decision 0697): the club's lines say the floor calls the member in the app, a
-- club's own words stay, running it again changes nothing, and a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'on WhatsApp'), 0, 'the club''s website promises no call on WhatsApp');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'the floor calls you in the app'), 1, 'its front page says the floor calls in the app');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'floor calls you there'), 2, 'and Membership and Questions say so');

-- Running it again changes nothing.
create temp table site_before as
  select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = '00000000-0000-4000-8000-000000000001';
select private.website_calls_in_the_app('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' $$,
              $$ select id, content from site_before $$, 'running it again leaves the website as it is');

-- A new club's website comes that way; one whose band a club rewrote keeps its own words. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c5', 'RIVR App Call', 'app-call', false, 'RIVR test', 'Test', 'TAC');
select private.add_website('00000000-0000-4000-8000-0000000000c5');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c5', 'on WhatsApp'), 0, 'a new club''s website promises no call on WhatsApp');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c5', 'the floor calls you in the app'), 1, 'and says the floor calls in the app');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c6', 'RIVR Own Band', 'own-band', false, 'RIVR test', 'Test', 'TOB');
select private.add_website_with_privacy_sentry('00000000-0000-4000-8000-0000000000c6');
update public.site_block b
set content = replace(b.content::text, '"Request a seat before you leave home. When one opens, the floor calls you on WhatsApp."',
                      '"Book ahead. When a seat opens, the floor calls you on WhatsApp, and our host says hello."')::jsonb
from public.site_page p where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c6';
select private.website_calls_in_the_app('00000000-0000-4000-8000-0000000000c6');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c6', 'our host says hello'), 1, 'a club''s own words stay');

select ok(not has_function_privilege('service_role', 'private.website_calls_in_the_app(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'private.website_calls_in_the_app(uuid)', 'execute'), 'only migrations and the system rewrite the website');

select * from finish();
rollback;
