-- Last week replayed as if the version had run then (console v3 phase 7; decision 0465). 107 Ishita (marketing) drafts an
-- hours bonus that starts next week and ends the day after; 211 Ishaan played three hours at Table 3 on an evening four
-- club days ago. The replay still gives his time inside the schedule's hours, and the version keeps its own days.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;
create temporary table today on commit drop as select private.club_day_of(now()) as day;
grant select on today to authenticated;
create temporary table replay (body jsonb) on commit drop;
grant select, insert on replay to authenticated;

-- Ishaan's visit four club days ago: seated at Table 3 from 20:00 to 23:00 IST, gone at 23:30.
with visit as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', ((t.day - 4) + time '20:00') at time zone 'Asia/Kolkata',
         ((t.day - 4) + time '23:30') at time zone 'Asia/Kolkata', 'cash_out'
  from today t returning id, opened_at
)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', visit.id,
       (select g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3'), 8,
       visit.opened_at, visit.opened_at, visit.opened_at + interval '3 hours', 'cash_out'
from visit;

-- 500 bonus chips after an hour at Table 3's stake, 19:00 to 01:00 every day, from next week for two days.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'v', public.save_promotion_draft('00000000-0000-4000-8000-000000000001', jsonb_build_object('terms', jsonb_build_object(
  'name', 'Evening hours bonus', 'reward', '{"kind": "hours_bonus", "chips": 500, "afterMinutes": 60}'::jsonb,
  'eligibility', jsonb_build_object('stakes', jsonb_build_array((select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id
                                    where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3')), 'tiers', 'all', 'audience', 'everyone'),
  'schedule', jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '19:00', 'to', '01:00', 'startsOn', ((select day from today) + 7)::text,
                                 'endsOn', ((select day from today) + 8)::text, 'timezone', 'Asia/Kolkata'),
  'limits', '{"perMember": "per_day"}'::jsonb, 'channels', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}'::jsonb,
  'rulesText', '[]'::jsonb), 'request_id', gen_random_uuid()));

insert into replay select public.promotion_version_replay((select id from ids where name = 'v'));
select ok((select jsonb_array_length(body -> 'events') > 0 from replay), 'a promotion that starts next week still replays last week''s time');
select ok(exists (select 1 from replay, jsonb_array_elements(body -> 'events') e
                  where e -> 'event' ->> 'kind' = 'time_played' and (e -> 'event' ->> 'minutes')::integer = 180),
          'Ishaan''s three hours inside 19:00 to 01:00, four club days before the version''s first day');
select is((select schedule ->> 'startsOn' from public.promotion_version where id = (select id from ids where name = 'v')),
          ((select day from today) + 7)::text, 'the version keeps its own first day');
select is((select schedule ->> 'endsOn' from public.promotion_version where id = (select id from ids where name = 'v')),
          ((select day from today) + 8)::text, 'and its own last day');

reset role;
select * from finish();
rollback;
