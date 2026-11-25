-- A member's referrer set from the console (the owner, 25 Nov; #1133): the floor, admins and super admins search for the
-- member who referred them and set them, as if the code had been typed at sign-up. The code goes where sign-up keeps it
-- (sign_up_attribution.referral_code), so private.complete_referral and the minute sweep pay it as they pay a typed one:
-- at the first seat, or now, on both sides once, for a member whose first seat is past Undo. The referrer can be changed
-- until the referral completes, then it stays.

insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['members.referrer']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['members.referrer']) as permission;
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['members.referrer']) as permission;

-- Sets `p_referrer_id` as the referrer of `p_member_id`: 'paid' once the referral is complete (now, or already, by the same
-- referrer, so a retry is safe), else 'at_first_seat'. Refusals: 42501 not the floor and up; RVOWN a staff member's own
-- record on either side; RVRFL a referral already paid to another referrer; RVRFP the practice venue; RVNOM no such member
-- at the venue, or erased; RVRFS the member themselves; RVRFT a referrer whose tier has no referrals; RVRFX a referrer who
-- is self-excluded; and, paying now, the freeze or the promotions kill switch (assert_writable); too many at once (RVRAT).
create function private.set_member_referrer(p_member_id uuid, p_referrer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_referrer public.member;
  v_done public.referral;
  v_first public.seat_session;
  v_before text;
  v_pays_now boolean;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.referrer') then
    raise exception 'Only the floor and up set a referrer' using errcode = '42501';
  end if;
  -- Neither side the staff member's own, by their login, phone or name, as every path to Bonus checks it.
  if private.is_own_cage_record(p_member_id) or private.is_own_cage_record(p_referrer_id)
     or coalesce(private.is_own_kyc_check(p_member_id), false) or coalesce(private.is_own_kyc_check(p_referrer_id), false) then
    raise exception 'Staff never set a referral that is their own' using errcode = 'RVOWN';
  end if;
  select * into v_done from public.referral r where r.member_id = p_member_id;
  if v_done.id is not null then
    if v_done.referrer_member_id = p_referrer_id then
      return 'paid';
    end if;
    raise exception 'The referral has been paid: its referrer stays' using errcode = 'RVRFL';
  end if;
  if (select v.is_practice from public.venue v where v.id = v_member.venue_id) then
    raise exception 'Referrals are not paid in the practice venue' using errcode = 'RVRFP';
  end if;
  select * into v_referrer from public.member m where m.id = p_referrer_id and m.venue_id = v_member.venue_id;
  if v_member.erased_at is not null or v_referrer.id is null or v_referrer.erased_at is not null then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if v_referrer.id = v_member.id then
    raise exception 'A member never refers themselves' using errcode = 'RVRFS';
  end if;
  if not private.has_feature(v_referrer.id, 'referral.share_cards') then
    raise exception 'The referrer''s tier has no referrals' using errcode = 'RVRFT';
  end if;
  if exists (select 1 from public.self_exclusion x where x.member_id = v_referrer.id and x.starts_at <= now() and x.ends_at > now()) then
    raise exception 'The referrer is self-excluded' using errcode = 'RVRFX';
  end if;
  -- Their first seat, as private.complete_referral pays it: now once past Undo; one still in Undo the minute sweep pays.
  select * into v_first from public.seat_session s where s.member_id = v_member.id order by s.started_at, s.id limit 1;
  v_pays_now := v_first.id is not null and not private.is_undoable(v_first.started_at);
  if v_pays_now then
    perform private.assert_writable(v_member.venue_id, 'promotions', v_member.id);
  else
    perform private.assert_writable(v_member.venue_id, null, v_member.id);
  end if;
  perform private.assert_rate(v_member.venue_id, 'members.referrer');
  select a.referral_code into v_before from public.sign_up_attribution a where a.member_id = v_member.id;
  insert into public.sign_up_attribution (member_id, venue_id, referral_code)
  values (v_member.id, v_member.venue_id, v_referrer.referral_code)
  on conflict (member_id) do update set referral_code = excluded.referral_code;
  perform private.audit(v_member.venue_id, 'member.referrer_set', 'member', v_member.id::text, jsonb_build_object('referral_code', v_before),
                        jsonb_build_object('referral_code', v_referrer.referral_code, 'referrer_member_id', v_referrer.id));
  if v_pays_now then
    perform private.complete_referral(v_member.venue_id, v_member.id, v_first.id);
  end if;
  return case when exists (select 1 from public.referral r where r.member_id = v_member.id) then 'paid' else 'at_first_seat' end;
end;
$$;
create function public.set_member_referrer(p_member_id uuid, p_referrer_id uuid)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.set_member_referrer(p_member_id, p_referrer_id); $$;
revoke all on function private.set_member_referrer(uuid, uuid), public.set_member_referrer(uuid, uuid) from public, anon;
grant execute on function private.set_member_referrer(uuid, uuid), public.set_member_referrer(uuid, uuid) to authenticated;

-- The sign-up on a member's record (owner, 8 Nov), with who referred them: the referral's referrer once complete, else the
-- member whose code they hold; when it completed; and whether they have sat at a table, which says when it pays.
drop function public.member_sign_up(uuid, uuid);
drop function private.member_sign_up(uuid, uuid);
create function private.member_sign_up(p_venue_id uuid, p_member_id uuid)
returns table (signed_up_at timestamptz, city text, occupation text, play_times text[], games_played text[], referral_code text,
               creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
               first_seen_at timestamptz, referrer_member_id uuid, referrer_name text, referrer_number bigint,
               referral_completed_at timestamptz, has_sat boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.created_at, p.city, p.occupation, coalesce(p.play_times, '{}'), coalesce(p.games_played, '{}'), a.referral_code,
         a.creator_code, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term, a.first_seen_at,
         x.id, x.full_name, x.member_number, r.completed_at,
         exists (select 1 from public.seat_session s where s.member_id = m.id)
  from public.member m
  left join public.member_preference p on p.member_id = m.id
  left join public.sign_up_attribution a on a.member_id = m.id
  left join public.referral r on r.member_id = m.id
  left join public.member x on x.venue_id = m.venue_id and x.id <> m.id
    and x.id = coalesce(r.referrer_member_id, (select c.id from public.member c where c.venue_id = m.venue_id and c.referral_code = upper(btrim(a.referral_code))))
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;
create function public.member_sign_up(p_venue_id uuid, p_member_id uuid)
returns table (signed_up_at timestamptz, city text, occupation text, play_times text[], games_played text[], referral_code text,
               creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
               first_seen_at timestamptz, referrer_member_id uuid, referrer_name text, referrer_number bigint,
               referral_completed_at timestamptz, has_sat boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_sign_up(p_venue_id, p_member_id); $$;
revoke execute on function private.member_sign_up(uuid, uuid), public.member_sign_up(uuid, uuid) from public, anon;
grant execute on function private.member_sign_up(uuid, uuid), public.member_sign_up(uuid, uuid) to authenticated;
