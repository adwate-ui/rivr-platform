-- Waitlist call-down follow-ups (#287, from the security re-review of #285; decision 0044).
-- * A member frozen while away keeps their place: their time away pauses, as a venue freeze pauses everyone's, because a
--   frozen member cannot come back until the freeze is lifted. A frozen member's seat call still runs out, so the seat
--   rolls on to the next name rather than waiting on them.
-- * The floor's Skip of a called member keeps the place as away, so it needs time away left (RVAWY), as a member's own
--   step away does; a Skip with none left would take the place off at the next minute without a word.

-- Whether a place's time away is paused: its venue is frozen, or its member is. With no member, the venue alone, which is
-- what pauses a seat call's hold.
create function private.is_waitlist_paused(p_venue_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.control_state c
                 where c.released_at is null
                   and ((c.venue_id = p_venue_id and c.level = 'venue_freeze') or (c.member_id = p_member_id and c.level = 'member_freeze')));
$$;
revoke execute on function private.is_waitlist_paused(uuid, uuid) from public, anon, authenticated;

-- As 20261019090600_waitlist_call_and_seat.sql made it, with the Skip needing time away left.
create or replace function private.step_away(p_entry_id uuid, p_is_away boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_member_id uuid := private.current_member_id();
  v_is_floor boolean;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  if v_entry.id is null then
    raise exception 'Only the member or the floor steps a place away' using errcode = '42501';
  end if;
  v_is_floor := v_member_id is null or v_entry.member_id <> v_member_id;
  if v_is_floor and not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
    raise exception 'Only the member or the floor steps a place away' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, case when v_is_floor then null else v_entry.member_id end);
  if v_entry.status <> 'waiting' or (v_entry.called_at is not null and not (v_is_floor and p_is_away)) then
    raise exception 'Only a waiting place steps away, and a called one only when the floor skips it' using errcode = '22023';
  end if;
  if v_entry.called_at is not null then
    -- The floor's Skip keeps the place as away, so it needs time away left, as a member's own step away does (#287).
    if v_entry.away_used >= private.waitlist_hold(v_entry.venue_id, now()) then
      raise exception 'No time away is left for this place' using errcode = 'RVAWY';
    end if;
    update public.waitlist_entry
    set called_at = null, hold_until = null, call_table_id = null, call_seat = null, stepped_away_at = now()
    where id = v_entry.id;
    perform private.roll_call_on(v_entry);
  elsif p_is_away and v_entry.stepped_away_at is null then
    if v_entry.away_used >= private.waitlist_hold(v_entry.venue_id, now()) then
      raise exception 'No time away is left for this place' using errcode = 'RVAWY';
    end if;
    update public.waitlist_entry set stepped_away_at = now() where id = v_entry.id;
  elsif not p_is_away and v_entry.stepped_away_at is not null then
    if private.away_until(v_entry.venue_id, v_entry.stepped_away_at, v_entry.away_used) <= now() then
      raise exception 'Away too long: the place has gone' using errcode = 'RVLAT';
    end if;
    update public.waitlist_entry
    -- A pause for a freeze can put stepped_away_at a moment ahead: that counts as no time.
    set away_used = away_used + greatest(now() - stepped_away_at, interval '0'), stepped_away_at = null
    where id = v_entry.id;
  end if;
end;
$$;

-- As 20261019090600_waitlist_call_and_seat.sql made it, a frozen member's time away paused as a frozen venue's.
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
end;
$$;
