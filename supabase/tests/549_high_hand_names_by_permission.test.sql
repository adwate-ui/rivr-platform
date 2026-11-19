-- Tonight's high hands name the member in full only for staff who read members (#1019): marketing, who manage promotions
-- but do not read members, see a first name and initial, as the TVs do. 103 Aditya (admin, reads members), 107 Ishita
-- (marketing). Ishaan (211) sits at Table 3.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name; $$;
create function pg_temp.table_3() returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
$$;
create function pg_temp.names() returns setof text language sql as $$
  select member_name from public.high_hand_tonight('00000000-0000-4000-8000-000000000001');
$$;
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.id(text), pg_temp.table_3(), pg_temp.names() to authenticated;

-- The club's high hand bonus, live since last week: four of a kind 5,000.
with p as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'High hand bonus') returning id)
insert into ids select 'promotion', id from p;
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
values ('00000000-0000-4000-8000-000000000001', pg_temp.id('promotion'), 1, 'live', 'High hand bonus',
        '{"kind": "high_hand", "rules": {"bothHoleCards": true, "shownAtShowdown": true, "minPlayersDealt": 4},
          "hands": [{"hand": "four_of_a_kind", "chips": 5000}]}',
        '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
        jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 10)::text,
                           'timezone', 'Asia/Kolkata'),
        '{"perMember": "none", "budgetChips": 200000}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
select private.sync_promotion(pg_temp.id('promotion'));

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table_3(), 1, '9000000211');
select public.log_high_hand(pg_temp.table_3(), '00000000-0000-4000-8000-000000000211', 'four_of_a_kind', 'jack',
                            '{"bothHoleCards": true, "shownAtShowdown": true, "playersDealt": true}', '54900000-0000-4000-8000-000000000001');
reset role;

-- The two readers: one who reads members, and marketing, who do not.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
reset role;
select ok(coalesce(private.has_permission('00000000-0000-4000-8000-000000000001', 'members.read'), false), 'Aditya reads members');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
reset role;
select ok(not coalesce(private.has_permission('00000000-0000-4000-8000-000000000001', 'members.read'), false), 'Ishita, in marketing, does not');

-- Ishaan's name in full and as the TVs show it, read here, where both may be read.
create temporary table ishaan on commit drop as
  select full_name, private.first_name_and_initial(full_name) as short_name from public.member where id = '00000000-0000-4000-8000-000000000211';
grant select on ishaan to authenticated;
select isnt((select short_name from ishaan), (select full_name from ishaan), 'his first name and initial are not his full name');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.names() $$, $$ select full_name from ishaan $$, 'staff who read members see the member''s full name');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select results_eq($$ select * from pg_temp.names() $$, $$ select short_name from ishaan $$,
  'marketing, who do not, see his first name and initial, as the TVs show');
reset role;

select * from finish();
rollback;
