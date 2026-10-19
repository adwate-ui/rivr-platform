-- Call time at the cage (#79; features "Call time"; additions flow 13). A cash-out while the member
-- still owes call time, on their open seat or the last one they left this visit (#78's shortfall), is
-- refused (RVCTS), and the cage shows the cashier the shortfall. An admin (call_time.override) lets the
-- member leave early with a reason, which records the early departure; the cash-out then goes through.
-- The check runs inside the cash-out, before a final one ends the seat and closes the visit (decision
-- 0059). early_departure is lane B's table: #79 is its first writer; #80 shows the count to admins and
-- makes completed call time a promotion condition. Refusals: RVCTS call time owed; RVCTD none owed.

create table public.early_departure (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  visit_id uuid not null references public.visit (id),
  -- The seat whose call time was not complete: one early departure per seat session.
  session_id uuid not null unique references public.seat_session (id),
  shortfall_seconds integer not null check (shortfall_seconds > 0),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  overridden_by_staff_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (overridden_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.early_departure is 'A member let go before their call time, by an admin with a reason (#79); never changed.';

create index early_departure_member_venue_idx on public.early_departure (member_id, venue_id);
create index early_departure_visit_idx on public.early_departure (visit_id);
create index early_departure_staff_venue_idx on public.early_departure (overridden_by_staff_id, venue_id);
create index early_departure_venue_idx on public.early_departure (venue_id, created_at);
create trigger early_departure_never_changed before update or delete on public.early_departure
  for each row execute function private.refuse_change();
create trigger early_departure_audit after insert on public.early_departure
  for each row execute function private.audit_row_change();

alter table public.early_departure enable row level security;
grant select on public.early_departure to authenticated;
create policy "staff who read members see early departures" on public.early_departure
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- The seat whose call time a member owes tonight, as #78's call_time_shortfall reads it (their open
-- seat, or the last one they left this visit), with the whole seconds still owed; no row outside a visit.
create function private.call_time_owed(p_member_id uuid, p_at timestamptz)
returns table (o_session_id uuid, o_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, coalesce(private.session_call_time(s, p_at), 0) from public.seat_session s
  where s.member_id = p_member_id and s.visit_id = private.current_visit(p_member_id)
  order by s.ended_at is null desc, s.ended_at desc limit 1;
$$;

-- #78's shortfall, read through call_time_owed so there is one rule for which seat is owed.
create or replace function private.call_time_shortfall(p_member_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select o.o_seconds from private.call_time_owed(p_member_id, p_at) o), 0);
$$;

-- Members in the room who left their seat before its call time and have no early departure yet: for
-- the admins on the Live floor, who let them leave early (a seated player's row has its own button).
create function private.left_owing_call_time(p_venue_id uuid)
returns table (member_id uuid, full_name text, table_name text, owed_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, g.name, o.o_seconds
  from public.visit v
  join public.member m on m.id = v.member_id
  cross join lateral private.call_time_owed(v.member_id, now()) o
  join public.seat_session s on s.id = o.o_session_id
  join public.game_table g on g.id = s.table_id
  where v.venue_id = p_venue_id and v.closed_at is null and s.ended_at is not null and o.o_seconds > 0
    and not exists (select 1 from public.early_departure e where e.session_id = o.o_session_id)
    and private.has_permission(p_venue_id, 'call_time.override')
  order by m.full_name;
$$;

-- An admin lets a member leave before their call time, with a reason: the early departure, once per seat.
create function private.let_leave_early(p_venue_id uuid, p_member_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed record;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'call_time.override') then
    raise exception 'Only an admin lets a player leave before call time' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Say why, in 3 to 500 characters' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) = 0 then
    raise exception 'No call time owed: nothing to let go early' using errcode = 'RVCTD';
  end if;
  insert into public.early_departure (venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id)
  values (p_venue_id, p_member_id, private.current_visit(p_member_id), v_owed.o_session_id, v_owed.o_seconds, btrim(p_reason),
          private.current_staff_id(p_venue_id))
  on conflict (session_id) do nothing
  returning id into v_id;
  return coalesce(v_id, (select e.id from public.early_departure e where e.session_id = v_owed.o_session_id));
end;
$$;

-- #76's cash-out, with the call time checked before any money moves.
create or replace function private.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid,
                                                 p_is_final boolean)
returns table (o_cage_transaction_id uuid, o_markers_settled_paise bigint, o_to_member_paise bigint, o_is_visit_closed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_final boolean := coalesce(p_is_final, false);
  v_owed record;
  v_markers uuid[];
  v_owes bigint[];
  v_split record;
  v_settled bigint;
  v_lines jsonb;
  v_txn uuid;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.transact') then
    raise exception 'Only a cashier cashes out' using errcode = '42501';
  end if;
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, v_is_final);
  if v_id is not null then
    return query select o.*, private.current_visit(p_member_id) is null from private.cash_out_outcome(v_id) o;
    return;
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if p_to is null or p_to not in ('cash', 'wallet') then
    raise exception 'Cash out to cash or to the wallet' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  -- A twin tap that waited on the lock is the same cash-out.
  v_id := private.cash_out_replay(p_venue_id, p_member_id, p_amount_paise, p_to, p_idempotency_key, v_is_final);
  if v_id is not null then
    return query select o.*, private.current_visit(p_member_id) is null from private.cash_out_outcome(v_id) o;
    return;
  end if;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'KYC incomplete: no cash-out until it is approved' using errcode = 'RVKYC';
  end if;
  if private.current_visit(p_member_id) is null then
    raise exception 'Not checked in: nothing to cash out' using errcode = 'RVOUT';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds using errcode = 'RVCTS';
  end if;
  select array_agg(k.id order by k.issued_at, k.id), array_agg(k.outstanding_paise order by k.issued_at, k.id) into v_markers, v_owes
  from (select k.id, k.issued_at, k.outstanding_paise from public.marker k
        where k.member_id = p_member_id and k.settled_at is null order by k.issued_at, k.id for update) k;
  select * into v_split from private.cash_out_split(p_amount_paise, v_owes);
  if v_split.to_member_paise is null then
    raise exception 'A cash-out is whole ₹50 chips' using errcode = 'RVCHP';
  end if;
  v_settled := coalesce((select sum(s) from unnest(v_split.settled_paise) s), 0);
  v_lines := jsonb_build_array(jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                                                   and a.code = 'venue.chips_outstanding' and a.member_id is null),
                                                  'amount', p_amount_paise::text));
  if v_settled > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.receivable'),
                                             'amount', (-v_settled)::text);
  end if;
  if v_split.to_member_paise > 0 then
    v_lines := v_lines || jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and (
                                                              (p_to = 'wallet' and a.code = 'member.cash' and a.member_id = p_member_id)
                                                              or (p_to = 'cash' and a.code = 'venue.cash_drawer' and a.member_id is null))),
                                             'amount', (-v_split.to_member_paise)::text);
  end if;
  v_txn := private.post_ledger_transaction(p_venue_id, 'cash_out', 'cash_out:' || p_idempotency_key, v_lines, null, 'Cash-out at the cage');
  insert into public.cage_transaction (venue_id, member_id, kind, method, amount_paise, session_id, ledger_transaction_id, cashier_staff_id,
                                       idempotency_key, is_final)
  values (p_venue_id, p_member_id, 'cash_out', p_to, p_amount_paise,
          (select s.id from public.seat_session s where s.member_id = p_member_id and s.ended_at is null), v_txn,
          private.current_staff_id(p_venue_id), p_idempotency_key, v_is_final)
  returning id into v_id;
  for i in 1 .. coalesce(array_length(v_split.settled_paise, 1), 0) loop
    update public.marker
    set outstanding_paise = outstanding_paise - v_split.settled_paise[i],
        settled_at = case when v_split.settled_paise[i] = v_owes[i] then now() end
    where id = v_markers[i];
    insert into public.marker_settlement (venue_id, marker_id, cage_transaction_id, amount_paise)
    values (p_venue_id, v_markers[i], v_id, v_split.settled_paise[i]);
    if v_split.settled_paise[i] = v_owes[i] then
      perform private.emit(p_venue_id, 'marker.settled',
                           jsonb_build_object('marker_id', v_markers[i], 'member_id', p_member_id, 'cage_transaction_id', v_id),
                           'marker.settled:' || v_markers[i]);
    end if;
  end loop;
  perform private.emit(p_venue_id, 'cage.cash_out',
                       jsonb_build_object('cage_transaction_id', v_id, 'member_id', p_member_id, 'amount_paise', p_amount_paise,
                                          'markers_settled_paise', v_settled, 'to_member_paise', v_split.to_member_paise, 'to', p_to,
                                          'is_final', v_is_final),
                       'cage.cash_out:' || v_id);
  if v_is_final then
    perform private.leave_on_cash_out(p_member_id);
  end if;
  return query select v_id, v_settled, v_split.to_member_paise, private.current_visit(p_member_id) is null;
end;
$$;

-- The cage's member search (#57) says what call time the member owes, and whether an admin let them go.
drop function public.cage_members(uuid, text);
drop function private.cage_members(uuid, text);
create function private.cage_members(p_venue_id uuid, p_query text)
returns table (member_id uuid, full_name text, tier_name text, is_kyc_complete boolean, photo_path text, wallet_paise bigint,
               bonus_paise bigint, markers_paise bigint, table_name text, seat integer, minimum_paise bigint, break_until timestamptz,
               call_time_owed_seconds integer, is_let_go_early boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, t.name, private.is_kyc_complete(m.id), k.photo_path, private.wallet_cash(m.id),
         coalesce((select -sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.bonus'), 0)::bigint,
         coalesce((select sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.receivable'), 0)::bigint,
         g.name, s.seat, tt.buy_in_min_paise, (select r.break_until from private.member_restrictions(m.id, now()) r),
         coalesce(o.o_seconds, 0), exists (select 1 from public.early_departure d where d.session_id = o.o_session_id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  left join public.seat_session s on s.member_id = m.id and s.ended_at is null
  left join public.game_table g on g.id = s.table_id
  left join public.table_type tt on tt.id = g.table_type_id
  left join lateral private.call_time_owed(m.id, now()) o on true
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'cage.transact')
    and length(trim(coalesce(p_query, ''))) >= 2
    and (m.full_name ilike '%' || trim(p_query) || '%'
         or m.phone like '%' || right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10) || '%' and length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 4)
  order by m.full_name
  limit 10;
$$;

revoke execute on function private.call_time_owed(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.let_leave_early(uuid, uuid, text), private.cage_members(uuid, text),
  private.left_owing_call_time(uuid) from public, anon;
grant execute on function private.let_leave_early(uuid, uuid, text), private.cage_members(uuid, text),
  private.left_owing_call_time(uuid) to authenticated;

create function public.let_leave_early(p_venue_id uuid, p_member_id uuid, p_reason text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.let_leave_early(p_venue_id, p_member_id, p_reason); $$;
create function public.left_owing_call_time(p_venue_id uuid)
returns table (member_id uuid, full_name text, table_name text, owed_seconds integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.left_owing_call_time(p_venue_id); $$;
create function public.cage_members(p_venue_id uuid, p_query text)
returns table (member_id uuid, full_name text, tier_name text, is_kyc_complete boolean, photo_path text, wallet_paise bigint,
               bonus_paise bigint, markers_paise bigint, table_name text, seat integer, minimum_paise bigint, break_until timestamptz,
               call_time_owed_seconds integer, is_let_go_early boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.cage_members(p_venue_id, p_query); $$;

revoke execute on function public.let_leave_early(uuid, uuid, text), public.cage_members(uuid, text), public.left_owing_call_time(uuid) from public, anon;
grant execute on function public.let_leave_early(uuid, uuid, text), public.cage_members(uuid, text), public.left_owing_call_time(uuid) to authenticated;
