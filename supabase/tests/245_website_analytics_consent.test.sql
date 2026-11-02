-- The privacy notice's cookies section says analytics loads only with a yes (decision 0298): on the club's website, on a
-- new club's, and never over words a club wrote itself.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.cookies(p_venue uuid) returns text language sql as $$
  select b.content ->> 'body' from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue and p.slug = 'privacy' and b.content ->> 'heading' = 'Cookies on this website';
$$;

select ok(strpos(pg_temp.cookies('00000000-0000-4000-8000-000000000001'), 'Without your yes, neither loads.') > 0,
  'the club''s privacy notice says analytics loads only with a yes');
select ok(strpos(pg_temp.cookies('00000000-0000-4000-8000-000000000001'), 'runs no analytics') = 0, 'and no longer that there is none');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
select private.add_website('00000000-0000-4000-8000-0000000000e1');
select ok(strpos(pg_temp.cookies('00000000-0000-4000-8000-0000000000e1'), 'Analytics and ads in Profile') > 0, 'a new club''s says the same');

-- A club that wrote its own cookies section keeps it.
update public.site_block b set content = jsonb_set(b.content, '{body}', '"Our own words."')
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'privacy'
  and b.content ->> 'heading' = 'Cookies on this website';
select private.website_analytics_consent('00000000-0000-4000-8000-000000000001');
select is(pg_temp.cookies('00000000-0000-4000-8000-000000000001'), 'Our own words.', 'a club''s own words stay');

select * from finish();
rollback;
