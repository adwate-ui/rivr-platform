-- Points by hand only (owner, 29 Oct, #629; decision 0284). Nothing earns points or bonus automatically: no points for
-- hours played (points.per_hour), none for a share of rake (points.rewards_rake_share), and no weekly rakeback.
-- Staff add points by hand (#645). The rules and their code stay, so the club can turn them on again.
--
-- A rate none has set earns none (20261020124732_points.sql), and Settings no longer shows these keys (#626). So:
-- - every rate in force is set to zero from now, at each venue and subject that has one (production has none; this
--   is for the venues already given rates, such as staging's seed);
-- - the website does not show a rate of zero: it is no rule (private.public_club_rule_rows, as in
--   20261029090000_website_live_rules.sql, with zero points rates left out);
-- - the daily rakeback job stops. rakeback.rate is left as it is: the website still shows it, at the owner's word.
-- The seed no longer gives rates either (supabase/seed/61_points.sql is gone): the owner answered question #395.

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select distinct s.venue_id, s.key, s.subject,
       case s.key when 'points.per_hour' then '{"points": 0}'::jsonb else '{"basis_points": 0}'::jsonb end,
       now(), 'Points by hand only (owner, 29 Oct, #629)'
from public.setting s
where s.key in ('points.per_hour', 'points.rewards_rake_share')
on conflict (venue_id, key, subject, effective_from) do nothing;

create or replace function private.public_club_rule_rows()
returns table (venue_slug text, key text, subject text, subject_name text, subject_order bigint, value jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with in_force as (
    select distinct on (s.venue_id, s.key, s.subject) s.venue_id, s.key, s.subject, s.value
    from public.setting s
    where s.key in ('points.per_hour', 'rakeback.rate', 'accommodation.hours_per_night', 'points.rewards_rake_share', 'jackpot.payout',
                    'high_hand.payouts', 'league.prizes')
      and s.effective_from <= now()
    order by s.venue_id, s.key, s.subject, s.effective_from desc
  ), cab_tiers as (
    select distinct on (f.venue_id, f.tier_id) f.venue_id, f.is_enabled
    from public.tier_feature f
    where f.feature_key = 'cab.requests' and f.effective_from <= now()
    order by f.venue_id, f.tier_id, f.effective_from desc
  )
  -- Rakeback shows its rate alone: its cap and how long its bonus lasts are not the website's to show.
  select v.slug, r.key, r.subject, t.name, t.big_blind_paise,
         case when r.key = 'rakeback.rate' then jsonb_build_object('basis_points', r.value -> 'basis_points') else r.value end
  from in_force r
  join public.venue v on v.id = r.venue_id and not v.is_practice
  left join public.table_type t on t.venue_id = r.venue_id and t.code = r.subject
  where (r.subject = '' or t.id is not null)
    -- A points rate of zero is no rule (#629): points by hand only.
    and not (r.key = 'points.per_hour' and (r.value ->> 'points')::integer = 0)
    and not (r.key = 'points.rewards_rake_share' and (r.value ->> 'basis_points')::integer = 0)
  union all
  select v.slug, 'cab.minimum_visits', '', null, null, jsonb_build_object('visits', private.cab_minimum_visits(v.id))
  from public.venue v
  where not v.is_practice and exists (select 1 from cab_tiers c where c.venue_id = v.id and c.is_enabled);
$$;

select cron.unschedule('rakeback-daily');
