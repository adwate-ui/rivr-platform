-- Check-out at the door (#82; features "Check-in and check-out"; additions flow 14; decision 0109). The
-- front desk scans the membership card, or types the number, as a member leaves: the visit closes (close
-- reason door), which earns its points (#89) and fixes its hours. Before call time the call-time rule
-- applies, as at the cage (#79): a member who owes call time, on their seat or the last one they left
-- this visit, is refused (RVCTS, with the seconds owed as the detail) until an admin lets them leave
-- early. A member still seated is refused (RVSTD): their chips are on the table, so the floor ends the
-- seat or the cage cashes them out first (question #410). Refusals: 42501 not the front desk, RVNOM no
-- such member, RVFRZ/RVMBR the venue or the member frozen, RVOUT not checked in.

create function private.check_out(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed record;
  v_visit uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member out' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One at a time per member, with the cage's cash-out (which takes the same lock).
  perform 1 from public.member m where m.id = p_member_id for update;
  -- A close is a write (decision 0161), refused while the venue or the member is frozen.
  perform private.assert_writable(p_venue_id, null, p_member_id);
  v_visit := private.current_visit(p_member_id);
  if v_visit is null then
    raise exception 'Not checked in: there is no visit to close' using errcode = 'RVOUT';
  end if;
  if exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null) then
    raise exception 'Still seated: the floor ends the seat, or the cage cashes out, first' using errcode = 'RVSTD';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds
      using errcode = 'RVCTS', detail = v_owed.o_seconds::text;
  end if;
  return private.close_visit(p_member_id, now(), 'door');
end;
$$;

-- The same, by the number on the card or typed at the desk.
create function private.check_out_by_phone(p_venue_id uuid, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member out' using errcode = '42501';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = p_venue_id and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  return private.check_out(p_venue_id, v_member_id);
end;
$$;

create function public.check_out(p_venue_id uuid, p_member_id uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.check_out(p_venue_id, p_member_id); $$;
create function public.check_out_by_phone(p_venue_id uuid, p_phone text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.check_out_by_phone(p_venue_id, p_phone); $$;

revoke execute on function private.check_out(uuid, uuid), private.check_out_by_phone(uuid, text), public.check_out(uuid, uuid),
  public.check_out_by_phone(uuid, text) from public, anon;
grant execute on function private.check_out(uuid, uuid), private.check_out_by_phone(uuid, text), public.check_out(uuid, uuid),
  public.check_out_by_phone(uuid, text) to authenticated;
