-- Home's tonight (#87, decision 0116): each table's open seats, and the member's own identity check,
-- jackpot and next tournament, at their own venue only, each behind its feature. 211 Ishaan (club member,
-- check finished), 218 (club member, no check yet), 301 Asha (practice venue), 104 Sana (staff at both).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- Tournaments to choose from: the next published one wins, never an unpublished or a past one.
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published) values
  ('00000000-0000-4000-8000-000000000001', 'Test unpublished', now() + interval '10 minutes', 100000, null, false),
  ('00000000-0000-4000-8000-000000000001', 'Test past', now() - interval '1 hour', 100000, null, true),
  ('00000000-0000-4000-8000-000000000001', 'Test next', now() + interval '20 minutes', 200000, 5000000, true),
  ('00000000-0000-4000-8000-000000000002', 'Practice next', now() + interval '30 minutes', 100000, null, true);

-- What each venue holds, read as the database's owner.
create temporary table jackpots as select v.id as venue_id, private.main_pool(v.id) as jackpot from public.venue v;
create temporary table seats as
select t.id as table_id, t.venue_id,
       greatest(t.seats - (select count(*)::integer from (
         select s.seat from public.seat_session s where s.table_id = t.id and s.ended_at is null
         union
         select e.call_seat from public.waitlist_entry e where e.call_table_id = t.id and e.status = 'waiting' and e.called_at is not null
       ) taken), 0) as open_seats
from public.game_table t;
create temporary table held (entry_id uuid, member_id uuid, table_id uuid, seat integer);
grant select on jackpots, seats, held to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select results_eq($$ select is_kyc_complete, jackpot_paise, tournament_name, tournament_buy_in_paise, tournament_guarantee_paise from public.my_tonight() $$,
  $$ select true, jackpot, 'Test next'::text, 200000::bigint, 5000000::bigint from jackpots where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'a member with a finished check reads the club''s jackpot and its next published tournament');
select set_eq($$ select table_id, open_seats from public.floor_open_seats() $$,
  $$ select table_id, open_seats from seats where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'and each of the club''s tables with its open seats, and no other venue''s');

select pg_temp.as_user('00000000-0000-4000-8000-000000000218');
select is((select is_kyc_complete from public.my_tonight()), false, 'a member without a finished check is told Join needs one');

select pg_temp.as_user('00000000-0000-4000-8000-000000000301');
select results_eq($$ select jackpot_paise, tournament_name from public.my_tonight() $$,
  $$ select jackpot, 'Practice next'::text from jackpots where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'a practice member reads the practice venue''s, never the club''s');

select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select set_eq($$ select table_id from public.floor_open_seats() $$,
  $$ select table_id from seats where venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002') $$,
  'staff read the open seats at each venue they work at');

-- A seat held for a called member is not open: the floor calls a waiting member, not seated anywhere, to
-- an empty seat at an open table of their game.
reset role;
with called as (
  update public.waitlist_entry w set called_at = now(), hold_until = now() + interval '5 minutes', call_table_id = pick.table_id, call_seat = pick.seat
  from (
    select e.id as entry_id, t.id as table_id,
           (select min(n) from generate_series(1, t.seats) n
            where not exists (select 1 from public.seat_session s where s.table_id = t.id and s.seat = n and s.ended_at is null)
              and not exists (select 1 from public.waitlist_entry h where h.call_table_id = t.id and h.call_seat = n
                              and h.status = 'waiting' and h.called_at is not null)) as seat
    from public.waitlist_entry e
    join public.game_table t on t.table_type_id = e.table_type_id and t.is_open
    where t.venue_id = '00000000-0000-4000-8000-000000000001' and e.status = 'waiting' and e.called_at is null
      and not exists (select 1 from public.seat_session s where s.member_id = e.member_id and s.ended_at is null)
    order by e.joined_at, t.position
    limit 1
  ) pick
  where w.id = pick.entry_id and pick.seat is not null
  returning w.id, w.member_id, w.call_table_id, w.call_seat
)
insert into held select * from called;
select is((select count(*)::integer from held), 1, 'the floor calls a waiting member to a seat');
select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select is((select o.open_seats from public.floor_open_seats() o join held h on h.table_id = o.table_id),
  (select s.open_seats - 1 from seats s join held h on h.table_id = s.table_id), 'and the seat held for them is not open');

-- Seated in the seat held for them before their place closes, it still counts once.
reset role;
insert into public.visit (venue_id, member_id)
select '00000000-0000-4000-8000-000000000001', h.member_id from held h
where not exists (select 1 from public.visit v where v.member_id = h.member_id and v.closed_at is null);
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat)
select '00000000-0000-4000-8000-000000000001', h.member_id,
       (select v.id from public.visit v where v.member_id = h.member_id and v.closed_at is null), h.table_id, h.seat
from held h;
select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select is((select o.open_seats from public.floor_open_seats() o join held h on h.table_id = o.table_id),
  (select s.open_seats - 1 from seats s join held h on h.table_id = s.table_id), 'a held seat the member sits in counts once');

-- Without the live floor, no jackpot and no open seats; without tournament registration, no tournament.
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'floor.live_view', false, 'pgTAP: live floor off'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'tournaments.register', false, 'pgTAP: registration off');
select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select results_eq($$ select is_kyc_complete, jackpot_paise, tournament_name from public.my_tonight() $$,
  $$ values (true, null::bigint, null::text) $$, 'without the features, the member reads no jackpot and no tournament');
select is_empty($$ select * from public.floor_open_seats() $$, 'and no open seats');

reset role;
select ok(not has_function_privilege('anon', 'public.my_tonight()', 'execute')
          and not has_function_privilege('anon', 'public.floor_open_seats()', 'execute'), 'nobody signed out reads them');

select * from finish();
rollback;
