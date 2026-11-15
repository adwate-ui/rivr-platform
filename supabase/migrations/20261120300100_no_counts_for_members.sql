-- Players never see how many are seated, how many wait or how many seats are open (the owner, 8 Nov and 15 Nov;
-- redesign RD-20, correction 13). The player app has drawn none since 8 Nov, but two reads Home makes every ten seconds
-- still carried them to a member's phone. Both now carry counts to staff alone. A third, the taken seat numbers the join
-- sheet's seat map once drew, is closed as well: which seats are taken is how many are seated by another name.

-- Each active table's waitlist length and its stake's call time. As it stood in the reset database
-- (pg_get_functiondef; as 20261118101100_guest_relations_read_only_top_ups.sql left it): a member still reads each
-- table's call time, which the join sheet shows, with no count of who waits; staff read both, at the venues they work
-- at beyond top-ups.
create or replace function private.waitlist_lengths()
returns table (table_id uuid, waiting integer, call_time_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         case when g.venue_id in (select private.staff_venues_beyond_top_ups())
              then (select count(*)::integer from public.waitlist_entry e where e.table_id = g.id and e.status = 'waiting'
                    and e.approved_at is not null and e.joined_at >= private.tonight_began(now()))
         end,
         coalesce((private.setting_at(g.venue_id, 'call_time.minutes', t.code, now()) ->> 'minutes')::integer, 0)
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  where g.active
    and ((g.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
         or g.venue_id in (select private.staff_venues_beyond_top_ups()));
$$;

-- Each active table's open seats, for staff at the venues they work at beyond top-ups. As
-- 20261118101100_guest_relations_read_only_top_ups.sql left it, without the member's read: a member is told no count of
-- open seats.
create or replace function private.floor_open_seats()
returns table (table_id uuid, open_seats integer)
language sql
stable
security definer
set search_path = ''
as $$
  -- A seat counts once: the floor may seat a called member in the seat held for them before their place closes.
  select t.id, greatest(t.seats - (select count(*)::integer from (
    select s.seat from public.seat_session s where s.table_id = t.id and s.ended_at is null
    union
    select e.call_seat from public.waitlist_entry e where e.call_table_id = t.id and e.status = 'waiting' and e.called_at is not null
  ) taken), 0)
  from public.game_table t
  where t.active and t.venue_id in (select private.staff_venues_beyond_top_ups());
$$;

-- The seat numbers taken at the member's venue, which only a member ever read (20261103200000_tonight_live.sql). No
-- screen has asked for them since the seat map left the join sheet on 8 Nov, and a member is told no count of who is
-- seated, so it answers with no rows. It stays, empty, so that a call from a build of the app older than that still succeeds.
create or replace function private.floor_taken_seats()
returns table (table_id uuid, seat integer)
language sql
stable
security definer
set search_path = ''
as $$
  select null::uuid, null::integer where false;
$$;
