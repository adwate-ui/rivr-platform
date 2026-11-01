-- No conversion goes to the ad networks while the venue is frozen (audit A4-11, 1 Nov). A messaging stop holds the
-- consumers (they claim as messaging consumers now); a freeze holds no message (decision 0044), so here the conversion
-- is none, and the consumer finishes the event unsent, as a frozen venue's social post is (social_post_to_send).
-- As 20261028395500_ad_conversions.sql, with the freeze.

create or replace function private.conversion_for(p_venue_id uuid, p_event_type text, p_payload jsonb)
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
    and c.conversion is not null and private.has_consent(m.id, 'marketing')
    and not exists (select 1 from public.control_state s
                    where s.venue_id = p_venue_id and s.level = 'venue_freeze' and s.released_at is null);
$$;
