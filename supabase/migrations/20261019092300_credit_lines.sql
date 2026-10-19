-- Credit lines (#73; scope-v1 module 5, "Credit lines to players"; decision 0058). A floor manager
-- (markers.manage_limits) sets a member's limit in whole ₹50 chips; a raise above the venue's approval
-- threshold waits for a super admin other than the one who asked, whoever asked, who approves or
-- declines the amount they saw; a cut is in force at once. No limit without a finished
-- identity check and the minimum visit history. Room exposure is every member's open markers (their
-- member.receivable balances), against the venue's cap; markers themselves come with #74.
-- Refusals the console tells apart: RVKYC no finished check; RVVIS too few visits; RVCHP not whole
-- chips; RVCFG credit not set up; RVSTL the limit waiting changed; RVKIL credit switched off; RVFRZ, RVMBR frozen.

insert into public.setting_key (key, description, scope, value_schema) values
  ('credit.config',
   'Credit lines: a limit above the approval threshold waits for a super admin; a member needs the minimum visits before any limit; open markers across the room stay within the exposure cap. Paise in whole ₹50 chips (scope-v1 module 5).',
   'venue',
   '{"type":"object","properties":{"approval_threshold_paise":{"type":"integer","minimum":0,"maximum":100000000,"multipleOf":5000},"minimum_visits":{"type":"integer","minimum":0,"maximum":100},"exposure_cap_paise":{"type":"integer","minimum":0,"maximum":1000000000,"multipleOf":5000}},"required":["approval_threshold_paise","minimum_visits","exposure_cap_paise"],"additionalProperties":false}');

create table public.credit_line (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  -- The limit in force: 0 is no credit.
  limit_paise bigint not null default 0 check (limit_paise >= 0 and limit_paise % 5000 = 0),
  -- Why it was set, by whom, and the super admin who approved it when it was above the threshold.
  reason text,
  set_by_staff_id uuid,
  approved_by_staff_id uuid,
  -- A limit above the threshold, waiting for a super admin; null when none waits.
  proposed_limit_paise bigint check (proposed_limit_paise > 0 and proposed_limit_paise % 5000 = 0),
  proposal_reason text,
  proposed_by_staff_id uuid,
  proposed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (set_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (approved_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (proposed_by_staff_id, venue_id) references public.staff (id, venue_id),
  unique (venue_id, member_id),
  check ((proposed_limit_paise is null) = (proposed_by_staff_id is null) and (proposed_limit_paise is null) = (proposed_at is null)
         and (proposed_limit_paise is null) = (proposal_reason is null))
);

comment on table public.credit_line is 'A member''s credit limit and any limit waiting for a super admin''s approval (#73).';

create index credit_line_member_idx on public.credit_line (member_id, venue_id);
create index credit_line_set_by_idx on public.credit_line (set_by_staff_id, venue_id);
create index credit_line_approved_by_idx on public.credit_line (approved_by_staff_id, venue_id);
create index credit_line_proposed_by_idx on public.credit_line (proposed_by_staff_id, venue_id);
create trigger credit_line_touch_updated_at before update on public.credit_line
  for each row execute function private.touch_updated_at();
create trigger credit_line_audit after insert or update or delete on public.credit_line
  for each row execute function private.audit_row_change();

alter table public.credit_line enable row level security;
grant select on public.credit_line to authenticated;
create policy "staff who set limits, issue markers or read the ledger see the venue's credit lines" on public.credit_line
  for select to authenticated
  using (venue_id in (select private.venues_where('markers.manage_limits')) or venue_id in (select private.venues_where('markers.issue'))
         or venue_id in (select private.venues_where('ledger.read')));

-- @rivr/domain creditLimit in SQL, proved on the same golden file: in force, waiting for approval, or not whole chips.
create function private.credit_limit_check(p_limit_paise bigint, p_threshold_paise bigint, p_current_paise bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_limit_paise < 0 or p_limit_paise % 5000 <> 0 then 'not_chips'
              when p_limit_paise > p_threshold_paise and p_limit_paise > p_current_paise then 'needs_approval'
              else 'active' end;
$$;

-- Whether the signed-in person is a super admin at the venue now: active there, access not revoked.
create function private.is_super_admin(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.id = private.current_staff_id(p_venue_id) and s.role = 'super_admin');
$$;

-- The venue's credit rules in force; no row when none is set, which is no credit at all.
create function private.credit_config(p_venue_id uuid)
returns table (approval_threshold_paise bigint, minimum_visits integer, exposure_cap_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (c ->> 'approval_threshold_paise')::bigint, (c ->> 'minimum_visits')::integer, (c ->> 'exposure_cap_paise')::bigint
  from (select private.setting_at(p_venue_id, 'credit.config', '', now()) as c) s
  where c is not null;
$$;

-- Every member's open markers at the venue: the room's exposure.
create function private.room_exposure(p_venue_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(e.amount), 0)::bigint
  from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
  where a.venue_id = p_venue_id and a.code = 'member.receivable';
$$;

-- A floor manager sets a member's limit, found by mobile number: in force at once up to the threshold,
-- or when it is a cut; a raise above it waits for a super admin. Gives 'active' or 'needs_approval'.
create function private.set_credit_limit(p_venue_id uuid, p_phone text, p_limit_paise bigint, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_config record;
  v_state text;
  v_staff uuid := private.current_staff_id(p_venue_id);
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'markers.manage_limits') then
    raise exception 'Only a floor manager sets credit limits' using errcode = '42501';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = p_venue_id and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  if p_limit_paise is null or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A limit and why' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = v_member_id for update;
  perform private.assert_writable(p_venue_id, 'credit', v_member_id);
  select * into v_config from private.credit_config(p_venue_id);
  if v_config.approval_threshold_paise is null then
    raise exception 'Credit is not set up at this venue' using errcode = 'RVCFG';
  end if;
  v_state := private.credit_limit_check(p_limit_paise, v_config.approval_threshold_paise,
    coalesce((select l.limit_paise from public.credit_line l where l.venue_id = p_venue_id and l.member_id = v_member_id), 0));
  if v_state = 'not_chips' then
    raise exception 'A limit is whole ₹50 chips' using errcode = 'RVCHP';
  end if;
  if p_limit_paise > 0 and not private.is_kyc_complete(v_member_id) then
    raise exception 'No credit before the identity check is finished' using errcode = 'RVKYC';
  end if;
  if p_limit_paise > 0 and (select count(*) from public.visit v where v.member_id = v_member_id) < v_config.minimum_visits then
    raise exception 'Too few visits for credit' using errcode = 'RVVIS';
  end if;
  insert into public.credit_line (venue_id, member_id) values (p_venue_id, v_member_id) on conflict (venue_id, member_id) do nothing;
  if v_state = 'needs_approval' then
    update public.credit_line
    set proposed_limit_paise = p_limit_paise, proposal_reason = trim(p_reason), proposed_by_staff_id = v_staff, proposed_at = now()
    where venue_id = p_venue_id and member_id = v_member_id;
  else
    update public.credit_line
    set limit_paise = p_limit_paise, reason = trim(p_reason), set_by_staff_id = v_staff, approved_by_staff_id = null,
        proposed_limit_paise = null, proposal_reason = null, proposed_by_staff_id = null, proposed_at = null
    where venue_id = p_venue_id and member_id = v_member_id;
  end if;
  return v_state;
end;
$$;

-- A super admin approves or declines the waiting limit they were shown; never one they asked for.
create function private.decide_credit_limit(p_line_id uuid, p_is_approved boolean, p_expected_limit_paise bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.credit_line;
  v_staff uuid;
begin
  select * into v_line from public.credit_line l where l.id = p_line_id for update;
  v_staff := private.current_staff_id(v_line.venue_id);
  if v_line.id is null or v_staff is null or not private.is_super_admin(v_line.venue_id) then
    raise exception 'Only a super admin approves a credit limit' using errcode = '42501';
  end if;
  if v_line.proposed_limit_paise is null or v_line.proposed_by_staff_id is not distinct from v_staff or p_is_approved is null then
    raise exception 'No limit of someone else''s waits here' using errcode = '22023';
  end if;
  if p_expected_limit_paise is distinct from v_line.proposed_limit_paise then
    raise exception 'The limit waiting has changed' using errcode = 'RVSTL';
  end if;
  perform private.assert_writable(v_line.venue_id, 'credit', v_line.member_id);
  if p_is_approved and not private.is_kyc_complete(v_line.member_id) then
    raise exception 'No credit before the identity check is finished' using errcode = 'RVKYC';
  end if;
  update public.credit_line
  set limit_paise = case when p_is_approved then v_line.proposed_limit_paise else limit_paise end,
      reason = case when p_is_approved then v_line.proposal_reason else reason end,
      set_by_staff_id = case when p_is_approved then v_line.proposed_by_staff_id else set_by_staff_id end,
      approved_by_staff_id = case when p_is_approved then v_staff else approved_by_staff_id end,
      proposed_limit_paise = null, proposal_reason = null, proposed_by_staff_id = null, proposed_at = null
  where id = v_line.id;
end;
$$;

-- The venue's credit lines for the Markers screen: each member's limit, what waits for approval and
-- who proposed it, and their open markers; with the room's exposure and the rules in force.
create function private.credit_lines(p_venue_id uuid)
returns table (line_id uuid, member_id uuid, full_name text, limit_paise bigint, outstanding_paise bigint, proposed_limit_paise bigint,
               proposal_reason text, proposed_by text, exposure_paise bigint, exposure_cap_paise bigint, approval_threshold_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, m.id, m.full_name, l.limit_paise,
         coalesce((select sum(e.amount) from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
                   where a.member_id = m.id and a.code = 'member.receivable'), 0)::bigint,
         l.proposed_limit_paise, l.proposal_reason, p.full_name,
         private.room_exposure(p_venue_id), c.exposure_cap_paise, c.approval_threshold_paise
  from public.credit_line l
  join public.member m on m.id = l.member_id
  left join public.staff p on p.id = l.proposed_by_staff_id
  left join lateral private.credit_config(p_venue_id) c on true
  where l.venue_id = p_venue_id and (l.limit_paise > 0 or l.proposed_limit_paise is not null)
    and (private.has_permission(p_venue_id, 'markers.manage_limits') or private.has_permission(p_venue_id, 'ledger.read'))
  order by l.proposed_limit_paise is null, m.full_name;
$$;

-- The room's exposure against its cap, for the Markers screen even before any line exists.
create function private.credit_room(p_venue_id uuid)
returns table (exposure_paise bigint, exposure_cap_paise bigint, approval_threshold_paise bigint, minimum_visits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select private.room_exposure(p_venue_id), c.exposure_cap_paise, c.approval_threshold_paise, c.minimum_visits
  from private.credit_config(p_venue_id) c
  where private.has_permission(p_venue_id, 'markers.manage_limits') or private.has_permission(p_venue_id, 'ledger.read');
$$;

revoke execute on function private.credit_limit_check(bigint, bigint, bigint), private.is_super_admin(uuid), private.credit_config(uuid),
  private.room_exposure(uuid) from public, anon, authenticated;
revoke execute on function private.set_credit_limit(uuid, text, bigint, text), private.decide_credit_limit(uuid, boolean, bigint),
  private.credit_lines(uuid), private.credit_room(uuid) from public, anon;
grant execute on function private.set_credit_limit(uuid, text, bigint, text), private.decide_credit_limit(uuid, boolean, bigint),
  private.credit_lines(uuid), private.credit_room(uuid) to authenticated;

create function public.set_credit_limit(p_venue_id uuid, p_phone text, p_limit_paise bigint, p_reason text)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.set_credit_limit(p_venue_id, p_phone, p_limit_paise, p_reason); $$;
create function public.decide_credit_limit(p_line_id uuid, p_is_approved boolean, p_expected_limit_paise bigint)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.decide_credit_limit(p_line_id, p_is_approved, p_expected_limit_paise); $$;
create function public.credit_lines(p_venue_id uuid)
returns table (line_id uuid, member_id uuid, full_name text, limit_paise bigint, outstanding_paise bigint, proposed_limit_paise bigint,
               proposal_reason text, proposed_by text, exposure_paise bigint, exposure_cap_paise bigint, approval_threshold_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.credit_lines(p_venue_id); $$;
create function public.credit_room(p_venue_id uuid)
returns table (exposure_paise bigint, exposure_cap_paise bigint, approval_threshold_paise bigint, minimum_visits integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.credit_room(p_venue_id); $$;

revoke execute on function public.set_credit_limit(uuid, text, bigint, text), public.decide_credit_limit(uuid, boolean, bigint),
  public.credit_lines(uuid), public.credit_room(uuid) from public, anon;
grant execute on function public.set_credit_limit(uuid, text, bigint, text), public.decide_credit_limit(uuid, boolean, bigint),
  public.credit_lines(uuid), public.credit_room(uuid) to authenticated;
