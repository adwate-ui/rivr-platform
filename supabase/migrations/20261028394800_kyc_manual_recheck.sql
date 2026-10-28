-- Re-checking KYC checks made in person with the vendor (#259; decision 0271). A check made at the club while no vendor
-- was live (method 'manual', #246) is run once through the vendor's PAN check: the PAN and date of birth the reviewer
-- entered, and the member's registered name. A match leaves the check as it is. A PAN the vendor does not know, or one in
-- another name or with another date of birth, sends the check back to review: needs_review, so the member cannot play
-- until a reviewer decides, and the queue says why. Cashfree has no face search, so no photo is searched (decision 0197).
-- The kyc-recheck function runs it each minute: the practice venue's checks through the fake, a real venue's through
-- Cashfree once its keys are set.

alter table public.kyc_record
  -- matched, or how the vendor's answer differed; null until re-checked.
  add column pan_recheck text check (pan_recheck is null or pan_recheck in ('matched', 'pan_invalid', 'name_differs', 'date_of_birth_differs')),
  add column pan_rechecked_at timestamptz,
  add check ((pan_recheck is null) = (pan_rechecked_at is null));

insert into private.member_export_column (table_name, column_name, kind) values
  ('kyc_record', 'pan_recheck', 'owed'), ('kyc_record', 'pan_rechecked_at', 'owed');

-- The function's own bookkeeping, apart from the check (so asking writes no audit row): tries and the last claim.
create table private.kyc_recheck_claim (
  member_id uuid primary key references public.kyc_record (member_id) on delete cascade,
  attempts integer not null default 0,
  claimed_at timestamptz not null default now()
);
alter table private.kyc_recheck_claim enable row level security;
revoke all on private.kyc_recheck_claim from public, anon, authenticated;

-- The checks made in person waiting for their re-check, for the kyc-recheck function (service role): verified, not yet
-- re-checked, at a venue neither frozen nor with KYC switched off. A check the vendor could not answer is asked again, each
-- try twice as long after the last (2, 4, 8, 16, 32 minutes) and then hourly, until it is answered: never given up on. The practice venue's always; a real
-- venue's only once the function can ask Cashfree (p_with_vendor), so a venue without its keys spends no tries. Each is
-- claimed as it is given.
create function private.claim_kyc_rechecks(p_with_vendor boolean)
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
      and (v.is_practice or p_with_vendor)
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

-- The vendor's answer for one check, once: a match keeps it verified; any difference sends it back to review.
create function private.record_kyc_recheck(p_member_id uuid, p_outcome text)
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
      verified_at = case when p_outcome = 'matched' then k.verified_at end
  where k.member_id = p_member_id and k.method = 'manual' and k.status = 'verified' and k.pan_rechecked_at is null;
end;
$$;

-- As 20261027000400_kyc_on_cashfree.sql made it, saying when a re-check sent the check back.
create or replace function private.kyc_review_queue(p_venue_id uuid)
returns table (
  member_id uuid, full_name text, status text, method text, waiting_because text, date_of_birth date, masked_aadhaar text,
  pan text, address text, photo_path text, liveness_score smallint, face_match_score smallint, vendor_reference text,
  refusal text, clashes_with text[], updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.member_id, m.full_name, k.status, k.method,
         case
           when k.status <> 'needs_review' then null
           when k.pan_recheck in ('pan_invalid', 'name_differs', 'date_of_birth_differs') then 'recheck_' || k.pan_recheck
           when k.method = 'pan' then 'pan_alone'
           when k.date_of_birth is null and k.pan is null and k.aadhaar_reference is null then 'nothing_kept'
           when k.date_of_birth is null then 'no_date_of_birth'
           when private.kyc_clashes(k.member_id) then 'clash'
         end,
         k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path, k.liveness_score, k.face_match_score,
         k.vendor_reference, k.refusal,
         array(select om.full_name
               from public.kyc_record o join public.member om on om.id = o.member_id
               where private.kyc_records_clash(k, o)
               order by om.full_name),
         k.updated_at
  from public.kyc_record k join public.member m on m.id = k.member_id
  where k.venue_id = p_venue_id and k.status in ('needs_review', 'needs_pan', 'refused')
    and private.has_permission(p_venue_id, 'kyc.review')
  order by (k.status = 'needs_review') desc, k.updated_at;
$$;

create function public.claim_kyc_rechecks(p_with_vendor boolean)
returns table (member_id uuid, full_name text, pan text, date_of_birth date, is_practice boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.claim_kyc_rechecks(p_with_vendor); $$;
create function public.record_kyc_recheck(p_member_id uuid, p_outcome text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_kyc_recheck(p_member_id, p_outcome); $$;

revoke execute on function private.claim_kyc_rechecks(boolean), private.record_kyc_recheck(uuid, text),
  public.claim_kyc_rechecks(boolean), public.record_kyc_recheck(uuid, text) from public, anon, authenticated;
grant execute on function private.claim_kyc_rechecks(boolean), private.record_kyc_recheck(uuid, text),
  public.claim_kyc_rechecks(boolean), public.record_kyc_recheck(uuid, text) to service_role;

select private.schedule_outbox_consumer('kyc-recheck', '* * * * *');
