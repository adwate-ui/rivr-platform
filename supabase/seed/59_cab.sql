-- The Cab flow's own members (#140): Kabir Anand, with four visits closed this month, so he sees the cab, and Tara
-- Singh, with three, so she does not. Each visit lasted two hours, which counts toward the month. Each signs in with the
-- test code.
create temporary table seed_person_cab (id uuid, phone text, full_name text, visits integer);
insert into seed_person_cab values
  ('00000000-0000-4000-8000-000000000620', '+919000000620', 'Kabir Anand', 4),
  ('00000000-0000-4000-8000-000000000621', '+919000000621', 'Tara Singh', 3);

insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'), now(),
       '{"provider":"phone","providers":["phone"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from seed_person_cab p
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_person_cab p
on conflict (provider_id, provider) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id)
select p.id, '00000000-0000-4000-8000-000000000001', p.id, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Member')
from seed_person_cab p
on conflict (id) do nothing;

-- Visits this month, made once: staging's deploy runs every seed file on every merge, so a member who already has a visit
-- this month gets none (#1091). All within the month, none overlapping another and on nights before tonight's: three hours
-- apart and two long, ending before tonight's 06:00, or closer and shorter early in a month: on its first day, after
-- 06:00, an hour or more each; before then, ending before now. An hour or more counts toward the month
-- (private.visits_this_month); one shorter gets a seat at Table 1 so it counts too, and only then, since a seat is what a
-- seat bonus's first claimants count.
with made as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  select '00000000-0000-4000-8000-000000000001', p.id,
         c.closed - least(interval '2 hours', greatest(g.gap * 2 / 3, g.gap - interval '10 minutes')), c.closed, 'door'
  from seed_person_cab p
  cross join lateral (select date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as month_start) m
  cross join lateral (select case when private.tonight_began(now()) > m.month_start then private.tonight_began(now()) else now() end as until) u
  cross join lateral (select least(interval '3 hours', (u.until - m.month_start) / (p.visits + 1)) as gap) g
  cross join lateral generate_series(1, p.visits) n
  cross join lateral (select u.until - n * g.gap as closed) c
  where not exists (select 1 from public.visit v where v.member_id = p.id and v.opened_at >= m.month_start)
  returning id, member_id, opened_at, closed_at)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, away_seconds, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', made.member_id, made.id, (select t.id from public.game_table t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 1'), 1,
       made.opened_at, made.opened_at, 0, made.closed_at, 'left'
from made
where made.closed_at - made.opened_at < interval '1 hour';
