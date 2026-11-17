-- The Bonus card's line from Content (#1065, the owner, 17 Nov): those who edit Content (107 Kavya, marketing) set it, up
-- to 120 characters, blank keeps the app's own; the member's Bonus card reads it; Activity keeps the change and no
-- settings alert is raised. 108 Karan, a host, edits no Content; 201 is a member here, ...e3 another club's member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', 'Free money') $$,
  '42501', null, 'a host sets no Bonus line');
select throws_ok($$ select public.content_bonus_line('00000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'nor reads it here');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is(public.content_bonus_line('00000000-0000-4000-8000-000000000001'), null, 'until it is set, the app''s own line is kept');
select is(public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', '  Play it on any table tonight.  '),
  'Play it on any table tonight.', 'Content sets the line, trimmed');
select is(public.content_bonus_line('00000000-0000-4000-8000-000000000001'), 'Play it on any table tonight.', 'and reads it back');
select throws_ok($$ select public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', repeat('x', 121)) $$,
  '22023', null, 'never more than 120 characters');
select is(public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', repeat('x', 120)), repeat('x', 120), 'but 120 is fine');
select is(public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', 'Play it on any table tonight.'),
  'Play it on any table tonight.', 'set again');

-- The member's Bonus card reads it; another club's member is not told it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select bonus_line from public.my_bonus()), 'Play it on any table tonight.', 'the member''s Bonus comes with the club''s line');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select is((select bonus_line from public.my_bonus()), null, 'another club''s member is not told RIVR''s line');
reset role;

-- Activity keeps the change, and no settings alert is raised for it.
select ok(exists (select 1 from public.audit_log a where a.action = 'update' and a.after ->> 'bonus_line' = 'Play it on any table tonight.'),
  'Activity keeps the change');
select is((select count(*)::int from public.alert a where a.kind = 'venue.config_changed' and a.created_at = now()), 0,
  'and it raises no settings alert');

-- Another club's member sets no line here.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select throws_ok($$ select public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', 'Another club''s line') $$,
  '42501', null, 'another club''s member sets no line here');

-- Blank keeps the app's own again.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is(public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', '   '), null, 'blank keeps the app''s own line');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select bonus_line from public.my_bonus()), null, 'and the member''s card shows it');

-- Last, as a freeze takes two people to release: a frozen club's line stays as it is.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.set_content_bonus_line('00000000-0000-4000-8000-000000000001', 'Frozen line') $$,
  'RVFRZ', null, 'a frozen club''s line is not changed');
reset role;

select * from finish();
rollback;
