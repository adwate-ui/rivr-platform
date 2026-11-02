-- A waitlist place from an earlier night (owner, 2 Nov: "Closed · 3 waiting · You are number null"; decision 0300). The
-- floor's board ranks tonight's places only (20261101150000_night_ends_clean.sql), but a place or a join request from an
-- earlier night stayed 'waiting' until its member's visit closed: the member read it on Home with no number, and the game
-- counted it in its wait. Now the night that ends closes them, and every list reads tonight's alone.

alter table public.waitlist_entry drop constraint waitlist_entry_left_reason_check;
alter table public.waitlist_entry add constraint waitlist_entry_left_reason_check
  check (left_reason in ('left', 'missed', 'stepped_away', 'break', 'seated', 'night_ended'));

-- As 20261028394700_waitlist_follow_ups.sql made it, then: a place or request from before tonight closes, as its night
-- has ended. Run every minute, so none outlives 06:00 IST by more than a minute.
create or replace function private.expire_waitlist_holds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missed public.waitlist_entry;
begin
  update public.waitlist_entry e
  set hold_until = case when private.is_waitlist_paused(e.venue_id, null) then e.hold_until + interval '1 minute' else e.hold_until end,
      stepped_away_at = e.stepped_away_at + interval '1 minute'
  where e.status = 'waiting' and (e.called_at is not null or e.stepped_away_at is not null)
    and private.is_waitlist_paused(e.venue_id, e.member_id);
  update public.waitlist_entry e
  set status = 'left', left_at = now(), left_reason = 'stepped_away'
  where e.status = 'waiting' and e.stepped_away_at is not null
    and private.away_until(e.venue_id, e.stepped_away_at, e.away_used) <= now()
    and not private.is_waitlist_paused(e.venue_id, e.member_id);
  for v_missed in
    update public.waitlist_entry e
    set status = 'left', left_at = now(), left_reason = 'missed'
    where e.status = 'waiting' and e.called_at is not null and e.hold_until <= now()
      and not private.is_waitlist_paused(e.venue_id, null)
    returning e.*
  loop
    perform private.roll_call_on(v_missed);
  end loop;
  update public.waitlist_entry e
  set status = 'left', left_at = now(), left_reason = 'night_ended'
  where e.status = 'waiting' and e.joined_at < private.tonight_began(now());
end;
$$;

-- As 20261029180000_waitlist_requests.sql made them, tonight's alone.
create or replace function private.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, is_request boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, e.joined_at, r.place, ct.name, e.call_seat, e.hold_until,
         private.away_until(e.venue_id, e.stepped_away_at, e.away_used), e.approved_at is null
  from public.waitlist_entry e
  join public.table_type t on t.id = e.table_type_id
  left join lateral private.ranked_waitlist(array[e.table_type_id]) r on r.entry_id = e.id
  left join public.game_table ct on ct.id = e.call_table_id
  where e.member_id = private.current_member_id() and e.status = 'waiting' and e.joined_at >= private.tonight_began(now())
  order by e.joined_at;
$$;

create or replace function private.waitlist_lengths()
returns table (table_type_id uuid, waiting integer, call_time_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, (select count(*)::integer from public.waitlist_entry e where e.table_type_id = t.id and e.status = 'waiting'
                and e.approved_at is not null and e.joined_at >= private.tonight_began(now())),
         coalesce((private.setting_at(t.venue_id, 'call_time.minutes', t.code, now()) ->> 'minutes')::integer, 0)
  from public.table_type t
  where (t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
     or t.venue_id in (select private.staff_venues());
$$;

create or replace function private.waitlist_requests(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, m.id, m.full_name, e.joined_at
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and e.approved_at is null and e.joined_at >= private.tonight_began(now())
    and private.has_permission(p_venue_id, 'waitlist.manage')
  order by e.joined_at, e.id;
$$;

-- The places and requests already left over from earlier nights.
update public.waitlist_entry e
set status = 'left', left_at = now(), left_reason = 'night_ended'
where e.status = 'waiting' and e.joined_at < private.tonight_began(now());
