-- Dual control (#20; scope-v1 module 5, "amounts above a configurable limit need a second cashier or
-- the floor manager"; .claude/rules/money.md; decision 0063). A cage write of the threshold in force
-- at its time or more is refused (RVAPP) until a second approver has approved it: a staff member
-- holding cage.second_approve at the venue, from their own session, other than the one who makes the
-- write (its first approver). Withdrawals (#21) are the first write to use it. With no threshold set, every amount needs one.

insert into public.setting_key (key, description, scope, value_schema) values
  ('cage.second_approver_threshold',
   'Dual control: a withdrawal of this amount or more is paid only once a second approver, a different staff member holding cage.second_approve, has approved it. Paise in whole ₹50 chips (scope-v1 module 5; decision 0063).',
   'venue',
   '{"type":"object","properties":{"threshold_paise":{"type":"integer","minimum":0,"maximum":1000000000,"multipleOf":5000}},"required":["threshold_paise"],"additionalProperties":false}');

create table public.second_approval (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  -- What was approved: a withdrawal (#21) by its request's id.
  subject text not null check (subject in ('withdrawal')),
  subject_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  approved_by_staff_id uuid not null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Each approver approves a subject once; any approver other than the first decides it.
  unique (venue_id, subject, subject_id, approved_by_staff_id),
  foreign key (approved_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.second_approval is 'A second approver''s approval of a cage write at or above the threshold (#20).';

create index second_approval_approver_idx on public.second_approval (approved_by_staff_id, venue_id);
create index second_approval_subject_idx on public.second_approval (venue_id, subject, subject_id);
create trigger second_approval_never_changed before update or delete on public.second_approval
  for each row execute function private.refuse_change();
create trigger second_approval_audit after insert on public.second_approval
  for each row execute function private.audit_row_change();

alter table public.second_approval enable row level security;
grant select on public.second_approval to authenticated;
create policy "the cage and its approvers see the venue's second approvals" on public.second_approval
  for select to authenticated
  using (venue_id in (select private.venues_where('cage.transact')) or venue_id in (select private.venues_where('cage.second_approve')));

-- Whether an amount needs a second approver at a moment: the threshold in force then or more; with no
-- threshold set, every amount does.
create function private.second_approver_needed(p_venue_id uuid, p_amount_paise bigint, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_amount_paise >= (private.setting_at(p_venue_id, 'cage.second_approver_threshold', '', p_at) ->> 'threshold_paise')::bigint, true);
$$;

-- The signed-in staff member approves a subject, for its amount, as second approver; each approver
-- once, a replay giving the same approval. The caller (a write's own public function, #21) takes the
-- venue and amount from the subject's row, never from the client.
create function private.record_second_approval(p_venue_id uuid, p_subject text, p_subject_id uuid, p_amount_paise bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approval public.second_approval;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'cage.second_approve') then
    raise exception 'Only a second approver approves' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  select * into v_approval from public.second_approval a
  where a.venue_id = p_venue_id and a.subject = p_subject and a.subject_id = p_subject_id and a.approved_by_staff_id = private.current_staff_id(p_venue_id);
  if v_approval.id is not null then
    if v_approval.amount_paise <> p_amount_paise then
      raise exception 'That was approved for another amount' using errcode = '22023';
    end if;
    return v_approval.id;
  end if;
  insert into public.second_approval (venue_id, subject, subject_id, amount_paise, approved_by_staff_id)
  values (p_venue_id, p_subject, p_subject_id, p_amount_paise, private.current_staff_id(p_venue_id))
  returning id into v_approval.id;
  return v_approval.id;
end;
$$;

-- Refuses a cage write that needs a second approver without one (RVAPP): approved for this subject and
-- amount by someone other than its first approver (the staff member who decides the write, given by
-- the write and never unknown), who still holds cage.second_approve, active and not cut off.
create function private.assert_second_approved(p_venue_id uuid, p_subject text, p_subject_id uuid, p_amount_paise bigint, p_at timestamptz,
                                               p_first_staff_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_first_staff_id is null then
    raise exception 'A cage write names its first approver' using errcode = '42501';
  end if;
  if not private.second_approver_needed(p_venue_id, p_amount_paise, p_at) then
    return;
  end if;
  if not exists (select 1 from public.second_approval a
                 join public.staff s on s.id = a.approved_by_staff_id
                 join public.role_permission rp on rp.role = s.role and rp.permission = 'cage.second_approve'
                 where a.venue_id = p_venue_id and a.subject = p_subject and a.subject_id = p_subject_id and a.amount_paise = p_amount_paise
                   and a.approved_by_staff_id <> p_first_staff_id and s.is_active
                   and not exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'access_revoke'
                                   and c.staff_id = s.id and c.released_at is null)) then
    raise exception 'A second approver, other than the first, must approve this first' using errcode = 'RVAPP';
  end if;
end;
$$;

revoke execute on function private.second_approver_needed(uuid, bigint, timestamptz), private.record_second_approval(uuid, text, uuid, bigint),
  private.assert_second_approved(uuid, text, uuid, bigint, timestamptz, uuid) from public, anon, authenticated;
