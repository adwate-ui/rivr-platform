-- "Bonus chips" reads "Bonus" (redesign of 15 Nov 2026, RD-12; docs/spec/redesign-2026-11-15.md slice 2): in the words the
-- database itself holds and hands to a screen. Feature names, two settings' descriptions, the promotions the templates
-- made, the templates for a new venue, and the club's website. "Bonus" takes a capital as the balance's name and as the
-- unit after a number; a promotion's name is sentence case ("Four-hour bonus"). Identifiers stay as they are.
--
-- Left on purpose (decision 0608): the messages of exceptions, which no screen shows (each is read by its code), and the
-- ledger's own note on a redemption.

update public.feature set name = 'Bonus', description = 'The member’s Bonus and its history.' where key = 'rewards.bonus';
update public.feature set name = 'Bonus notifications', description = 'Push when Bonus is added or used.' where key = 'push.bonus';

update public.setting_key
set description = 'The most Bonus one staff member adds by hand in a club day; an addition past it is refused and the owner hears of it. Super admins are not capped. None set is no cap.'
where key = 'bonus.daily_staff_cap';
update public.setting_key
set description = 'How many days Bonus lasts after it is given; Bonus held when it is switched on lasts that long from then. 0 is never. None set is never.'
where key = 'bonus.expiry_days';

-- Promotions as they are listed and shown to members: the template's name, and the line of words under any name. A
-- name an admin typed is theirs and stays.
update public.promotion
set name = replace(name, 'Four-hour bonus chips', 'Four-hour bonus'),
    detail = replace(replace(detail, 'Bonus chips', 'Bonus'), 'bonus chips', 'Bonus')
where name = 'Four-hour bonus chips' or detail ilike '%bonus chips%';
update public.promotion_version
set name = replace(name, 'Four-hour bonus chips', 'Four-hour bonus'),
    detail = replace(replace(detail, 'Bonus chips', 'Bonus'), 'bonus chips', 'Bonus')
where name = 'Four-hour bonus chips' or detail ilike '%bonus chips%';

-- As 20261116210000_academy_and_learn_removed.sql left it, with the two lines' words.
create or replace function private.add_promotion_templates(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'referral', 'Referral', '1,000 Bonus to each side', 'Every day', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'Front of every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus', '1,000 Bonus after four hours at the tables', 'Every night', 1, 'day')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
  perform private.version_promotions(p_venue_id);
end;
$$;

-- The website keeps its figures and takes the word: every published block of a venue's site that says "bonus chips".
-- Saved versions of a page are left as they were saved.
create function private.website_says_bonus(p_venue_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.site_block b
  set content = replace(replace(replace(b.content::text,
                  'bonus chips are forfeited', 'Bonus is forfeited'), 'Bonus chips', 'Bonus'), 'bonus chips', 'Bonus')::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and b.content::text ilike '%bonus chips%';
$$;
revoke execute on function private.website_says_bonus(uuid) from public, anon, authenticated;

select private.website_says_bonus(v.id) from public.venue v;

-- A new venue's website, as 20261116210000 left it, then with the word.
create or replace function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_points_and_league(p_venue_id);
  perform private.website_without_points_and_league(p_venue_id);
  perform private.website_without_academy(p_venue_id);
  perform private.website_says_bonus(p_venue_id);
end;
$$;
