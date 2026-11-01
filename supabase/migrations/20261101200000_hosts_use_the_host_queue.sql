-- The host role uses the host queue (F2-04 of the audit of 28 Oct). The queue's functions checked members.manage,
-- which only admins and super admins hold, so a host was refused, and the host role's own permission,
-- host_queue.manage, was checked nowhere. They now check host_queue.manage, which admins and super admins hold too.
-- Copied from 20261028395200_host_queue.sql, their latest definitions, with only the permission changed; replacing
-- them keeps their grants.

create or replace function private.host_queue(p_venue_id uuid)
returns table (item_id uuid, member_id uuid, full_name text, phone text, last_visit_at timestamptz, visits integer, status text,
               churn_reason text, offer jsonb, note text, handled_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, m.id, m.full_name, m.phone, h.last_visit_at, h.visits, h.status, h.churn_reason, h.offer, h.note, h.handled_at
  from public.host_queue_item h
  join public.member m on m.id = h.member_id
  where h.venue_id = p_venue_id and h.status in ('open', 'offered') and private.has_permission(p_venue_id, 'host_queue.manage')
    and private.host_may_call(h.member_id)
  order by h.last_visit_at, h.id;
$$;

-- The host's call: why the player stopped coming, the offer made (none keeps it open), and a note.
create or replace function private.record_host_contact(p_item_id uuid, p_churn_reason text, p_offer jsonb, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.host_queue_item;
begin
  select * into v_item from public.host_queue_item h where h.id = p_item_id for update;
  if v_item.id is null or not private.has_permission(v_item.venue_id, 'host_queue.manage') then
    raise exception 'Only a host at the venue records a call' using errcode = '42501';
  end if;
  perform private.assert_writable(v_item.venue_id);
  if v_item.status not in ('open', 'offered') or not private.host_may_call(v_item.member_id) then
    raise exception 'This player is no longer in the queue' using errcode = 'RVHST';
  end if;
  if p_churn_reason is null or p_churn_reason not in ('moved_away', 'busy', 'budget', 'game_too_big', 'game_too_small', 'bad_experience', 'playing_elsewhere', 'unreachable', 'other') then
    raise exception 'A reason the player stopped coming' using errcode = '22023';
  end if;
  update public.host_queue_item h
  set churn_reason = p_churn_reason, offer = p_offer, note = nullif(btrim(p_note), ''),
      status = case when p_offer is null then 'open' else 'offered' end,
      handled_by_staff_id = private.current_staff_id(v_item.venue_id), handled_at = now()
  where h.id = p_item_id;
end;
$$;

-- The host is done with a player: closed, whether or not they come back.
create or replace function private.close_host_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.host_queue_item;
begin
  select * into v_item from public.host_queue_item h where h.id = p_item_id for update;
  if v_item.id is null or not private.has_permission(v_item.venue_id, 'host_queue.manage') then
    raise exception 'Only a host at the venue closes a call' using errcode = '42501';
  end if;
  perform private.assert_writable(v_item.venue_id);
  update public.host_queue_item h
  set status = 'closed', handled_by_staff_id = private.current_staff_id(v_item.venue_id), handled_at = now()
  where h.id = p_item_id and h.status in ('open', 'offered');
end;
$$;
