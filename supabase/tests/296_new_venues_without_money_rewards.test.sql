-- Hourly rakeback and hotel nights start off and hidden at a venue (the owner, 3 Nov): the seed's club, made by the
-- bootstrap after the migration, and a venue made now. 202 Kabir is a member of the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Each tier's cell in force now for a feature.
create function pg_temp.cells(p_venue_id uuid, p_key text) returns table (is_enabled boolean, display_mode text) language sql as $$
  select c.is_enabled, c.display_mode::text
  from public.tier t
  cross join lateral (
    select f.is_enabled, f.display_mode from public.tier_feature f
    where f.tier_id = t.id and f.feature_key = p_key and f.effective_from <= now()
    order by f.effective_from desc limit 1
  ) c
  where t.venue_id = p_venue_id;
$$;

select results_eq($$ select distinct is_enabled, display_mode from pg_temp.cells('00000000-0000-4000-8000-000000000001', 'rewards.rakeback') $$,
  $$ values (false, 'hidden') $$, 'the club''s tiers have hourly rakeback off and hidden');
select results_eq($$ select distinct is_enabled, display_mode from pg_temp.cells('00000000-0000-4000-8000-000000000001', 'rewards.accommodation') $$,
  $$ values (false, 'hidden') $$, 'and hotel nights too');
select results_eq($$ select state from private.feature_state('00000000-0000-4000-8000-000000000202', 'rewards.accommodation') $$,
  $$ values ('hidden'::text) $$, 'so Rewards shows Kabir no hotel nights');

-- A new venue, made as the system, as in 238.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ae', 'RIVR Money Off', 'money-off', false, 'RIVR test', 'Test', 'TMO');
select results_eq($$ select is_enabled, display_mode from pg_temp.cells('00000000-0000-4000-8000-0000000000ae', 'rewards.rakeback') $$,
  $$ values (false, 'hidden'), (false, 'hidden'), (false, 'hidden'), (false, 'hidden') $$, 'a new venue''s tiers start with hourly rakeback off and hidden');
select results_eq($$ select is_enabled, display_mode from pg_temp.cells('00000000-0000-4000-8000-0000000000ae', 'rewards.accommodation') $$,
  $$ values (false, 'hidden'), (false, 'hidden'), (false, 'hidden'), (false, 'hidden') $$, 'and hotel nights');
select results_eq($$ select distinct is_enabled from pg_temp.cells('00000000-0000-4000-8000-0000000000ae', 'fnb.table_side') $$,
  $$ values (true) $$, 'while the rest are on, as before');

select * from finish();
rollback;
