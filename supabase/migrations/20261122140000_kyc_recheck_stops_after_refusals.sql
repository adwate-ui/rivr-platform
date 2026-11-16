-- PAN re-checks that Zoop refuses (#1026; decision 0674). kyc-recheck read every vendor failure as "no answer" and asked
-- again, hourly at most, for ever; with Zoop a PAN check is two billed products, so a refused Pan Demographic paid for Pan
-- Lite on every try. The function now sorts a failed call three ways (@rivr/adapters' panRecheckFailure):
-- - an outage, even one after a paid call: asked again as before, uncounted;
-- - Zoop refusing RIVR's account (its keys, a product, the wallet), which every check would get: every re-check of a real
--   venue pauses for six hours and the owner hears of it once, so no member's re-check is spent on it;
-- - Zoop turning down this check's request: noted with the check and counted; the third ends its re-check as not_checked
--   and the owner hears of it. The check made in person stands, so the member keeps playing: the vendor's trouble never
--   sends a check to review (decision 0271). A check made again (reopened, or checked again at the desk) counts afresh.

alter table private.kyc_recheck_claim add column refusals integer not null default 0;

alter table public.kyc_record drop constraint kyc_record_pan_recheck_check;
alter table public.kyc_record add constraint kyc_record_pan_recheck_check
  check (pan_recheck is null or pan_recheck in ('matched', 'pan_invalid', 'name_differs', 'date_of_birth_differs', 'not_checked'));

-- While Zoop refuses RIVR's account, until when every re-check of a real venue waits: one row at most.
create table private.kyc_recheck_pause (
  id boolean primary key default true check (id),
  paused_until timestamptz not null,
  reason text not null
);
alter table private.kyc_recheck_pause enable row level security;
revoke all on private.kyc_recheck_pause from public, anon, authenticated;

-- As 20261102020000_kyc_vendor_failure.sql made it, with the re-check's step.
create or replace function public.note_kyc_vendor_failure(p_member_id uuid, p_step text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.kyc_record
  set vendor_failure = left(btrim(p_step) || ': ' || btrim(p_reason), 200), vendor_failed_at = now()
  where member_id = p_member_id and p_step in ('selfie', 'start', 'complete', 'pan', 'recheck') and coalesce(btrim(p_reason), '') <> '';
$$;

-- Zoop turned down one check's re-check request, for the kyc-recheck function (service role): noted with the check and
-- counted. 'refused' while the check will be asked again; 'not_checked' once the third has ended its re-check.
create function private.record_kyc_recheck_refused(p_member_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refusals integer;
  v_record public.kyc_record;
begin
  perform public.note_kyc_vendor_failure(p_member_id, 'recheck', p_reason);
  insert into private.kyc_recheck_claim as c (member_id, refusals) values (p_member_id, 1)
  on conflict on constraint kyc_recheck_claim_pkey do update set refusals = c.refusals + 1
  returning c.refusals into v_refusals;
  if v_refusals < 3 then
    return 'refused';
  end if;
  update public.kyc_record k
  set pan_recheck = 'not_checked', pan_rechecked_at = now()
  where k.member_id = p_member_id and k.method = 'manual' and k.status = 'verified' and k.pan_rechecked_at is null
  returning k.* into v_record;
  -- The owner hears of it, as of a re-check that failed: the alert names the check, not the member.
  if v_record.id is not null then
    perform private.raise_alert(v_record.venue_id, 'kyc.recheck_not_checked', jsonb_build_object('kyc_record_id', v_record.id));
  end if;
  return 'not_checked';
end;
$$;

-- Zoop refused RIVR's account on one check's re-check, for the kyc-recheck function (service role): noted with that check,
-- and every re-check of a real venue waits six hours. The owner hears of it once a pause, at the check's venue.
create function private.pause_kyc_rechecks(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_paused boolean := exists (select 1 from private.kyc_recheck_pause p where p.paused_until > now());
  v_venue_id uuid := (select k.venue_id from public.kyc_record k where k.member_id = p_member_id);
begin
  perform public.note_kyc_vendor_failure(p_member_id, 'recheck', p_reason);
  insert into private.kyc_recheck_pause as p (id, paused_until, reason) values (true, now() + interval '6 hours', left(coalesce(p_reason, ''), 200))
  on conflict (id) do update set paused_until = excluded.paused_until, reason = excluded.reason;
  if not v_was_paused and v_venue_id is not null then
    perform private.raise_alert(v_venue_id, 'kyc.recheck_paused', jsonb_build_object('refusal', left(coalesce(p_reason, ''), 80)));
  end if;
end;
$$;

-- As 20261108110000_kyc_at_the_club.sql made it, with a real venue's checks waiting while re-checks are paused.
create or replace function private.claim_kyc_rechecks(p_with_vendor boolean)
returns table (member_id uuid, full_name text, pan text, date_of_birth date, is_practice boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select k.member_id, m.full_name, k.pan, k.date_of_birth, v.is_practice
    from public.kyc_record k
    join public.member m on m.id = k.member_id
    join public.venue v on v.id = k.venue_id
    left join private.kyc_recheck_claim c on c.member_id = k.member_id
    where k.method = 'manual' and k.status = 'verified' and k.pan_rechecked_at is null
      and k.pan is not null and k.date_of_birth is not null
      and (v.is_practice or (p_with_vendor and not exists (select 1 from private.kyc_recheck_pause p where p.paused_until > now())))
      and not private.kyc_at_the_club(k.venue_id, now())
      and not exists (select 1 from public.control_state f
                      where f.venue_id = k.venue_id and f.released_at is null
                        and (f.level = 'venue_freeze' or (f.level = 'feature_kill' and f.feature = 'kyc_signup')))
      and (c.claimed_at is null or c.claimed_at < now() - least(interval '1 minute' * power(2, c.attempts), interval '1 hour'))
    order by k.verified_at
    limit 50
  ),
  claimed as (
    insert into private.kyc_recheck_claim as c (member_id, attempts, claimed_at)
    select due.member_id, 1, now() from due
    on conflict on constraint kyc_recheck_claim_pkey do update set attempts = c.attempts + 1, claimed_at = now()
    returning c.member_id
  )
  select due.member_id, due.full_name, due.pan, due.date_of_birth, due.is_practice from due join claimed on claimed.member_id = due.member_id;
end;
$$;

-- As 20261028394800_kyc_manual_recheck.sql made it, with an earlier refusal's note cleared once Zoop answers.
create or replace function private.record_kyc_recheck(p_member_id uuid, p_outcome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_outcome is null or p_outcome not in ('matched', 'pan_invalid', 'name_differs', 'date_of_birth_differs') then
    raise exception 'matched, pan_invalid, name_differs or date_of_birth_differs' using errcode = '22023';
  end if;
  update public.kyc_record k
  set pan_recheck = p_outcome, pan_rechecked_at = now(),
      status = case when p_outcome = 'matched' then k.status else 'needs_review' end,
      verified_at = case when p_outcome = 'matched' then k.verified_at end,
      vendor_failure = case when k.vendor_failure like 'recheck: %' then null else k.vendor_failure end,
      vendor_failed_at = case when k.vendor_failure like 'recheck: %' then null else k.vendor_failed_at end
  where k.member_id = p_member_id and k.method = 'manual' and k.status = 'verified' and k.pan_rechecked_at is null;
end;
$$;

-- A check made again (reopened, checked again at the desk, sent back to review) starts its re-check afresh: its tries and
-- refusals, and a re-check refusal's note, belonged to the check before.
create function private.restart_kyc_recheck_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.kyc_recheck_claim c where c.member_id = new.member_id;
  if new.vendor_failure like 'recheck: %' then
    new.vendor_failure := null;
    new.vendor_failed_at := null;
  end if;
  return new;
end;
$$;

create trigger kyc_record_restart_recheck_count before update of verified_at, pan_rechecked_at on public.kyc_record
  for each row when (new.verified_at is distinct from old.verified_at or (old.pan_rechecked_at is not null and new.pan_rechecked_at is null))
  execute function private.restart_kyc_recheck_count();

create function public.record_kyc_recheck_refused(p_member_id uuid, p_reason text)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.record_kyc_recheck_refused(p_member_id, p_reason); $$;
create function public.pause_kyc_rechecks(p_member_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.pause_kyc_rechecks(p_member_id, p_reason); $$;

revoke execute on function private.record_kyc_recheck_refused(uuid, text), public.record_kyc_recheck_refused(uuid, text),
  private.pause_kyc_rechecks(uuid, text), public.pause_kyc_rechecks(uuid, text), private.restart_kyc_recheck_count()
  from public, anon, authenticated;
grant execute on function private.record_kyc_recheck_refused(uuid, text), public.record_kyc_recheck_refused(uuid, text),
  private.pause_kyc_rechecks(uuid, text), public.pause_kyc_rechecks(uuid, text)
  to service_role;
