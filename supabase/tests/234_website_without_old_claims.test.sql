-- The website's old claims (UI polish audit A-27, decision 0289): the club's website no longer says every hand is logged at
-- the table, that every hour earns points, or that rake comes back as points; a club's own words stay; and a new club's
-- website comes without them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- How many of a venue's website blocks, and page descriptions, say these words.
create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select (select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
          where p.venue_id = p_venue_id and strpos(b.content::text, p_words) > 0)
       + (select count(*)::integer from public.site_page p where p.venue_id = p_venue_id and strpos(coalesce(p.description, ''), p_words) > 0);
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'hand logged'), 0, 'the club''s website says no hand is logged at the table');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'hand is logged'), 0, 'nor that every hand is logged');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'for every hour'), 0, 'nor that every hour earns points');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Every hour'), 0, 'nor League points');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'rake back as points'), 0, 'nor that rake comes back as points');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Call time kept for every seat'), 1, 'the front page says call time is kept instead');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Points and rewards'), 1, 'and Membership''s rewards are headed Points and rewards');

-- Words the club wrote stay as written.
update public.site_block b set content = jsonb_set(b.content, '{text}', '"Every hand logged at the table, by our dealers."')
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and b.kind = 'statement' and p.slug = 'home'
  and b.content ->> 'eyebrow' = 'The RIVR difference';
select private.website_without_old_claims('00000000-0000-4000-8000-000000000001');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Every hand logged at the table, by our dealers.'), 1,
  'a line the club wrote in the editor is kept');

-- A new venue's website comes without them. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ad', 'RIVR Claims Off', 'claims-off', false, 'RIVR test', 'Test', 'TCL');
select private.add_website('00000000-0000-4000-8000-0000000000ad');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000ad', 'hand logged'), 0, 'a new club''s website says no hand is logged at the table');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000ad', 'for every hour'), 0, 'nor that every hour earns points');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000ad', 'Call time kept for every seat'), 1, 'and says call time is kept');

select * from finish();
rollback;
