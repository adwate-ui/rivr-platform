-- Home's tonight (#87, decision 0116): each table's open seats, and the member's own identity check,
-- jackpot and next tournament, at their own venue only. 211 Ishaan (club member, check finished), 218
-- (club member, no check yet), 301 Asha (practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- What each venue holds, read as the database's owner.
create temporary table expected as
select v.id as venue_id,
       coalesce((select b.natural_balance from public.ledger_balance b where b.venue_id = v.id and b.code = 'venue.jackpot.main'), 0)::bigint as jackpot,
       (select t.name from public.tournament t where t.venue_id = v.id and t.is_published and t.starts_at >= now()
        order by t.starts_at limit 1) as tournament
from public.venue v;
create temporary table seats as
select t.id as table_id, t.venue_id,
       greatest(t.seats - (select count(*)::integer from public.seat_session s where s.table_id = t.id and s.ended_at is null)
                - (select count(*)::integer from public.waitlist_entry e
                   where e.call_table_id = t.id and e.status = 'waiting' and e.called_at is not null), 0) as open_seats
from public.game_table t;
create temporary table held (table_id uuid);
grant select on expected, seats, held to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select results_eq($$ select is_kyc_complete, jackpot_paise, tournament_name from public.my_tonight() $$,
  $$ select true, jackpot, tournament from expected where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'a member with a finished check reads the club''s jackpot and its next tournament');
select set_eq($$ select table_id, open_seats from public.floor_open_seats() $$,
  $$ select table_id, open_seats from seats where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'and each of the club''s tables with its open seats, and no other venue''s');

select pg_temp.as_user('00000000-0000-4000-8000-000000000218');
select is((select is_kyc_complete from public.my_tonight()), false, 'a member without a finished check is told Join needs one');

select pg_temp.as_user('00000000-0000-4000-8000-000000000301');
select results_eq($$ select jackpot_paise, tournament_name from public.my_tonight() $$,
  $$ select jackpot, tournament from expected where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'a practice member reads the practice venue''s, never the club''s');

-- A seat held for a called member is not open: the floor calls the club's first waiting member to an
-- empty seat at an open table of their game.
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
    order by e.joined_at, t.position
    limit 1
  ) pick
  where w.id = pick.entry_id and pick.seat is not null
  returning w.call_table_id
)
insert into held select call_table_id from called;
select is((select count(*)::integer from held), 1, 'the floor calls a waiting member to a seat');
select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select is((select o.open_seats from public.floor_open_seats() o join held h on h.table_id = o.table_id),
  (select s.open_seats - 1 from seats s join held h on h.table_id = s.table_id), 'and the seat held for them is not open');

reset role;
select ok(not has_function_privilege('anon', 'public.my_tonight()', 'execute')
          and not has_function_privilege('anon', 'public.floor_open_seats()', 'execute'), 'nobody signed out reads them');

select * from finish();
rollback;
