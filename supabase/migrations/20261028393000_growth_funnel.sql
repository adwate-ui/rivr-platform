-- Growth funnel (#166; S-G3): of the venue's members, how many finished KYC, came in and bought in, by where they
-- came from: a referral, a creator's code, a link's utm_source, or none (direct). From our own data, with no
-- analytics vendor, and counts only. Staff who read reports (reports.read); the practice venue has none.
create function private.growth_funnel(p_venue_id uuid)
returns table (source_kind text, source_code text, signed_up integer, kyc_done integer, visited integer, bought_in integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_reports(p_venue_id);
  return query
  with sourced as (
    select m.id,
           case when a.referral_code is not null then 'referral' when a.creator_code is not null then 'creator'
                when a.utm_source is not null then 'link' else 'direct' end as kind,
           case when a.referral_code is null then coalesce(a.creator_code::text, a.utm_source::text) end as code
    from public.member m
    left join public.sign_up_attribution a on a.member_id = m.id
    where m.venue_id = p_venue_id
  )
  select s.kind, s.code, count(*)::integer,
         (count(*) filter (where exists (select 1 from public.kyc_record k where k.member_id = s.id and k.status = 'verified')))::integer,
         (count(*) filter (where exists (select 1 from public.visit v where v.member_id = s.id)))::integer,
         (count(*) filter (where exists (select 1 from public.cage_transaction c where c.member_id = s.id and c.kind = 'buy_in')))::integer
  from sourced s
  group by s.kind, s.code
  order by count(*) desc, s.kind, s.code;
end;
$$;

create function public.growth_funnel(p_venue_id uuid)
returns table (source_kind text, source_code text, signed_up integer, kyc_done integer, visited integer, bought_in integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.growth_funnel(p_venue_id); $$;

revoke execute on function private.growth_funnel(uuid), public.growth_funnel(uuid) from public, anon;
grant execute on function private.growth_funnel(uuid), public.growth_funnel(uuid) to authenticated;
