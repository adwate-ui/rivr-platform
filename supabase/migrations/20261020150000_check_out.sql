-- Check-out at the door (#82; features "Check-in and check-out"; additions flow 14; decision 0109). The
-- front desk scans the membership card, or types the number, as a member leaves: the visit closes (close
-- reason door), which earns its points (#89) and fixes its hours. Before call time the call-time rule
-- applies, as at the cage (#79): a member who owes call time, on their seat or the last one they left
-- this visit, is refused (RVCTS) until an admin lets them leave early. A member still seated leaves the
-- seat as they go. Refusals: 42501 not the front desk, RVNOM no such member, RVOUT not checked in.

create function private.check_out(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed record;
  v_session public.seat_session;
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
  v_visit := private.current_visit(p_member_id);
  if v_visit is null then
    raise exception 'Not checked in: there is no visit to close' using errcode = 'RVOUT';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds using errcode = 'RVCTS';
  end if;
  -- A member who walks out from a seat leaves it, and a buy-in they asked for is withdrawn.
  select * into v_session from public.seat_session s where s.member_id = p_member_id and s.ended_at is null for update;
  if v_session.id is not null then
    update public.seat_session set ended_at = now(), end_reason = 'left', away_since = null where id = v_session.id;
    update public.buy_in_request set status = 'withdrawn', decided_at = now() where session_id = v_session.id and status = 'waiting';
    perform private.emit(v_session.venue_id, 'seat.left',
                         jsonb_build_object('session_id', v_session.id, 'member_id', p_member_id, 'table_id', v_session.table_id,
                                            'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
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
