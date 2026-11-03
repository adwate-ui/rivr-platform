-- Notices edited and formatted (decision 0424): line breaks kept, links https only and never with a user part, up to 500
-- characters; a start and an end when put up; edited in place while live or to come, never once ended. 102 Meera is a
-- super admin; 108 Karan a host; 201 Arjun a member; Elsewhere is another club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
create temp table elsewhere as
  with made as (insert into public.notice (venue_id, body) values ('00000000-0000-4000-8000-0000000000e1', 'Theirs') returning id)
  select id from made;
grant select on elsewhere to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
create temp table posted as select public.post_notice('00000000-0000-4000-8000-000000000001',
  E'\r\n Launch night is Sunday.\r\nDoors at 7 pm.\r\n\r\nDetails: https://rivrpoker.com/launch \n\n') as id;
grant select on posted to authenticated;
select results_eq($$ select body from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from posted) $$,
  $$ values (E'Launch night is Sunday.\nDoors at 7 pm.\n\nDetails: https://rivrpoker.com/launch'::text) $$,
  'line breaks kept, the ends trimmed of spaces and blank lines');

select lives_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', repeat('x', 500)) $$, 'up to 500 characters');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', repeat('x', 501)) $$, '22023', null, 'but not 501');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', E' \n\r\n\t ') $$, '22023', null,
  'a notice says something, not only blank lines');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'See http://rivrpoker.com') $$, '22023', null,
  'a link is https');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'See https://rivrpoker.com@evil.example') $$, '22023', null,
  'and names no user, which hides where it goes');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'See https:///rivrpoker.com@evil.example') $$, '22023', null,
  'nor behind extra slashes, which a browser skips');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'See https://rivrpoker.com' || chr(133) || '@evil.example') $$,
  '22023', null, 'nor behind an invisible control mark');
create temp table pasted as select
  public.post_notice('00000000-0000-4000-8000-000000000001', 'See ' || chr(8238) || 'https://evil.co/moc.rekoprvir') as turned,
  public.post_notice('00000000-0000-4000-8000-000000000001', 'See https://rivrpoker.co' || chr(8203) || 'm/login') as split,
  public.post_notice('00000000-0000-4000-8000-000000000001', 'Call ' || chr(8234) || '+91 98765 43210' || chr(8236)) as phone,
  public.post_notice('00000000-0000-4000-8000-000000000001', 'क' || chr(8205) || 'ष and 👨' || chr(8205) || '👩') as joined;
grant select on pasted to authenticated;
select results_eq($$ select n.body from public.venue_notices('00000000-0000-4000-8000-000000000001') n, pasted p
                     where n.notice_id in (p.turned, p.split, p.phone, p.joined) order by n.body $$,
  $$ values ('Call +91 98765 43210'::text), ('See https://evil.co/moc.rekoprvir'), ('See https://rivrpoker.com/login'),
            ('क' || chr(8205) || 'ष and 👨' || chr(8205) || '👩') $$,
  'invisible marks pasted in are taken out, so a link reads as it goes; the joiners Hindi and emoji need stay');
select lives_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001',
  E'नमस्ते!\tWrite to info@rivrpoker.com or see https://www.youtube.com/@rivrpoker') $$,
  'Hindi, a tab, an email address and an @ in a link''s path are all fine');
create temp table backdated as select public.post_notice('00000000-0000-4000-8000-000000000001', 'Backdated', now() - interval '1 day', null) as id;
grant select on backdated to authenticated;
select results_eq($$ select starts_at from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from backdated) $$,
  $$ values (now()) $$, 'a start in the past is now');

create temp table later as select public.post_notice('00000000-0000-4000-8000-000000000001', 'Tuesday is ladies'' night.',
  now() + interval '1 day', now() + interval '2 days') as id;
grant select on later to authenticated;
select results_eq($$ select starts_at from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from later) $$,
  $$ values (now() + interval '1 day') $$, 'one can be put up to start later');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'Backwards', now() + interval '2 days', now() + interval '1 day') $$,
  '22023', null, 'ending after it starts');
select throws_ok($$ select public.post_notice('00000000-0000-4000-8000-000000000001', 'Gone', null, now() - interval '1 minute') $$,
  '22023', null, 'and not already over');

select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.my_notices() where notice_id = (select id from later)), 0, 'Arjun does not see it before it starts');

-- Edited in place: the words change for members at once; a live notice keeps its start.
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select lives_ok($$ select public.update_notice((select id from posted), E'Launch night is Sunday.\nDoors at 8 pm.',
  now() + interval '3 hours', now() + interval '5 days') $$, 'Meera edits the live notice');
select results_eq($$ select starts_at, ends_at from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from posted) $$,
  $$ values (now(), now() + interval '5 days') $$, 'its end moves; its start, already passed, stays');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select body from public.my_notices() where notice_id = (select id from posted) $$,
  $$ values (E'Launch night is Sunday.\nDoors at 8 pm.'::text) $$, 'Arjun reads the new words');

select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select lives_ok($$ select public.update_notice((select id from later), 'Tuesday is ladies'' night.', now() + interval '6 hours', null) $$,
  'one still to come can start at another time, and run until ended');
select results_eq($$ select starts_at, ends_at from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from later) $$,
  $$ values (now() + interval '6 hours', null::timestamptz) $$, 'and does');
select throws_ok($$ select public.update_notice((select id from posted), 'See http://rivrpoker.com', null, null) $$, '22023', null,
  'an edit keeps to the same rules');
select throws_ok($$ select public.update_notice((select id from posted), 'Over already', null, now()) $$, '22023', null,
  'and ends after now');
create temp table coming as select public.post_notice('00000000-0000-4000-8000-000000000001', 'Quiz night Friday.', now() + interval '1 day', null) as id;
grant select on coming to authenticated;
select lives_ok($$ select public.update_notice((select id from coming), 'Quiz night Friday.', now() - interval '1 hour', null) $$,
  'one still to come moved into the past');
select results_eq($$ select starts_at from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from coming) $$,
  $$ values (now()) $$, 'starts now, never earlier');
create temp table withdrawn as select public.post_notice('00000000-0000-4000-8000-000000000001', 'Maybe Tuesday.', now() + interval '1 day', null) as id;
grant select on withdrawn to authenticated;
select lives_ok($$ select public.end_notice((select id from withdrawn)) $$, 'one still to come can be taken down before it starts');
select is((select count(*)::integer from public.venue_notices('00000000-0000-4000-8000-000000000001') where notice_id = (select id from withdrawn)), 0,
  'and is gone, rather than left to start');

-- Every edit and withdrawal is audited, with who made it.
reset role;
select ok(exists (select 1 from public.audit_log a where a.entity = 'notice' and a.action = 'update' and a.entity_id = (select id from posted)::text
                  and a.actor_user_id = '00000000-0000-4000-8000-000000000102'), 'Meera''s edit is in the audit log');
select ok(exists (select 1 from public.audit_log a where a.entity = 'notice' and a.action = 'delete' and a.entity_id = (select id from withdrawn)::text),
  'and so is the notice taken down before it started');

-- An ended notice is history: it is not edited.
update public.notice set starts_at = now() - interval '2 minutes', ends_at = now() - interval '1 minute' where id = (select id from later);
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select public.update_notice((select id from later), 'Again', null, null) $$, 'P0002', null, 'an ended notice is not edited');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.update_notice((select id from posted), 'Mine', null, null) $$, '42501', null, 'a host edits none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select public.update_notice((select id from elsewhere), 'Mine', null, null) $$, '42501', null,
  'nor does Meera edit another club''s');

select * from finish();
rollback;
