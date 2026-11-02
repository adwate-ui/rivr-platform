-- Cab requests off (audit of 28 Oct, F3-01; decision 0285): no tier offers them, so Kabir (620), with four visits this
-- month, is offered no cab and cannot ask for one; the website shows no cab rule; and a new venue starts with them off.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Each tier's cell in force now.
create function pg_temp.cab_cells(p_venue_id uuid) returns table (is_enabled boolean, display_mode text) language sql as $$
  select c.is_enabled, c.display_mode::text
  from public.tier t
  cross join lateral (
    select f.is_enabled, f.display_mode from public.tier_feature f
    where f.tier_id = t.id and f.feature_key = 'cab.requests' and f.effective_from <= now()
    order by f.effective_from desc limit 1
  ) c
  where p_venue_id is null or t.venue_id = p_venue_id;
$$;

select is((select count(*)::integer from pg_temp.cab_cells(null) where is_enabled), 0, 'no tier of any venue has cab requests');
select is((select count(*)::integer from pg_temp.cab_cells(null) where display_mode <> 'hidden'), 0, 'and every tier hides them rather than locks them');
select results_eq($$ select state from private.feature_state('00000000-0000-4000-8000-000000000620', 'cab.requests') $$,
  $$ values ('hidden'::text) $$, 'so the app hides Rewards'' cab section from Kabir');

select pg_temp.as_person('00000000-0000-4000-8000-000000000620');
select is((select count(*)::integer from public.my_cab()), 0, 'Kabir, with four visits this month, is offered no cab');
select throws_ok($$ select public.request_cab('pickup', 'Sector 54, Golf Course Road', '21:30') $$, '42501', null,
  'and cannot ask for one');
reset role;

select is((select count(*)::integer from public.public_club_rules where key = 'cab.minimum_visits'), 0,
  'the website shows no cab rule');
select is((select count(*)::integer from public.member_feature_override where feature_key = 'cab.requests' and is_granted and revoked_at is null),
  0, 'and no member keeps a grant of cab requests of their own');

-- The website's line on a cab home: ask the front desk. Once on a card, it is on the photo tiles since 242.
create function pg_temp.cards_saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and b.kind in ('cards', 'gallery') and strpos(b.content::text, p_words) > 0;
$$;
select is(pg_temp.cards_saying('00000000-0000-4000-8000-000000000001', 'Ask the front desk for a cab home.'), 1,
  'the club''s website says to ask the front desk for a cab home');
select is(pg_temp.cards_saying('00000000-0000-4000-8000-000000000001', 'members who play often'), 0, 'and promises no cab for visits');

-- A new venue: every gateable feature but the four that start off. Made as the system, as in 173.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ac', 'RIVR Cab Off', 'cab-off', false, 'RIVR test', 'Test', 'TCO');
select results_eq($$ select is_enabled, display_mode from pg_temp.cab_cells('00000000-0000-4000-8000-0000000000ac') $$,
  $$ values (false, 'hidden'), (false, 'hidden'), (false, 'hidden'), (false, 'hidden') $$, 'a new venue''s tiers start with cab requests off');
select is((select count(*)::integer from public.tier_feature f join public.tier t on t.id = f.tier_id
           where t.venue_id = '00000000-0000-4000-8000-0000000000ac' and f.feature_key = 'fnb.table_side' and f.is_enabled), 4,
  'and every other feature on, as before');
select private.add_website('00000000-0000-4000-8000-0000000000ac');
select is(pg_temp.cards_saying('00000000-0000-4000-8000-0000000000ac', 'Ask the front desk for a cab home.'), 1,
  'and its website, when it gets one, says to ask the front desk too');

select * from finish();
rollback;
