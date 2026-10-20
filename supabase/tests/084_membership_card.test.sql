-- The membership card (#71; decision 0162): a member's card is made the first time they ask for it, with
-- a code for the current window that the door checks in by. The window is card.qr_rotation_seconds long;
-- a code stays good five seconds past its window and no longer. An earlier code, a forged one, another
-- venue's and anything that is not a code are refused (RVCRD); nobody reads a card or its key. Kavya Rao
-- (290) is a member and Farhan Ali (190) the front desk, from 14_people_c.sql; 106 Pema is a dealer; 301
-- a member of the practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table card (name text primary key, code text, ms_left integer);
grant select, insert on card to authenticated;
-- Kavya's code for the window starting `p_windows` windows from now's.
create function pg_temp.kavya_code(p_windows integer) returns text language sql as $$
  select private.card_code(c.id, w.o_start + p_windows * w.o_seconds) from public.membership_card c
  cross join private.card_window(c.venue_id, now()) w where c.member_id = '00000000-0000-4000-8000-000000000290';
$$;

-- The club changes its QR every 10 seconds from an hour ago.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'card.qr_rotation_seconds', '', '{"seconds": 10}', now() - interval '1 hour', 'Test');

-- Kavya opens her card: her number, name and tier, a code for now, and how long it has left.
select pg_temp.as_person('00000000-0000-4000-8000-000000000290');
insert into card select 'now', c.code, c.ms_left from public.my_membership_card() c;
select results_eq($$ select full_name, tier_name, member_number = (select member_number from public.member where full_name = 'Kavya Rao')
                     from public.my_membership_card() $$,
  $$ values ('Kavya Rao'::text, 'Member'::text, true) $$, 'her card names her, her tier and her number');
select is((select code from public.my_membership_card()), (select code from card where name = 'now'), 'asked again in the same window, the same code');
select ok((select ms_left between 1 and 10000 from card where name = 'now'), 'the code changes within the 10 seconds the club rotates by');
select throws_ok($$ select id from public.membership_card $$, '42501', null, 'she cannot read the card table');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select 1 from public.membership_card $$, '42501', null, 'nor can the front desk');
select is_empty($$ select * from public.my_membership_card() $$, 'and the front desk, not a member, has no card');
select throws_ok($$ select private.card_code(gen_random_uuid(), 1) $$, '42501', null, 'nor can anyone make a code');
reset role;
select is((select count(*)::integer from public.membership_card where member_id = '00000000-0000-4000-8000-000000000290'), 1,
  'one card, made the first time she asked');
select is(pg_temp.kavya_code(0), (select code from card where name = 'now'), 'her code is the database''s for this window');
select isnt(pg_temp.kavya_code(1), pg_temp.kavya_code(0), 'each window has its own code');

-- A code stays good five seconds past the end of its window, and no longer.
select is(private.card_member('00000000-0000-4000-8000-000000000001', pg_temp.kavya_code(-1),
            to_timestamp((select o_start from private.card_window('00000000-0000-4000-8000-000000000001', now()))) + interval '4 seconds'),
  '00000000-0000-4000-8000-000000000290'::uuid, 'four seconds after it changed, the last code still checks in');
select throws_ok($$ select private.card_member('00000000-0000-4000-8000-000000000001', pg_temp.kavya_code(-1),
                     to_timestamp((select o_start from private.card_window('00000000-0000-4000-8000-000000000001', now()))) + interval '6 seconds') $$,
  'RVCRD', null, 'six seconds after, it does not: a screenshot is too late');

-- The door.
insert into card values ('earlier', pg_temp.kavya_code(-3), null), ('next', pg_temp.kavya_code(1), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000001', (select code from card where name = 'now')) $$,
  '42501', null, 'a dealer checks no one in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000001', (select code from card where name = 'earlier')) $$,
  'RVCRD', null, 'a code from 30 seconds ago, as a screenshot holds, does not check in');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000001', (select code from card where name = 'next')) $$,
  'RVCRD', null, 'nor does a code for a window still to come');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000001',
                    (select left(code, -1) || case when right(code, 1) = '0' then '1' else '0' end from card where name = 'now')) $$,
  'RVCRD', null, 'nor a code with its MAC changed');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000001', '9000000290') $$,
  'RVCRD', null, 'nor something that is not a card code');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000002', (select code from card where name = 'now')) $$,
  '42501', null, 'nor at the practice venue''s door, where Farhan is not the front desk');
select isnt(public.check_in_by_card('00000000-0000-4000-8000-000000000001', (select code from card where name = 'now')), null,
  'the code on her screen checks her in');
reset role;
select isnt(private.current_visit('00000000-0000-4000-8000-000000000290'), null, 'she is in the room');

-- A practice member's card is the practice venue's: it does not open the club's door.
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
insert into card select 'practice', c.code, c.ms_left from public.my_membership_card() c;
select ok((select ms_left between 1 and 30000 from card where name = 'practice'), 'the practice venue rotates every 30 seconds, unset');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select public.check_in_by_card('00000000-0000-4000-8000-000000000001', (select code from card where name = 'practice')) $$,
  'RVCRD', null, 'a practice member''s card is not the club''s');
reset role;

select * from finish();
rollback;
