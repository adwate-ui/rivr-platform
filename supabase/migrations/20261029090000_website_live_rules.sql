-- The website's live sections, read from the League and the club's rules in force rather than written into its pages
-- (#617, decision 0283; owner, 29 Oct: "these things are not static and should be picked from the appropriate
-- settings"). The Leaderboard reads public_league_table, as the TVs show it. Its prizes come from a new setting,
-- league.prizes, in words. Rewards and outstation read public_club_rules: only the rules a visitor may read, in force
-- now, never the practice venue's. Their content is typed by @rivr/contracts (siteBlockSchema), as every kind's is.

insert into public.setting_key (key, description, scope, value_schema) values
  ('league.prizes',
   'The RIVR League prizes the website shows beside the standings, in words: this month''s and this season''s; none set shows none.',
   'venue',
   '{"type":"object","properties":{"month":{"type":"string","minLength":1,"maxLength":300},"season":{"type":"string","minLength":1,"maxLength":300}},"additionalProperties":false}');

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links',
                  'story', 'cards', 'marquee', 'timeline', 'table', 'promotions', 'social_wall', 'league', 'rewards', 'outstation'));

-- The keys the website reads for each kind of block, as 20261028394100_social_wall.sql left them, with the new kinds'.
create or replace function private.site_block_public_keys(p_kind text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'hero' then array['eyebrow', 'heading', 'text', 'action', 'video', 'note']
    when 'statement' then array['eyebrow', 'lines', 'text', 'action', 'image', 'note']
    when 'gallery' then array['eyebrow', 'heading', 'intro', 'items', 'note']
    when 'feature' then array['eyebrow', 'heading', 'text', 'points', 'action', 'image', 'alt']
    when 'text' then array['heading', 'body']
    when 'rules' then array['heading', 'rules']
    when 'faq' then array['heading', 'questions']
    when 'careers' then array['heading', 'roles', 'apply']
    when 'map' then array['heading', 'address', 'hours', 'directionsUrl', 'phone', 'email']
    when 'games' then array['heading']
    when 'calendar' then array['heading']
    when 'links' then array['heading', 'links']
    when 'story' then array['eyebrow', 'heading', 'paragraphs', 'figures', 'action', 'image', 'alt']
    when 'cards' then array['eyebrow', 'heading', 'intro', 'cards', 'quote', 'action']
    when 'marquee' then array['phrases']
    when 'timeline' then array['eyebrow', 'heading', 'intro', 'items']
    when 'table' then array['heading', 'intro', 'columns', 'rows', 'note']
    when 'promotions' then array['heading']
    when 'social_wall' then array['heading']
    when 'league' then array['heading']
    when 'rewards' then array['heading']
    when 'outstation' then array['eyebrow', 'heading']
    else array[]::text[]
  end;
$$;

-- The club's rules the website shows, each as in force now: points an hour, rakeback and hotel nights by table type
-- (with its name, and its big blind to order by), RIVR Rewards' share of rake, the bad beat's split, what each high hand
-- pays and the League's prizes. The cab follows the app's own rule (private.cab_minimum_visits, four when none is set),
-- shown only while a tier has cab requests. A table type's rule shows only while the table type exists.
create function private.public_club_rule_rows()
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
  select v.slug, r.key, r.subject, t.name, t.big_blind_paise, r.value
  from in_force r
  join public.venue v on v.id = r.venue_id and not v.is_practice
  left join public.table_type t on t.venue_id = r.venue_id and t.code = r.subject
  where r.subject = '' or t.id is not null
  union all
  select v.slug, 'cab.minimum_visits', '', null, null, jsonb_build_object('visits', private.cab_minimum_visits(v.id))
  from public.venue v
  where not v.is_practice and exists (select 1 from cab_tiers c where c.venue_id = v.id and c.is_enabled);
$$;

revoke execute on function private.public_club_rule_rows() from public;
grant execute on function private.public_club_rule_rows() to anon, authenticated;

create view public.public_club_rules
with (security_invoker = true)
as
select venue_slug, key, subject, subject_name, subject_order, value from private.public_club_rule_rows();

comment on view public.public_club_rules is 'The club''s rules the website shows, in force now (#617): never the practice venue''s, and only these keys.';

grant select on public.public_club_rules to anon, authenticated;
