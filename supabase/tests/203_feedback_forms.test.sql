-- Feedback in two forms (#637), from Profile. Quick: one topic and a note. Detailed: the gameplay, cashier, service
-- and ambience rated 1 to 5, the NPS question 0 to 10, and a note if the member likes. Each is a ticket the General
-- Manager (feedback.manage: the floor manager 103) reads with its answers. 213 Mihir is a member; 104 Sana a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.send_quick_feedback('parking', 'The car park is full') $$, '22023', null, 'a quick note has one of the topics');
select throws_ok($$ select public.send_quick_feedback('dealer', '   ') $$, '22023', null, 'and says something');
select isnt(public.send_quick_feedback('dealer', '  The dealer at Table 3 was quick and fair.  '), null, 'Mihir sends a quick note about the dealer');

select throws_ok($$ select public.send_detailed_feedback('{"gameplay": 5, "cashier": 4, "service": 4}', 9, null) $$, '22023', null,
  'a detailed form rates all four');
select throws_ok($$ select public.send_detailed_feedback('{"gameplay": 6, "cashier": 4, "service": 4, "ambience": 5}', 9, null) $$, '22023', null,
  'each 1 to 5');
select throws_ok($$ select public.send_detailed_feedback('{"gameplay": 5, "cashier": 4, "service": 4, "ambience": 5}', 11, null) $$, '22023', null,
  'and the recommendation 0 to 10');
select isnt(public.send_detailed_feedback('{"gameplay": 5, "cashier": 3, "service": 4, "ambience": 5}', 9, ''), null,
  'he sends a detailed form with no note');
reset role;

select results_eq($$ select topic, note, ratings, nps, is_ticket from public.feedback where member_id = '00000000-0000-4000-8000-000000000213' and visit_id is null
                     order by created_at, (topic is null) $$,
  $$ values ('dealer'::text, 'The dealer at Table 3 was quick and fair.'::text, null::jsonb, null::smallint, true),
            (null, null, '{"gameplay": 5, "cashier": 3, "service": 4, "ambience": 5}'::jsonb, 9::smallint, true) $$,
  'both are kept as tickets, the quick one with its topic, the detailed one with its answers');
select throws_ok($$ insert into public.feedback (venue_id, member_id, ratings) values ('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000213', '{"gameplay": 5, "cashier": 3, "service": 4, "ambience": 5}') $$,
  '23514', null, 'a detailed form always has its recommendation');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.venue_feedback('00000000-0000-4000-8000-000000000001')
           where full_name = 'Mihir Shah' and (topic = 'dealer' or nps = 9)), 2, 'the General Manager reads both, with their answers');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.venue_feedback('00000000-0000-4000-8000-000000000001')), 0, 'a cashier reads none');
reset role;

-- Every note is a ticket, so a member sends ten an hour at most: Mihir has sent two, and eight more.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select lives_ok($$ select public.send_quick_feedback('dealer', 'Note ' || g) from generate_series(1, 8) g $$, 'Mihir sends eight more notes');
select throws_ok($$ select public.send_quick_feedback('dealer', 'One more') $$, 'RVRAT', null, 'but not an eleventh within the hour');
select throws_ok($$ select public.send_detailed_feedback('{"gameplay": 5, "cashier": 3, "service": 4, "ambience": 5}', 9, '') $$,
  'RVRAT', null, 'nor a detailed form');
reset role;

select is(has_function_privilege('anon', 'public.send_quick_feedback(text, text)', 'execute'), false, 'nobody signed out sends a quick note');
select is(has_function_privilege('anon', 'public.send_detailed_feedback(jsonb, integer, text)', 'execute'), false, 'nor a detailed form');

select * from finish();
rollback;
