-- Withdrawal pushes hidden with Balance (#709): no tier of any venue offers the Withdrawals switch, a new venue starts with it
-- off and hidden, and no member keeps a grant of it. 202 Kabir is a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Each tier's cell in force now.
create function pg_temp.push_cells(p_venue_id uuid) returns table (is_enabled boolean, display_mode text) language sql as $$
  select c.is_enabled, c.display_mode::text
  from public.tier t
  cross join lateral (
    select f.is_enabled, f.display_mode from public.tier_feature f
    where f.tier_id = t.id and f.feature_key = 'push.withdrawal_sent' and f.effective_from <= now()
    order by f.effective_from desc limit 1
  ) c
  where p_venue_id is null or t.venue_id = p_venue_id;
$$;

select is((select count(*)::integer from pg_temp.push_cells(null) where is_enabled), 0, 'no tier of any venue has withdrawal pushes');
select is((select count(*)::integer from pg_temp.push_cells(null) where display_mode <> 'hidden'), 0, 'and every tier hides the switch');
select results_eq($$ select state from private.feature_state('00000000-0000-4000-8000-000000000202', 'push.withdrawal_sent') $$,
  $$ values ('hidden'::text) $$, 'so Profile shows Kabir no Withdrawals switch');
select is((select count(*)::integer from public.member_feature_override where feature_key = 'push.withdrawal_sent' and is_granted and revoked_at is null),
  0, 'and no member keeps a grant of their own');

-- A new venue, made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ad', 'RIVR Push Off', 'push-off', false, 'RIVR test', 'Test', 'TPO');
select results_eq($$ select is_enabled, display_mode from pg_temp.push_cells('00000000-0000-4000-8000-0000000000ad') $$,
  $$ values (false, 'hidden'), (false, 'hidden'), (false, 'hidden'), (false, 'hidden') $$, 'a new venue''s tiers start with it off and hidden');
select is((select count(*)::integer from public.tier_feature f join public.tier t on t.id = f.tier_id
           where t.venue_id = '00000000-0000-4000-8000-0000000000ad' and f.feature_key = 'push.seat_ready' and f.is_enabled), 4,
  'and the other pushes on, as before');

select * from finish();
rollback;
