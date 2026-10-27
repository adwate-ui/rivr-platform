-- At most one waitlist.joined an hour for a member and a list (#274): a join emits it only when none was emitted for
-- them on that list in the hour before, so joining and leaving again and again emits it once, and whatever later sends
-- on it (a push, a WhatsApp) sends once. Joins are one at a time per member (the member row lock). As before
-- (20261019091600_member_breaks.sql), with that check.
create or replace function private.put_on_waitlist(p_member_id uuid, p_table_type_id uuid, p_idempotency_key uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_id uuid;
  v_replay public.waitlist_entry;
begin
  -- A request id replays only the place it made: the same member, on the same list.
  select * into v_replay from public.waitlist_entry e where e.venue_id = v_venue_id and e.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.table_type_id <> p_table_type_id then
      raise exception 'That request id was used for another place' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  if not exists (select 1 from public.table_type t where t.id = p_table_type_id and t.venue_id = v_venue_id) then
    raise exception 'No such game at this venue' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, null, p_member_id);
  -- One at a time per member with start_break (#56).
  perform 1 from public.member m where m.id = p_member_id for update;
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'Finish the identity check to join a waitlist' using errcode = 'RVKYC';
  end if;
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: waitlists are closed until it ends' using errcode = 'RVBRK';
  end if;
  select e.id into v_id from public.waitlist_entry e
  where e.member_id = p_member_id and e.table_type_id = p_table_type_id and e.status = 'waiting';
  if v_id is not null then return v_id; end if;
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key, added_by_staff_id)
  values (v_venue_id, p_member_id, p_table_type_id, p_idempotency_key, p_staff_id)
  returning id into v_id;
  if not exists (select 1 from public.outbox_event o
                 where o.venue_id = v_venue_id and o.event_type = 'waitlist.joined' and o.occurred_at > now() - interval '1 hour'
                   and o.payload ->> 'member_id' = p_member_id::text and o.payload ->> 'table_type_id' = p_table_type_id::text) then
    perform private.emit(v_venue_id, 'waitlist.joined',
                         jsonb_build_object('entry_id', v_id, 'member_id', p_member_id, 'table_type_id', p_table_type_id),
                         'waitlist.joined:' || v_id);
  end if;
  return v_id;
end;
$$;
