-- Conversions for Meta and Google Ads (#161, #162; decision 0279). Each event below may be a conversion the club reports:
-- an Academy booking, KYC complete, a first visit, a first buy-in, a tournament entry or a repeat visit (scope-v1,
-- "Growth"). The database says which, and only for a member who consented to marketing, not erased, at a real venue;
-- the two consumers (Edge Functions meta-conversions and google-ads) report it, hashed, within seven days.
create function private.conversion_for(p_venue_id uuid, p_event_type text, p_payload jsonb)
returns table (conversion text, member_id uuid, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.conversion, m.id, m.phone
  from public.member m
  join public.venue v on v.id = m.venue_id and not v.is_practice
  cross join lateral (select case p_event_type
    when 'academy.booked' then 'academy_booking'
    when 'kyc.completed' then 'kyc_complete'
    when 'tournament.entered' then 'tournament_entry'
    -- A visit is the member's first unless they opened one before it (the id breaks a tie).
    when 'visit.opened' then case when exists (
        select 1 from public.visit x join public.visit this on this.id = (p_payload ->> 'visit_id')::uuid
        where x.member_id = m.id and (x.opened_at, x.id) < (this.opened_at, this.id)) then 'repeat_visit' else 'first_visit' end
    -- Only the member's first buy-in is a conversion: exactly one, as the id breaks a tie.
    when 'cage.buy_in' then case when exists (
        select 1 from public.cage_transaction t join public.cage_transaction this on this.id = (p_payload ->> 'cage_transaction_id')::uuid
        where t.member_id = m.id and t.kind = 'buy_in' and (t.created_at, t.id) < (this.created_at, this.id)) then null else 'first_buy_in' end
  end as conversion) c
  where m.id = (p_payload ->> 'member_id')::uuid and m.venue_id = p_venue_id and m.erased_at is null
    and c.conversion is not null and private.has_consent(m.id, 'marketing');
$$;

create function public.conversion_for(p_venue_id uuid, p_event_type text, p_payload jsonb)
returns table (conversion text, member_id uuid, phone text)
language sql stable security invoker set search_path = ''
as $$ select * from private.conversion_for(p_venue_id, p_event_type, p_payload); $$;

revoke execute on function private.conversion_for(uuid, text, jsonb), public.conversion_for(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.conversion_for(uuid, text, jsonb), public.conversion_for(uuid, text, jsonb) to service_role;

select private.schedule_outbox_consumer('meta-conversions');
select private.schedule_outbox_consumer('google-ads');
