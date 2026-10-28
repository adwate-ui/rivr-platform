-- The spin wheel (#150; additions "Spin wheel"; decision 0266). A promotion's spin effect gives a member a spin; the
-- floor (floor.manage) spins it for them from the console. The wheel's prizes are points, bonus in whole ₹50 chips, or
-- nothing, each with a weight, its odds among the others; staff who run promotions keep them. A spin draws a roll at
-- random and private.spin_prize (the twin of @rivr/domain spinPrize on packages/testing/golden/spin.json) lands it on
-- a prize; a bonus prize more than what is left of the club month's spin.budget is off the wheel for that spin. Points
-- post through private.credit_points and a bonus through private.credit_bonus (seven days to use), and the grant is
-- fulfilled. A TV showing the spin wheel reads its prizes and tonight's spins, and is told at once of each spin.

insert into public.setting_key (key, description, scope, value_schema) values
  ('spin.budget',
   'The most bonus the spin wheel gives in a club month, in paise; a bonus prize more than what is left is off the wheel for that spin. None set gives no bonus prizes.',
   'venue',
   '{"type":"object","properties":{"monthly_paise":{"type":"integer","minimum":0,"maximum":100000000,"multipleOf":5000}},"required":["monthly_paise"],"additionalProperties":false}');

-- @rivr/domain spinPrize: the place on the wheel (from 1) a roll lands on, among the prizes that can be drawn, each
-- taking as many rolls as its weight; null when none can be drawn. p_prizes is the wheel in order: kind, amount, weight.
create function private.spin_prize(p_prizes jsonb, p_budget_left bigint, p_roll bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_odds bigint;
  v_left bigint := p_roll;
  v_prize record;
begin
  select coalesce(sum((p ->> 'weight')::bigint), 0) into v_odds
  from jsonb_array_elements(p_prizes) p
  where p ->> 'kind' <> 'bonus' or (p ->> 'amount')::bigint <= p_budget_left;
  if v_odds = 0 then
    return null;
  end if;
  if p_roll < 0 or p_roll >= v_odds then
    raise exception 'A roll is from 0 to the odds less one' using errcode = '22023';
  end if;
  for v_prize in select e.p, e.n from jsonb_array_elements(p_prizes) with ordinality as e (p, n) order by e.n loop
    continue when v_prize.p ->> 'kind' = 'bonus' and (v_prize.p ->> 'amount')::bigint > p_budget_left;
    if v_left < (v_prize.p ->> 'weight')::bigint then
      return v_prize.n::integer;
    end if;
    v_left := v_left - (v_prize.p ->> 'weight')::bigint;
  end loop;
  return null;
end;
$$;

create table public.spin_wheel (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind text not null check (kind in ('points', 'bonus', 'nothing')),
  -- Points for points, whole ₹50 chips in paise for a bonus, 0 for nothing.
  amount bigint not null check (amount between 0 and 10000000),
  weight integer not null check (weight between 1 and 1000),
  -- Off the wheel: kept, as a spin names the prize it won.
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, venue_id),
  check (case kind when 'nothing' then amount = 0 when 'bonus' then amount > 0 and amount % 5000 = 0 else amount > 0 end)
);
comment on table public.spin_wheel is 'The spin wheel''s prizes (#150) in order, each with its weight: points, bonus or nothing.';
create index spin_wheel_venue_idx on public.spin_wheel (venue_id, created_at);
create trigger spin_wheel_audit after insert or update or delete on public.spin_wheel
  for each row execute function private.audit_row_change();

create table public.spin (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  grant_id uuid not null unique references public.promotion_grant (id),
  member_id uuid not null,
  prize_id uuid not null,
  -- The prize as won.
  kind text not null check (kind in ('points', 'bonus', 'nothing')),
  amount bigint not null check (amount >= 0),
  roll bigint not null check (roll >= 0),
  odds bigint not null check (odds > roll),
  spun_by_staff_id uuid not null,
  bonus_grant_id uuid references public.bonus_grant (id),
  created_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (prize_id, venue_id) references public.spin_wheel (id, venue_id),
  foreign key (spun_by_staff_id, venue_id) references public.staff (id, venue_id)
);
comment on table public.spin is 'A member''s spin of the wheel (#150): the roll, the prize won, and who spun it.';
create index spin_venue_idx on public.spin (venue_id, created_at desc);
create index spin_member_idx on public.spin (member_id, venue_id);
create index spin_prize_idx on public.spin (prize_id, venue_id);
create index spin_staff_idx on public.spin (spun_by_staff_id, venue_id);
create index spin_bonus_grant_idx on public.spin (bonus_grant_id);

alter table public.spin_wheel enable row level security;
alter table public.spin enable row level security;
grant select on public.spin_wheel, public.spin to authenticated;
create policy "the floor and staff who run promotions see the wheel" on public.spin_wheel for select to authenticated
  using (venue_id in (select private.venues_where('floor.manage')) or venue_id in (select private.venues_where('promotions.manage')));
create policy "the floor and staff who run promotions see the spins" on public.spin for select to authenticated
  using (venue_id in (select private.venues_where('floor.manage')) or venue_id in (select private.venues_where('promotions.manage')));

-- A member's export gives their spins whole (decision 0240).
insert into private.member_export_column (table_name, column_name, kind)
select 'spin', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'grant_id', 'member_id', 'prize_id', 'kind', 'amount', 'roll', 'odds', 'spun_by_staff_id', 'bonus_grant_id',
                  'created_at']) c (column_name);

-- Adds a prize to the end of the wheel. Refusals: 42501 not staff who run promotions; 22023 a kind, amount or weight out
-- of bounds (a bonus is whole ₹50 chips); RVFRZ the venue frozen.
create function private.add_spin_prize(p_venue_id uuid, p_kind text, p_amount bigint, p_weight integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions keep the wheel' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.spin_wheel (venue_id, kind, amount, weight) values (p_venue_id, p_kind, p_amount, p_weight) returning id into v_id;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'Points, bonus in whole ₹50 chips or nothing, and a weight from 1 to 1,000' using errcode = '22023';
end;
$$;

-- Takes a prize off the wheel. Refusals: 42501 not staff who run promotions; P0002 no such prize on the wheel; RVFRZ.
create function private.remove_spin_prize(p_venue_id uuid, p_prize_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions keep the wheel' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.spin_wheel set removed_at = now() where id = p_prize_id and venue_id = p_venue_id and removed_at is null;
  if not found then
    raise exception 'No such prize on the wheel' using errcode = 'P0002';
  end if;
end;
$$;

-- What is left of this club month's spin.budget: the setting less the bonus spins gave since the month began; nothing
-- when it is not set.
create function private.spin_budget_left(p_venue_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select greatest(coalesce((private.setting_at(p_venue_id, 'spin.budget', '', now()) ->> 'monthly_paise')::bigint, 0)
                  - coalesce((select sum(s.amount) from public.spin s
                              where s.venue_id = p_venue_id and s.kind = 'bonus'
                                and s.created_at >= (private.league_month(now()) + interval '6 hours') at time zone 'Asia/Kolkata'), 0), 0)::bigint;
$$;

-- The spins waiting: each grant of a spin not yet spun, oldest first, with the member and the promotion. Refusal: 42501
-- not the floor.
create function private.waiting_spins(p_venue_id uuid)
returns table (grant_id uuid, member_id uuid, member_name text, promotion_name text, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'floor.manage'), false) then
    raise exception 'The floor spins the wheel' using errcode = '42501';
  end if;
  return query
  select g.id, g.member_id, m.full_name, p.name, g.created_at
  from public.promotion_grant g
  join public.member m on m.id = g.member_id
  join public.promotion p on p.id = g.promotion_id
  where g.venue_id = p_venue_id and g.effect ->> 'kind' = 'spin' and g.fulfilled_at is null and m.erased_at is null
  order by g.created_at, g.id;
end;
$$;

-- Spins the wheel for a waiting grant: a random roll over the prizes the month's budget allows, the prize posted as
-- points or bonus, and the grant fulfilled. One spin at a time at a venue, so two cannot both spend the last of the
-- budget. Refusals: 42501 not the floor; P0002 no spin waiting for that grant; RVSPN no prize the budget allows; RVFRZ
-- the venue or member frozen.
create function private.spin_the_wheel(p_venue_id uuid, p_grant_id uuid)
returns table (spin_id uuid, kind text, amount bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.promotion_grant;
  v_budget bigint;
  v_prizes jsonb;
  v_ids uuid[];
  v_odds bigint;
  v_roll bigint;
  v_prize public.spin_wheel;
  v_spin_id uuid;
  v_bonus_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'floor.manage'), false) then
    raise exception 'The floor spins the wheel' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('spin_wheel:' || p_venue_id::text, 0));
  select * into v_grant from public.promotion_grant g
  where g.id = p_grant_id and g.venue_id = p_venue_id and g.effect ->> 'kind' = 'spin' and g.fulfilled_at is null
  for update;
  if not found then
    raise exception 'No spin waiting for that grant' using errcode = 'P0002';
  end if;
  perform private.assert_writable(p_venue_id, null, v_grant.member_id);
  v_budget := private.spin_budget_left(p_venue_id);
  select jsonb_agg(jsonb_build_object('kind', w.kind, 'amount', w.amount, 'weight', w.weight) order by w.created_at, w.id),
         array_agg(w.id order by w.created_at, w.id),
         coalesce(sum(w.weight) filter (where w.kind <> 'bonus' or w.amount <= v_budget), 0)
    into v_prizes, v_ids, v_odds
  from public.spin_wheel w where w.venue_id = p_venue_id and w.removed_at is null;
  if v_odds = 0 then
    raise exception 'No prize on the wheel the spin budget allows' using errcode = 'RVSPN';
  end if;
  v_roll := ('x' || encode(extensions.gen_random_bytes(6), 'hex'))::bit(48)::bigint % v_odds;
  select * into v_prize from public.spin_wheel w where w.id = v_ids[private.spin_prize(v_prizes, v_budget, v_roll)];
  insert into public.spin (venue_id, grant_id, member_id, prize_id, kind, amount, roll, odds, spun_by_staff_id)
  values (p_venue_id, p_grant_id, v_grant.member_id, v_prize.id, v_prize.kind, v_prize.amount, v_roll, v_odds, private.current_staff_id(p_venue_id))
  returning id into v_spin_id;
  if v_prize.kind = 'points' then
    perform private.credit_points(p_venue_id, v_grant.member_id, v_prize.amount, 'Spin wheel', 'spin:' || v_spin_id);
  elsif v_prize.kind = 'bonus' then
    v_bonus_id := private.credit_bonus(p_venue_id, v_grant.member_id, v_prize.amount, 'Spin wheel', now() + interval '7 days', 'spin:' || v_spin_id);
    update public.spin set bonus_grant_id = v_bonus_id where id = v_spin_id;
  end if;
  update public.promotion_grant set fulfilled_at = now(), bonus_grant_id = coalesce(v_bonus_id, bonus_grant_id) where id = p_grant_id;
  return query select v_spin_id, v_prize.kind, v_prize.amount;
end;
$$;

-- The spin wheel for a paired TV showing it: 'prize' rows (place, kind, amount, weight) in the wheel's order, then
-- tonight's last six 'spin' rows (kind, amount, name, when), newest first. A member is named by first name and
-- initial, or not at all if they hid their name on the TVs (#326); nobody excluded from play shows.
create function private.tv_spin_wheel()
returns table (row_kind text, place integer, prize_kind text, amount bigint, weight integer, display_name text, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with venue as (select private.tv_showing('spin_wheel') as id),
  prizes as (
    select 'prize'::text as row_kind, (row_number() over (order by w.created_at, w.id))::integer as place, w.kind, w.amount, w.weight,
           null::text as display_name, null::timestamptz as at
    from venue join public.spin_wheel w on w.venue_id = venue.id
    where w.removed_at is null
  ),
  spins as (
    select 'spin'::text as row_kind, null::integer as place, s.kind, s.amount, null::integer as weight,
           case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end as display_name, s.created_at as at
    from venue join public.spin s on s.venue_id = venue.id
    join public.member m on m.id = s.member_id left join public.member_preference p on p.member_id = m.id
    where s.created_at >= private.tonight_began(now())
      and not exists (select 1 from public.self_exclusion x where x.member_id = s.member_id and x.starts_at <= now() and x.ends_at > now())
    order by s.created_at desc limit 6
  )
  select * from (select * from prizes union all select * from spins) t
  order by t.row_kind, t.place, t.at desc;
$$;

-- A spin, or a change to the wheel, tells the venue's TVs at once (their read every half minute is the fallback).
create function private.signal_spin_wheel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.signal_tv(new.venue_id, 'spin_wheel');
  return null;
end;
$$;
create trigger spin_signal_tv after insert on public.spin
  for each row execute function private.signal_spin_wheel();
create trigger spin_wheel_signal_tv after insert or update on public.spin_wheel
  for each row execute function private.signal_spin_wheel();

create function public.add_spin_prize(p_venue_id uuid, p_kind text, p_amount bigint, p_weight integer)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_spin_prize(p_venue_id, p_kind, p_amount, p_weight); $$;
create function public.remove_spin_prize(p_venue_id uuid, p_prize_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.remove_spin_prize(p_venue_id, p_prize_id); $$;
create function public.waiting_spins(p_venue_id uuid)
returns table (grant_id uuid, member_id uuid, member_name text, promotion_name text, granted_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.waiting_spins(p_venue_id); $$;
create function public.spin_the_wheel(p_venue_id uuid, p_grant_id uuid)
returns table (spin_id uuid, kind text, amount bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.spin_the_wheel(p_venue_id, p_grant_id); $$;
create function public.tv_spin_wheel()
returns table (row_kind text, place integer, prize_kind text, amount bigint, weight integer, display_name text, at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_spin_wheel(); $$;

revoke execute on function private.spin_prize(jsonb, bigint, bigint), private.spin_budget_left(uuid), private.signal_spin_wheel()
  from public, anon, authenticated;
revoke execute on function private.add_spin_prize(uuid, text, bigint, integer), private.remove_spin_prize(uuid, uuid), private.waiting_spins(uuid),
  private.spin_the_wheel(uuid, uuid), private.tv_spin_wheel(), public.add_spin_prize(uuid, text, bigint, integer), public.remove_spin_prize(uuid, uuid),
  public.waiting_spins(uuid), public.spin_the_wheel(uuid, uuid), public.tv_spin_wheel() from public, anon;
grant execute on function private.add_spin_prize(uuid, text, bigint, integer), private.remove_spin_prize(uuid, uuid), private.waiting_spins(uuid),
  private.spin_the_wheel(uuid, uuid), private.tv_spin_wheel(), public.add_spin_prize(uuid, text, bigint, integer), public.remove_spin_prize(uuid, uuid),
  public.waiting_spins(uuid), public.spin_the_wheel(uuid, uuid), public.tv_spin_wheel() to authenticated;

-- Spin the wheel: a promotion in the template deck that gives a spin after four hours at the tables, once a club day.
-- As before (20261028392700_academy_attendance_graduation.sql), with that one more template; every venue gets it now.
create or replace function private.add_promotion_templates(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_graduate_tier uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate');
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'high_hands', 'High hands', 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', 'Every night', null, null),
    (p_venue_id, 'bad_beat', 'Bad-beat jackpot', 'The pool pays the losing hand, the winner and the table', 'Every night', null, null),
    (p_venue_id, 'referral', 'Referral', '₹1,000 to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '₹1,000 on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'rivr_rewards', 'RIVR Rewards', '5% of your rake back as points', 'Every game', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'First call on every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'ladies_night', 'Ladies'' Night', 'An evening for women players', null, null, null),
    (p_venue_id, 'league', 'RIVR League', 'Points from cash games and tournaments, a champion each season', 'Every month', null, null),
    (p_venue_id, 'sunday_guarantee', 'RIVR Sunday', '₹5,00,000 guaranteed', 'Sundays', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus', '₹1,000 bonus after four hours at the tables', 'Every night', 1, 'day'),
    (p_venue_id, 'graduate_freeroll', 'Graduate freeroll', 'A RIVR Sunday freeroll entry when you graduate from the Academy', 'On graduation', 1, 'promotion'),
    (p_venue_id, 'spin_wheel', 'Spin the wheel', 'A spin of the RIVR wheel after four hours at the tables', 'Every night', 1, 'day')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('graduate_first_buy_in', 'buy_in', jsonb_build_object('tier_ids', jsonb_build_array(v_graduate_tier)),
     '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb),
    ('graduate_freeroll', 'graduation', '{}'::jsonb, '{"kind": "freeroll_ticket", "tournament": "RIVR Sunday"}'::jsonb),
    ('spin_wheel', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "spin"}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where (r.template_key <> 'graduate_first_buy_in' or v_graduate_tier is not null)
    and not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
end;
$$;

select private.add_promotion_templates(v.id) from public.venue v;

-- The practice venue's reset keeps the new template (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
