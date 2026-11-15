-- The TVs' five boards (redesign of 15 Nov 2026, issue 971; decision 0631). A TV holds the waitlist, call time, promotions,
-- the hours leaderboard or the high hand bonus, and nothing else. Settings, TVs, Rotation says which boards are on and the
-- seconds each shows: a TV reads its boards in order, less any switched off, each with its seconds, and the waitlist when
-- none is left; it reads a board's rows only while it shows that board.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The paired TV of this test, signed in: its own reads go through the API's role.
create function pg_temp.as_tv() returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000e461", "role": "authenticated"}', true);
$$;
grant execute on function pg_temp.as_tv() to authenticated;
-- Whether a TV takes a board as its main one: the constraint's answer, for every label the type still names.
create function pg_temp.takes(p_board public.tv_mode) returns boolean language plpgsql as $$
begin
  update public.tv_screen set mode = p_board, rotation = '{}' where device_id = '00000000-0000-4000-8000-00000000d461';
  return true;
exception when check_violation then
  return false;
end;
$$;
-- The club's setting, as the venue's staff save it; each later than the one before.
create function pg_temp.set_rule(p_key text, p_value jsonb, p_seconds_ago integer) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', p_key, '', p_value, now() - make_interval(secs => p_seconds_ago), 'Test 461');
$$;

insert into auth.users (id, instance_id, aud, role, phone)
values ('00000000-0000-4000-8000-00000000e461', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000461');
insert into public.device (id, venue_id, kind, name, auth_user_id)
values ('00000000-0000-4000-8000-00000000d461', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e461');
insert into public.tv_screen (device_id, venue_id, mode)
values ('00000000-0000-4000-8000-00000000d461', '00000000-0000-4000-8000-000000000001', 'waitlist');

-- ---------------------------------------------------------------------------------------------------
-- The five boards are the whole list.
select results_eq($$ select b.board from unnest(enum_range(null::public.tv_mode)) as b (board) where pg_temp.takes(b.board) order by 1 $$,
  $$ values ('waitlist'::public.tv_mode), ('call_time'), ('promotions'), ('leaderboard'), ('high_hand') $$,
  'of every board the type names, a TV takes the five as its main board, and no other');
select throws_ok($$ update public.tv_screen set mode = 'waitlist', rotation = array['rewards']::public.tv_mode[] where device_id = '00000000-0000-4000-8000-00000000d461' $$,
  '23514', null, 'nor turns to a board that went');
select lives_ok($$ update public.tv_screen set mode = 'call_time', rotation = array['promotions', 'high_hand', 'leaderboard']::public.tv_mode[]
                   where device_id = '00000000-0000-4000-8000-00000000d461' $$, 'it shows call time, and turns to the promotions, the high hand bonus and the hours');

-- ---------------------------------------------------------------------------------------------------
-- With nothing set: every board, 30 seconds each, a promotion 12 seconds a slide.
select pg_temp.as_tv();
select results_eq($$ select name, boards, seconds from public.my_tv_screen() $$,
  $$ values ('Bar TV'::text, array['call_time', 'promotions', 'high_hand', 'leaderboard']::public.tv_mode[], array[30, 12, 30, 30]) $$,
  'the TV reads its own board, then those it turns to, each with its seconds');
select results_eq($$ select mode, rotation from public.my_tv_screen() $$,
  $$ values ('call_time'::public.tv_mode, array['promotions', 'high_hand', 'leaderboard']::public.tv_mode[]) $$,
  'and, for a TV still on the build before, its mode and rotation as they were (for this release only)');
reset role;
select isnt(private.tv_showing('high_hand'), null, 'and may read the high hand bonus board, which it shows');
select is(private.tv_showing('waitlist'), null, 'not the waitlist, which it does not');

-- ---------------------------------------------------------------------------------------------------
-- Settings, TVs, Rotation: which boards are on, and the seconds on each.
select throws_ok($$ select pg_temp.set_rule('tv.board_seconds',
  '{"waitlist_seconds": 4, "call_time_seconds": 45, "promotions_seconds": 8, "leaderboard_seconds": 20, "high_hand_seconds": 15}', 9) $$,
  '23514', null, 'a board never shows for under five seconds');
select throws_ok($$ select pg_temp.set_rule('tv.boards', '{"waitlist": true, "jackpot": true}', 9) $$,
  '23514', null, 'and no board is switched on but the five, each named');
select lives_ok($$ select pg_temp.set_rule('tv.board_seconds',
  '{"waitlist_seconds": 20, "call_time_seconds": 45, "promotions_seconds": 8, "leaderboard_seconds": 20, "high_hand_seconds": 15}', 5) $$,
  'the club types the seconds on each board');
select lives_ok($$ select pg_temp.set_rule('tv.boards',
  '{"waitlist": true, "call_time": true, "promotions": false, "leaderboard": true, "high_hand": true}', 5) $$,
  'and switches the promotions off');
select pg_temp.as_tv();
select results_eq($$ select boards, seconds from public.my_tv_screen() $$,
  $$ values (array['call_time', 'high_hand', 'leaderboard']::public.tv_mode[], array[45, 15, 20]) $$,
  'the TV leaves the promotions out, and shows each board for its seconds');
reset role;
select is(private.tv_showing('promotions'), null, 'and reads nothing of a board switched off');

-- With every board of its own off, a TV shows the waitlist, and reads it.
select lives_ok($$ select pg_temp.set_rule('tv.boards',
  '{"waitlist": false, "call_time": false, "promotions": false, "leaderboard": false, "high_hand": false}', 1) $$,
  'the club switches every board off');
select pg_temp.as_tv();
select results_eq($$ select boards, seconds from public.my_tv_screen() $$, $$ values (array['waitlist']::public.tv_mode[], array[20]) $$,
  'a TV left with no board shows the waitlist');
reset role;
select isnt(private.tv_showing('waitlist'), null, 'and may read it');

-- Another venue's TVs follow their own venue's settings: none set there.
select is(private.tv_boards('00000000-0000-4000-8000-000000000002', 'promotions', array['waitlist']::public.tv_mode[]),
  array['promotions', 'waitlist']::public.tv_mode[], 'another venue keeps every board');
select is(private.tv_board_seconds('00000000-0000-4000-8000-000000000002', 'promotions'), 12, 'and the seconds nothing set gives');

select ok(not has_function_privilege('anon', 'public.my_tv_screen()', 'execute')
          and not has_function_privilege('authenticated', 'private.tv_boards(uuid, public.tv_mode, public.tv_mode[])', 'execute')
          and not has_function_privilege('authenticated', 'private.tv_board_seconds(uuid, public.tv_mode)', 'execute'),
  'nobody signed out reads a TV''s screen, and the rule is not asked from outside');

select * from finish();
rollback;
