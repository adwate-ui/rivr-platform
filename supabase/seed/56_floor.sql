-- The design prompt's floor at the clock, Tuesday 00:10 (section 5; #54), in both venues: the seed
-- runs at 00:10, so every time is that many minutes before it (decision 0120). The waitlists and
-- jackpots are in 55_waitlist.sql and 20_balances.sql; here tonight's high hand (four of a kind,
-- queens, Table 2, 22:18, ₹2,000) and Pema Lepcha dealing Table 3 from 23:40, each on the table's own
-- tablet. The high hand goes through the functions the tablet and the console use, so its rake, its
-- payout and their ledger postings are the real ones; a pot of ₹4,800 drops nothing into the
-- jackpot, which stays ₹3,42,600. Staging seeds on every deploy, so a venue whose floor has moved on
-- since is left alone.

-- The dealer tablets of Tables 2 and 3 in each venue. Each has its own login, as pairing gives one,
-- with no password anyone keeps, so it never signs in.
insert into auth.users (
  instance_id, id, aud, role, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
  recovery_token, email_change_token_new, email_change, phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', t.login, 'authenticated', 'authenticated', t.phone, jsonb_build_object('device_id', t.device),
       '{}', now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000005d21'::uuid, '00000000-0000-4000-8000-000000005e21'::uuid, '999000000005021'),
  ('00000000-0000-4000-8000-000000005d31'::uuid, '00000000-0000-4000-8000-000000005e31'::uuid, '999000000005031'),
  ('00000000-0000-4000-8000-000000005d22'::uuid, '00000000-0000-4000-8000-000000005e22'::uuid, '999000000005022'),
  ('00000000-0000-4000-8000-000000005d32'::uuid, '00000000-0000-4000-8000-000000005e32'::uuid, '999000000005032')
) as t (device, login, phone)
on conflict (id) do nothing;

-- Only those not there yet: the device trigger refuses any write, even one that would change
-- nothing, while the venue is frozen.
insert into public.device (id, venue_id, kind, name, auth_user_id)
select t.id, t.venue_id, 'dealer_tablet', t.name, t.login
from (values
  ('00000000-0000-4000-8000-000000005d21'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'Table 2 tablet', '00000000-0000-4000-8000-000000005e21'::uuid),
  ('00000000-0000-4000-8000-000000005d31'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'Table 3 tablet', '00000000-0000-4000-8000-000000005e31'::uuid),
  ('00000000-0000-4000-8000-000000005d22'::uuid, '00000000-0000-4000-8000-000000000002'::uuid, 'Table 2 tablet', '00000000-0000-4000-8000-000000005e22'::uuid),
  ('00000000-0000-4000-8000-000000005d32'::uuid, '00000000-0000-4000-8000-000000000002'::uuid, 'Table 3 tablet', '00000000-0000-4000-8000-000000005e32'::uuid)
) as t (id, venue_id, name, login)
where not exists (select 1 from public.device d where d.id = t.id);

-- Each fixed to its table, unless the table has another tablet by now or this one was revoked.
insert into public.tablet_assignment (device_id, venue_id, table_id)
select d.id, d.venue_id, t.id
from public.device d
join public.game_table t on t.venue_id = d.venue_id and t.name = replace(d.name, ' tablet', '')
where d.id in ('00000000-0000-4000-8000-000000005d21', '00000000-0000-4000-8000-000000005d31',
               '00000000-0000-4000-8000-000000005d22', '00000000-0000-4000-8000-000000005d32')
  and d.revoked_at is null
  and not exists (select 1 from public.tablet_assignment a where a.device_id = d.id or a.table_id = t.id);

-- Acts as a signed-in login for the functions below, which know who is calling only from the token.
create function pg_temp.seed_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- True when the venue's floor is as a fresh seed leaves it: no seeded high hand yet, Pema on the staff,
-- the seeded tablets at Tables 2 and 3, and no down open for Pema or at either table.
create function pg_temp.floor_is_fresh(p_venue_id uuid, p_tablets uuid[]) returns boolean language sql as $$
  select not exists (select 1 from public.hand h where h.venue_id = p_venue_id and h.idempotency_key = 'seed:high-hand')
     and exists (select 1 from public.staff s where s.venue_id = p_venue_id and s.user_id = '00000000-0000-4000-8000-000000000106')
     and (select count(*) from public.tablet_assignment a join public.device d on d.id = a.device_id
          join public.game_table t on t.id = a.table_id
          where a.device_id = any (p_tablets) and t.name = replace(d.name, ' tablet', '')) = 2
     and not exists (
       select 1 from public.dealer_down d
       where d.ended_at is null and d.venue_id = p_venue_id
         and (d.staff_id in (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106')
              or d.table_id in (select a.table_id from public.tablet_assignment a where a.device_id = any (p_tablets))));
$$;

-- In one venue: Pema's down at Table 2 from 21:40, where she deals the high hand at 22:18 and the
-- floor (Aditya Malhotra) pays it; her down ends at 23:20 with the drop box as logged; then her down
-- at Table 3 from 23:40. A venue frozen, or with promotions off, is left alone.
create function pg_temp.seed_floor(p_venue_id uuid, p_table2_tablet uuid, p_table3_tablet uuid) returns void language plpgsql as $$
declare
  v_pema uuid := (select s.id from public.staff s where s.venue_id = p_venue_id and s.user_id = '00000000-0000-4000-8000-000000000106');
  v_table2_login uuid := (select d.auth_user_id from public.device d where d.id = p_table2_tablet);
  v_hand uuid;
  v_claim uuid;
  v_down uuid;
begin
  if not pg_temp.floor_is_fresh(p_venue_id, array[p_table2_tablet, p_table3_tablet]) then
    raise notice 'Floor seed: venue % has moved on, so it is left alone', p_venue_id;
    return;
  end if;
  begin
    insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
    select p_venue_id, a.table_id, v_pema, p_table2_tablet, now() - interval '150 minutes'
    from public.tablet_assignment a where a.device_id = p_table2_tablet
    returning id into v_down;
    perform pg_temp.seed_as(v_table2_login);
    v_hand := public.log_hand(480000, 'holdem', now() - interval '112 minutes', 'seed:high-hand');
    v_claim := public.claim_high_hand(v_hand, 5, 'four_of_a_kind', 'Q');
    perform pg_temp.seed_as('00000000-0000-4000-8000-000000000103');
    perform public.approve_high_hand(v_claim, 200000);
    perform pg_temp.seed_as(v_table2_login);
    perform public.end_down((select h.rake_paise + h.drop_paise from public.hand h where h.id = v_hand));
    update public.dealer_down set ended_at = now() - interval '50 minutes' where id = v_down;
    insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
    select p_venue_id, a.table_id, v_pema, p_table3_tablet, now() - interval '30 minutes'
    from public.tablet_assignment a where a.device_id = p_table3_tablet;
  exception when sqlstate 'RVFRZ' or sqlstate 'RVKIL' then
    raise notice 'Floor seed: venue % is frozen or has promotions off, so it is left alone', p_venue_id;
  end;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

select pg_temp.seed_floor('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000005d21', '00000000-0000-4000-8000-000000005d31');
select pg_temp.seed_floor('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000005d22', '00000000-0000-4000-8000-000000005d32');
