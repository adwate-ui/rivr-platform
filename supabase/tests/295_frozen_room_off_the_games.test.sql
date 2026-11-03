-- A second room's freeze and the shared website (#613, decision 0460): a later room shares the club's website (decision
-- 0036), so the games block reads every real venue's tables. A frozen room's tables leave it, the club's stay, and the
-- room's come back once the freeze is released. The club's own site is still paused only by the club's freeze (#609).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c1', 'RIVR Second Room', 'second-room', false, 'RIVR test', 'Test', 'TSR');
insert into public.table_type (venue_id, code, name, small_blind_paise, big_blind_paise, buy_in_min_paise, buy_in_max_paise)
values ('00000000-0000-4000-8000-0000000000c1', 'nlh_50_100', 'NLH 50/100', 5000, 10000, 500000, 2000000);
insert into public.game_table (venue_id, table_type_id, name, position)
select '00000000-0000-4000-8000-0000000000c1', t.id, 'Room Table 1', 1 from public.table_type t where t.venue_id = '00000000-0000-4000-8000-0000000000c1';
create temporary table club_tables as select count(*)::integer as n from public.public_table_status where venue_slug = 'gurugram';
select ok((select n from club_tables) > 0, 'the club has tables on the games block to begin with');

select is((select count(*)::integer from public.public_table_status where venue_slug = 'second-room'), 1, 'the second room''s table is on the games block');

insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-0000000000c1', 'venue_freeze', 'Inspection');
select is((select count(*)::integer from public.public_table_status where venue_slug = 'second-room'), 0, 'frozen, its tables leave the games block');
select is((select count(*)::integer from public.public_table_status where venue_slug = 'gurugram'), (select n from club_tables),
  'and the club''s tables stay');
select is((select is_frozen from public.public_venue_status where venue_slug = 'gurugram'), false, 'while the club''s own site is not paused');

update public.control_state set released_at = now(), release_reason = 'Inspection over',
  released_by_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' limit 1),
  release_second_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000102' limit 1)
where venue_id = '00000000-0000-4000-8000-0000000000c1' and level = 'venue_freeze';
select is((select count(*)::integer from public.public_table_status where venue_slug = 'second-room'), 1, 'released, its table comes back');

select * from finish();
rollback;
