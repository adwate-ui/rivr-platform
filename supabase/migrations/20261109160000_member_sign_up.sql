-- What a member told the club when they signed up, on their record (the owner, 8 Nov): the day they joined, their sign-up
-- answers (city, occupation, when they play, the games they play) and how they came (a referral or creator code and the
-- campaign that brought them, with when the club first saw them). For staff who read members, of the venue in use only;
-- nothing for a member of another venue. Erasure removes the answers and the attribution, so an erased member has none.

create function private.member_sign_up(p_venue_id uuid, p_member_id uuid)
returns table (signed_up_at timestamptz, city text, occupation text, play_times text[], games_played text[], referral_code text,
               creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
               first_seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.created_at, p.city, p.occupation, coalesce(p.play_times, '{}'), coalesce(p.games_played, '{}'), a.referral_code,
         a.creator_code, a.utm_source, a.utm_medium, a.utm_campaign, a.utm_content, a.utm_term, a.first_seen_at
  from public.member m
  left join public.member_preference p on p.member_id = m.id
  left join public.sign_up_attribution a on a.member_id = m.id
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;

create function public.member_sign_up(p_venue_id uuid, p_member_id uuid)
returns table (signed_up_at timestamptz, city text, occupation text, play_times text[], games_played text[], referral_code text,
               creator_code text, utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
               first_seen_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_sign_up(p_venue_id, p_member_id); $$;

revoke execute on function private.member_sign_up(uuid, uuid), public.member_sign_up(uuid, uuid) from public, anon;
grant execute on function private.member_sign_up(uuid, uuid), public.member_sign_up(uuid, uuid) to authenticated;
