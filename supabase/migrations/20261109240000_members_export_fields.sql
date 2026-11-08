-- Every member field in the Members export (the owner, 9 Nov: "include all the member related fields (e.g. KYC
-- questions, etc.)"). The list gives, beside what it shows, what the member record holds: the name given at sign-up,
-- their own referral code, their sign-up answers (occupation, when they play, games), how they came (the code they joined
-- with, a creator's code, the campaign, when the club first saw them), and the identity check's method and day. Their
-- identity documents (date of birth, PAN, Aadhaar's last digits, the name on it, address) only to super admins (the
-- owner's answer), and never an erased member's (kept for TDS alone). The method only once the check is finished: a row
-- begun is `digilocker` by default. The console exports them; its table shows what it did. As 20261109150000_members_list_columns.sql made
-- it otherwise.

drop function public.members_of_tier(uuid, uuid);
drop function private.members_of_tier(uuid, uuid);

create function private.members_of_tier(p_venue_id uuid, p_tier_id uuid default null)
returns table (member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
               last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz,
               known_as text, own_referral_code text, occupation text, play_times text[], games_played text[], referral_code text,
               creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
               first_seen_at timestamptz, kyc_method text, kyc_verified_at timestamptz, date_of_birth date, pan text,
               masked_aadhaar text, aadhaar_name text, address text)
language sql
stable
security definer
set search_path = ''
as $$
  with access as (
    select private.has_permission(p_venue_id, 'members.read') as reads,
           coalesce(private.has_permission(p_venue_id, 'members.change_phone'), false) as sees_phone,
           coalesce(private.is_super_admin(p_venue_id), false) as sees_identity
  ),
  played as (
    select s.member_id, sum(private.minutes_played(s, now()))::bigint as minutes
    from public.seat_session s
    where s.venue_id = p_venue_id and (select reads from access)
    group by s.member_id
  )
  select m.id, m.member_number, m.full_name, case when a.sees_phone then m.phone end, right(m.phone, 4), t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         case when private.is_kyc_complete(m.id) then 'verified'
              when k.status = 'needs_review' then 'in_review'
              when k.status = 'refused' then 'refused'
              when k.status = 'started' and k.at_club_from is not null then 'at_desk'
              else 'not_done' end,
         coalesce(p.minutes, 0), pr.city, m.created_at,
         m.known_as, m.referral_code, pr.occupation, coalesce(pr.play_times, '{}'), coalesce(pr.games_played, '{}'), sa.referral_code,
         sa.creator_code, sa.utm_source, sa.utm_medium, sa.utm_campaign, sa.utm_content, sa.utm_term, sa.first_seen_at,
         case when k.verified_at is not null then k.method end, k.verified_at,
         case when a.sees_identity and m.erased_at is null then k.date_of_birth end,
         case when a.sees_identity and m.erased_at is null then k.pan end,
         case when a.sees_identity and m.erased_at is null then k.masked_aadhaar end,
         case when a.sees_identity and m.erased_at is null then k.aadhaar_name end,
         case when a.sees_identity and m.erased_at is null then k.address end
  from public.member m
  cross join access a
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  left join played p on p.member_id = m.id
  left join public.member_preference pr on pr.member_id = m.id
  left join public.sign_up_attribution sa on sa.member_id = m.id
  where m.venue_id = p_venue_id and (p_tier_id is null or m.tier_id = p_tier_id) and a.reads
  order by m.full_name
  limit 5000;
$$;

create function public.members_of_tier(p_venue_id uuid, p_tier_id uuid default null)
returns table (member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
               last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz,
               known_as text, own_referral_code text, occupation text, play_times text[], games_played text[], referral_code text,
               creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
               first_seen_at timestamptz, kyc_method text, kyc_verified_at timestamptz, date_of_birth date, pan text,
               masked_aadhaar text, aadhaar_name text, address text)
language sql stable security invoker set search_path = ''
as $$ select * from private.members_of_tier(p_venue_id, p_tier_id); $$;

revoke execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) from public, anon;
grant execute on function private.members_of_tier(uuid, uuid), public.members_of_tier(uuid, uuid) to authenticated;
