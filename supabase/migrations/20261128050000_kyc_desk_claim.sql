-- A check in person claims its member as it starts (the owner, 20 Nov). Two staff could open the same member, and the
-- second learned only at Verify, after five steps and three photos, that the first had checked them (13 Nov: five
-- refusals in 40 seconds). Start now claims the member for 15 minutes: another device is told who is checking them and
-- cannot start them, and a member whose check is done is told who did it and when (the newest kyc_review, which every
-- check in person writes). Cancel lets the claim go; a claim older than 15 minutes counts for nothing, so a check left
-- open on a device that went away frees its member the same evening, and a claim is cleared as the next is written. The
-- check itself (check_kyc_in_person) is unchanged: a claim never refuses a check already under way.
create table private.kyc_desk_claim (
  member_id uuid primary key,
  venue_id uuid not null,
  staff_id uuid not null,
  claimed_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id) on delete cascade,
  foreign key (staff_id, venue_id) references public.staff (id, venue_id) on delete cascade
);
alter table private.kyc_desk_claim enable row level security;
revoke all on private.kyc_desk_claim from public, anon, authenticated;

-- Start on a member: claimed for the caller, taken by another (who, since when), or decided already (who checked them,
-- when; no one for a check that had no review). Anyone else the gate refuses is refused as the check would be.
create function private.claim_kyc_desk_check(p_member_id uuid)
returns table (status text, staff_name text, since timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_staff_id uuid;
  v_holder uuid;
  v_since timestamptz;
begin
  -- Only staff who check members, before anything is held (the security review of the PR): anyone else learns nothing and
  -- locks nothing.
  select m.venue_id into v_venue_id from public.member m where m.id = p_member_id;
  if v_venue_id is null
     or not (private.has_permission(v_venue_id, 'kyc.in_person') or private.has_permission(v_venue_id, 'kyc.review')) then
    raise exception 'Only staff who check members in person do' using errcode = '42501';
  end if;
  perform private.assert_rate(v_venue_id, 'kyc.desk_claim');
  -- One claim of a member at a time, as one check: a second waits here, then finds the first.
  perform 1 from public.member m where m.id = p_member_id for no key update;
  begin
    perform private.assert_may_check_in_person(p_member_id);
  exception when sqlstate 'RVKYC' then
    return query
      select 'decided'::text, s.full_name, r.created_at
      from (values (1)) as one (x)
      left join lateral (select r.reviewed_by_staff_id, r.created_at from public.kyc_review r
                         where r.member_id = p_member_id order by r.created_at desc limit 1) r on true
      left join public.staff s on s.id = r.reviewed_by_staff_id;
    return;
  end;
  v_staff_id := private.current_staff_id(v_venue_id);
  if v_staff_id is null then
    raise exception 'Only staff who check members in person do' using errcode = '42501';
  end if;
  select c.staff_id, c.claimed_at into v_holder, v_since from private.kyc_desk_claim c
  where c.member_id = p_member_id and c.claimed_at > now() - interval '15 minutes';
  if v_holder is not null and v_holder <> v_staff_id then
    return query select 'taken'::text, (select s.full_name from public.staff s where s.id = v_holder), v_since;
    return;
  end if;
  -- Claims that lapsed are cleared as one is written, so none outlives its 15 minutes for long.
  delete from private.kyc_desk_claim c where c.venue_id = v_venue_id and c.claimed_at <= now() - interval '15 minutes';
  insert into private.kyc_desk_claim (member_id, venue_id, staff_id) values (p_member_id, v_venue_id, v_staff_id)
  on conflict (member_id) do update set venue_id = excluded.venue_id, staff_id = excluded.staff_id, claimed_at = now();
  return query select 'claimed'::text, null::text, now();
end;
$$;

-- Lets the caller's own claim go: Choose another member, or a check closed half done. Anyone else's stays.
create function private.release_kyc_desk_check(p_member_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.kyc_desk_claim c
  where c.member_id = p_member_id and c.staff_id = private.current_staff_id(c.venue_id);
$$;

-- Who other staff are checking now, for the desk's lists: the member, who, and since when. Nothing for staff who do not
-- check members, nor the caller's own claims.
create function private.kyc_desk_claims(p_venue_id uuid)
returns table (member_id uuid, staff_name text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.member_id, s.full_name, c.claimed_at
  from private.kyc_desk_claim c
  join public.staff s on s.id = c.staff_id
  where c.venue_id = p_venue_id and c.claimed_at > now() - interval '15 minutes'
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and c.staff_id is distinct from private.current_staff_id(p_venue_id);
$$;

create function public.claim_kyc_desk_check(p_member_id uuid)
returns table (status text, staff_name text, since timestamptz)
language sql
set search_path = ''
as $$ select * from private.claim_kyc_desk_check(p_member_id); $$;

create function public.release_kyc_desk_check(p_member_id uuid)
returns void
language sql
set search_path = ''
as $$ select private.release_kyc_desk_check(p_member_id); $$;

create function public.kyc_desk_claims(p_venue_id uuid)
returns table (member_id uuid, staff_name text, since timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.kyc_desk_claims(p_venue_id); $$;

-- Erasure takes the member's claim with their other records (the security review of the PR): who was checking them, and
-- when, goes as their kyc_review does. As 20261117210000_card_social_cage_and_older_screens_removed.sql made it, with the claim.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.live_status_device x where x.member_id = p_member.id;
  delete from public.tournament_interest x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from private.kyc_desk_claim x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
end;
$$;

revoke execute on function private.claim_kyc_desk_check(uuid), public.claim_kyc_desk_check(uuid),
  private.release_kyc_desk_check(uuid), public.release_kyc_desk_check(uuid),
  private.kyc_desk_claims(uuid), public.kyc_desk_claims(uuid) from public, anon;
grant execute on function private.claim_kyc_desk_check(uuid), public.claim_kyc_desk_check(uuid),
  private.release_kyc_desk_check(uuid), public.release_kyc_desk_check(uuid),
  private.kyc_desk_claims(uuid), public.kyc_desk_claims(uuid) to authenticated;
