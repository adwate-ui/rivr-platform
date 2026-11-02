-- Hosts and the floor check members in person (decision 0301; the owner, 2 Nov: "Hosts and floor too").

-- Checking a member in person (#4) is its own permission, kyc.in_person: super admins and admins, who review checks too,
-- and now hosts and the floor, who meet members at the desk. Reviewing the app's checks stays kyc.review.
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['kyc.in_person']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['kyc.in_person']) as permission;
insert into public.role_permission (role, permission)
select 'host', permission from unnest(array['kyc.in_person']) as permission;
insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['kyc.in_person']) as permission;

-- With hosts checking members in person, a check in person earns the verification bonus (decision 0298) only once its PAN
-- recheck matches, a minute or so later, or once a KYC reviewer approves it after a recheck that differed: a PAN that merely
-- looks right earns nothing. A member or venue frozen at that moment gets none, so the bonus never undoes the verification
-- or the recheck (bonus.sql skips a freeze the same way). As 20261102090000_verified_bonus.sql made it otherwise.
create or replace function private.give_verified_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key constant text := 'verified_bonus:' || new.member_id;
  v_points bigint;
  v_is_recheck_match constant boolean := new.method = 'manual' and new.pan_recheck = 'matched'
                                         and (tg_op = 'INSERT' or old.pan_recheck is distinct from 'matched');
  -- A reviewer's approval of a check waiting for review, such as one a recheck sent back.
  v_is_review_approval constant boolean := tg_op = 'UPDATE' and old.status = 'needs_review';
begin
  if (tg_op = 'UPDATE' and old.status = 'verified' and not v_is_recheck_match)
     or (new.method = 'manual' and new.pan_recheck is distinct from 'matched' and not v_is_review_approval)
     or exists (select 1 from public.venue v where v.id = new.venue_id and v.is_practice)
     or exists (select 1 from public.control_state c where c.venue_id = new.venue_id and c.released_at is null
                and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = new.member_id)))
     or exists (select 1 from public.ledger_transaction t where t.venue_id = new.venue_id and t.idempotency_key = v_key) then
    return new;
  end if;
  v_points := coalesce((private.setting_at(new.venue_id, 'points.verified_bonus', '', new.verified_at) ->> 'points')::bigint, 0);
  if v_points > 0 then
    perform private.credit_points(new.venue_id, new.member_id, v_points, 'Bonus on verification', v_key);
  end if;
  return new;
end;
$$;

-- And its trigger, which a recheck's answer now reaches too.
drop trigger kyc_record_verified_bonus on public.kyc_record;
create trigger kyc_record_verified_bonus
  after insert or update of status, pan_recheck on public.kyc_record
  for each row
  when (new.status = 'verified')
  execute function private.give_verified_bonus();

-- As 20261018092600_kyc_in_person.sql made it, for kyc.in_person or kyc.review.
create or replace function private.assert_may_check_in_person(p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_status text := (select k.status from public.kyc_record k where k.member_id = p_member_id);
begin
  if v_venue_id is null
     or not (private.has_permission(v_venue_id, 'kyc.in_person') or private.has_permission(v_venue_id, 'kyc.review'))
     or private.is_own_kyc_check(p_member_id) or private.changed_member(p_member_id) then
    raise exception 'Only staff who check members in person do, never for themselves or a member they added or changed'
      using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup'::public.killable_feature, p_member_id);
  if v_status is not null and v_status <> 'started' then
    raise exception 'This member''s check is decided, waits for review, or waits for their PAN' using errcode = 'RVKYC';
  end if;
end;
$$;

-- As 20261018092600_kyc_in_person.sql made it, for kyc.in_person or kyc.review.
create or replace function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started')
    -- Null for a reviewer with no member record of their own, which is not their own check.
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and length(trim(p_search)) between 2 and 100
    -- position, not like: a search is text, never a pattern.
    and (position(lower(trim(p_search)) in lower(m.full_name)) > 0
         or (trim(p_search) ~ '^[0-9]{4,10}$' and right(m.phone, length(trim(p_search))) = trim(p_search)))
  order by m.full_name
  limit 20;
$$;
