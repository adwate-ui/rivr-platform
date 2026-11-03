-- A super admin withdraws an early departure recorded by mistake (owner, 3 Nov; decision 0500), with a reason of three
-- characters or more, in words. The early departure is never changed (it stays append-only): the withdrawal is a row
-- of its own beside it, audited with who, when and why. A withdrawn one no longer counts on the member's record, and
-- the record's list shows it marked withdrawn. Nothing leaves for an outside system, from the practice venue or any.

-- A withdrawal names its early departure and that early departure's venue, so the two can never differ.
alter table public.early_departure add constraint early_departure_id_venue_id_key unique (id, venue_id);

create table public.early_departure_withdrawal (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  early_departure_id uuid not null unique,
  reason text not null check (length(btrim(reason)) between 3 and 500 and reason ~ '[[:alpha:]]'),
  withdrawn_by_staff_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (early_departure_id, venue_id) references public.early_departure (id, venue_id),
  foreign key (withdrawn_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.early_departure_withdrawal is
  'An early departure withdrawn by a super admin, with the reason (decision 0500); never changed, and the early departure is kept.';

create index early_departure_withdrawal_venue_idx on public.early_departure_withdrawal (venue_id, created_at);
create index early_departure_withdrawal_staff_venue_idx on public.early_departure_withdrawal (withdrawn_by_staff_id, venue_id);
create trigger early_departure_withdrawal_never_changed before update or delete on public.early_departure_withdrawal
  for each row execute function private.refuse_change();
create trigger early_departure_withdrawal_never_truncated before truncate on public.early_departure_withdrawal
  for each statement execute function private.refuse_change();
create trigger early_departure_withdrawal_audit after insert on public.early_departure_withdrawal
  for each row execute function private.audit_row_change();

alter table public.early_departure_withdrawal enable row level security;
grant select on public.early_departure_withdrawal to authenticated;
create policy "staff who read members see withdrawals of early departures" on public.early_departure_withdrawal
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- Withdraws one early departure: a super admin of its venue, while the venue can be written, once, with a reason.
create function private.withdraw_early_departure(p_early_departure_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_departure public.early_departure;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  -- Held while it is withdrawn, so two super admins at once see one withdrawal and one refusal.
  select * into v_departure from public.early_departure e where e.id = p_early_departure_id for update;
  if v_departure.id is null or not private.is_super_admin(v_departure.venue_id) then
    raise exception 'Only a super admin withdraws an early departure' using errcode = '42501';
  end if;
  perform private.assert_writable(v_departure.venue_id, null, v_departure.member_id);
  if length(v_reason) not between 3 and 500 or v_reason !~ '[[:alpha:]]' then
    raise exception 'Give the reason in words, three characters or more' using errcode = '22023';
  end if;
  if exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = p_early_departure_id) then
    raise exception 'This early departure is already withdrawn' using errcode = 'RVDEC';
  end if;
  -- The audit row of the withdrawal carries the reason as its why, besides the row itself.
  perform set_config('rivr.audit_reason', v_reason, true);
  insert into public.early_departure_withdrawal (venue_id, early_departure_id, reason, withdrawn_by_staff_id)
  values (v_departure.venue_id, v_departure.id, v_reason, private.current_staff_id(v_departure.venue_id));
  perform set_config('rivr.audit_reason', '', true);
end;
$$;

create function public.withdraw_early_departure(p_early_departure_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.withdraw_early_departure(p_early_departure_id, p_reason); $$;

-- A member's early departures, newest first, each with its withdrawal when it has one.
drop function public.member_early_departures(uuid, uuid);
drop function private.member_early_departures(uuid, uuid);
create function private.member_early_departures(p_venue_id uuid, p_member_id uuid)
returns table (early_departure_id uuid, created_at timestamptz, shortfall_seconds integer, reason text, staff_name text,
               withdrawn_at timestamptz, withdrawn_reason text, withdrawn_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.created_at, e.shortfall_seconds, e.reason, s.full_name, w.created_at, w.reason, ws.full_name
  from public.early_departure e
  join public.staff s on s.id = e.overridden_by_staff_id
  left join public.early_departure_withdrawal w on w.early_departure_id = e.id
  left join public.staff ws on ws.id = w.withdrawn_by_staff_id
  where e.member_id = p_member_id and e.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  order by e.created_at desc;
$$;
create function public.member_early_departures(p_venue_id uuid, p_member_id uuid)
returns table (early_departure_id uuid, created_at timestamptz, shortfall_seconds integer, reason text, staff_name text,
               withdrawn_at timestamptz, withdrawn_reason text, withdrawn_by text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_early_departures(p_venue_id, p_member_id); $$;

-- The member's record, as 20261104210000_aadhaar_name.sql made it, counting the early departures not withdrawn.
create or replace function private.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text, tier_until date,
               qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean, photo_path text, visits integer,
               last_visit_at timestamptz, is_in_room boolean, early_departures integer, known_as text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, t.id, t.name,
         (select ((c.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date from public.member_tier_change c
          where c.member_id = m.id and not c.is_expiry and (c.ends_at is null or c.ends_at > now()) order by c.created_at desc limit 1),
         m.qualifying_small_blind, m.qualifying_big_blind, private.is_kyc_complete(m.id), k.photo_path,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         private.current_visit(m.id) is not null,
         (select count(*)::integer from public.early_departure e where e.member_id = m.id
            and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         m.known_as
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;

revoke execute on function private.withdraw_early_departure(uuid, text), public.withdraw_early_departure(uuid, text),
  private.member_early_departures(uuid, uuid), public.member_early_departures(uuid, uuid) from public, anon;
grant execute on function private.withdraw_early_departure(uuid, text), public.withdraw_early_departure(uuid, text),
  private.member_early_departures(uuid, uuid), public.member_early_departures(uuid, uuid) to authenticated;
