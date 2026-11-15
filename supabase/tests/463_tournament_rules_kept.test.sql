-- What stays true of tournaments after the module went (issue 969; decision 0630), as 401, 379 and 204 proved it before:
-- the name a member is told goes out from the club's number in plain words; a start moved, whatever writes it, is told by
-- the name they asked about; a fourth change told in an hour is refused, from the console too; only those who run
-- tournaments withdraw one, and only before it starts; nobody asks about one withdrawn; and Home lists twenty at most.
-- 103 Aditya runs tournaments, 106 Pema is a dealer, 213 Mihir is a member who hears of tournaments.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- What Mihir was told of this test's tournament: each notice's params.
create function pg_temp.told(p_tournament text, p_notice text) returns setof jsonb language sql as $$
  select e.payload -> 'params' from public.outbox_event e
  where e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000c46' || p_tournament
    and e.payload ->> 'notice' = p_notice and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000213';
$$;

create temp table told_at on commit drop as select date_trunc('minute', now()) + interval '3 days' as starts;
grant select on told_at to authenticated;

insert into public.tournament (id, venue_id, name, starts_at, game, is_published)
select ('00000000-0000-4000-8000-0000000c46' || t.n)::uuid, '00000000-0000-4000-8000-000000000001', t.name, t.starts, 'No-limit hold''em', true
from (values ('11', 'Turbo* ~ 5K https://x.in/9876543210 Cup', (select starts from told_at)), ('12', 'Moved Cup', (select starts from told_at)),
             ('13', 'Rename Cup', (select starts from told_at)), ('14', 'Busy Cup', (select starts from told_at)),
             ('15', 'Withdrawn Cup', (select starts from told_at)), ('16', 'Started Cup', now() - interval '1 hour')) t (n, name, starts);
insert into public.tournament_interest (venue_id, tournament_id, member_id)
select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-0000000c46' || w.n)::uuid, '00000000-0000-4000-8000-000000000213'
from (values ('11'), ('12'), ('13'), ('14')) w (n);

-- ---------------------------------------------------------------------------------------------------
-- The name goes out from the club's number, so only plain words of it do (decision 0303).
select is(private.tournament_name_for_members('Turbo* ~ 5K https://x.in/9876543210 Cup'), 'Turbo 5K xin/ Cup', 'no marks, no link and no long number');
select is(private.tournament_name_for_members('***'), 'A tournament', 'and a name with nothing left reads plainly');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.notify_tournament('00000000-0000-4000-8000-0000000c4611'), 1, 'a name with marks is notified all the same');
reset role;
select is((select p ->> 0 from pg_temp.told('11', 'tournament_starts') p), 'Turbo 5K xin/ Cup', 'and goes out clean');

-- ---------------------------------------------------------------------------------------------------
-- A start moved, whatever writes the row: the console no longer edits one, so only the database's owner does.
update public.tournament set starts_at = starts_at + interval '20 seconds' where id = '00000000-0000-4000-8000-0000000c4612';
select is_empty($$ select * from pg_temp.told('12', 'tournament_moved') $$, 'a change within the same minute tells nobody');
update public.tournament set starts_at = starts_at + interval '1 hour' where id = '00000000-0000-4000-8000-0000000c4612';
select results_eq($$ select p ->> 0, (p ->> 1)::timestamptz from pg_temp.told('12', 'tournament_moved') p $$,
  $$ select 'Moved Cup'::text, starts + interval '1 hour 20 seconds' from told_at $$, 'a move is told as one, with its name and new start');
update public.tournament set name = 'Sunday Special', starts_at = starts_at + interval '1 hour' where id = '00000000-0000-4000-8000-0000000c4613';
select is((select p ->> 0 from pg_temp.told('13', 'tournament_moved') p), 'Rename Cup', 'one that also renames it is told by the name they asked about');

-- ---------------------------------------------------------------------------------------------------
-- Three changes told in an hour is the most: the fourth is refused, so it shows.
insert into public.outbox_event (venue_id, event_type, payload, idempotency_key, occurred_at)
select '00000000-0000-4000-8000-000000000001', 'member.notice',
       jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000213', 'tournament_id', '00000000-0000-4000-8000-0000000c4614', 'notice', 'tournament_moved',
                          'params', jsonb_build_array('Busy Cup', '2026-11-22T13:30:00+00:00')),
       'test463:' || n, now() - make_interval(mins => n * 5)
from generate_series(1, 3) n;
select throws_ok($$ update public.tournament set starts_at = starts_at + interval '1 hour' where id = '00000000-0000-4000-8000-0000000c4614' $$,
  'RVRAT', null, 'a fourth change told in an hour is refused, whatever writes it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4614') $$,
  'RVRAT', null, 'withdrawing it from the console too, which tells everyone who asked');
reset role;
select lives_ok($$ update public.tournament set starts_at = starts_at + interval '20 seconds' where id = '00000000-0000-4000-8000-0000000c4614' $$,
  'a change that tells nobody is not');

-- ---------------------------------------------------------------------------------------------------
-- Withdrawing: those who run tournaments, before it starts; and nobody asks about it after.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4615') $$, '42501', null, 'a dealer withdraws nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4616') $$, '42501', null, 'nor is one withdrawn once it has started');
select lives_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4615') $$, 'the admin withdraws one to come');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c4615') $$, '22023', null,
  'and nobody asks to be told of it after');
reset role;

-- ---------------------------------------------------------------------------------------------------
-- Home lists the first twenty to come.
insert into public.tournament (venue_id, name, starts_at, game, is_published)
select '00000000-0000-4000-8000-000000000001', 'Bulk ' || n, now() + make_interval(hours => n), 'No-limit hold''em', true from generate_series(1, 25) n;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.my_upcoming_tournaments()), 20, 'Home shows twenty at most');
reset role;

select * from finish();
rollback;
