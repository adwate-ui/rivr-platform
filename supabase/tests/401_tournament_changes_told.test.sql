-- Those who asked about a tournament and those marked registered hear when it is withdrawn, or its day or time changes, whatever
-- wrote the change (the owner, 9 Nov; decision 0571). 103 Aditya runs tournaments; 213 Mihir asked, 216 Kunal is registered, 217 Neel
-- asked and has been erased; 214 asked, and 211 asked and lost the feature.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- Who was told this of a tournament.
create function pg_temp.told(p_tournament text, p_notice text) returns setof text language sql as $$
  select e.payload ->> 'member_id' from public.outbox_event e
  where e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000c40' || p_tournament and e.payload ->> 'notice' = p_notice order by 1;
$$;

create temp table told_at on commit drop as select date_trunc('minute', now()) + interval '3 days' as starts;
grant select on told_at to authenticated;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, is_published, game, stake)
select ('00000000-0000-4000-8000-0000000c40' || t.n)::uuid, '00000000-0000-4000-8000-000000000001', t.name, (select starts from told_at), 1000000, true, 'NLH', '50/100'
from (values ('11', 'Sunday Cup'), ('12', 'Turbo* ~ 5K https://x.in/9876543210 Cup'), ('13', 'Rename Cup'), ('14', 'Break Cup'), ('15', 'Busy Cup'), ('16', 'Quiet Cup')) t (n, name);
insert into public.tournament_interest (venue_id, tournament_id, member_id)
select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-0000000c40' || w.n)::uuid, ('00000000-0000-4000-8000-000000000' || w.m)::uuid
from (values ('11', '213'), ('11', '217'), ('12', '213'), ('13', '213'), ('14', '213'), ('14', '214'), ('14', '211'), ('16', '213')) w (n, m);
insert into public.tournament_interest (venue_id, tournament_id, member_id, registered_at, registered_by_staff_id)
select '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-0000000c40' || w.n)::uuid, '00000000-0000-4000-8000-000000000216', now(), s.id
from public.staff s, (values ('11'), ('14')) w (n) where s.user_id = '00000000-0000-4000-8000-000000000103' and s.venue_id = '00000000-0000-4000-8000-000000000001';
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-000000000217';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4011', 'Sunday Cup', (select starts from told_at), 'NLH', '100/200', 'A new stake') $$,
  'a correction that keeps the day and time goes through');
select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4011', 'Sunday Cup', (select starts + interval '20 seconds' from told_at), 'NLH', '100/200', 'A new stake') $$,
  'as does one within the same minute');
reset role;
select is_empty($$ select * from pg_temp.told('11', 'tournament_moved') $$, 'and neither tells anyone');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4011', 'Sunday Cup', (select starts + interval '1 hour' from told_at), 'NLH', '100/200', 'A new stake') $$,
  'moving it an hour goes through');
reset role;
select results_eq($$ select * from pg_temp.told('11', 'tournament_moved') $$,
  $$ values ('00000000-0000-4000-8000-000000000213'::text), ('00000000-0000-4000-8000-000000000216') $$, 'those who asked and those registered are told, and nobody erased');
select ok((select bool_and((e.payload -> 'params' ->> 0) = 'Sunday Cup' and (e.payload -> 'params' ->> 1)::timestamptz = (select starts + interval '1 hour' from told_at))
           from public.outbox_event e where e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000c4011' and e.payload ->> 'notice' = 'tournament_moved'),
  'of its name and new start');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4011') $$, 'withdrawing it goes through');
reset role;
select results_eq($$ select * from pg_temp.told('11', 'tournament_withdrawn') $$,
  $$ values ('00000000-0000-4000-8000-000000000213'::text), ('00000000-0000-4000-8000-000000000216') $$, 'and both are told');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.publish_tournament_again('00000000-0000-4000-8000-0000000c4011') $$, 'publishing it again goes through');
reset role;
select is((select count(*)::integer from public.outbox_event e where e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000c4011'), 4, 'and tells nobody');

-- The name goes out from the club's number, so only plain words of it do (decision 0303).
select is(private.tournament_name_for_members('Turbo* ~ 5K https://x.in/9876543210 Cup'), 'Turbo 5K xin/ Cup', 'no marks, no link and no long number');
select is(private.tournament_name_for_members('***'), 'A tournament', 'and a name with nothing left reads plainly');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4012') $$, 'a name with marks is withdrawn all the same');
reset role;
select is((select e.payload -> 'params' ->> 0 from public.outbox_event e where e.payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000c4012'), 'Turbo 5K xin/ Cup', 'and goes out clean');

-- A move that also renames it says the name they asked about.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4013', 'Sunday Special', (select starts + interval '1 hour' from told_at), 'NLH', '100/200', '') $$, 'moved and renamed');
reset role;
select is((select e.payload -> 'params' ->> 0 from public.outbox_event e where e.payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000c4013'), 'Rename Cup', 'is told by the old name');

-- Whatever writes the row is covered.
update public.tournament set starts_at = starts_at + interval '2 hours' where id = '00000000-0000-4000-8000-0000000c4016';
select results_eq($$ select * from pg_temp.told('16', 'tournament_moved') $$, $$ values ('00000000-0000-4000-8000-000000000213'::text) $$, 'a change by any other path tells them too');

-- On a break a member hears only that a place they paid for will not run; one whose tier lost the feature, the same.
insert into public.self_exclusion (venue_id, member_id, ends_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() + interval '30 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() + interval '30 days');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'tournaments.register', false, 'test 401');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4014', 'Break Cup', (select starts + interval '1 hour' from told_at), 'NLH', '100/200', '') $$, 'moved');
select lives_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c4014') $$, 'then withdrawn');
reset role;
select results_eq($$ select * from pg_temp.told('14', 'tournament_moved') $$, $$ values ('00000000-0000-4000-8000-000000000214'::text) $$, 'a move reaches only those not on a break and with the feature');
select results_eq($$ select * from pg_temp.told('14', 'tournament_withdrawn') $$,
  $$ values ('00000000-0000-4000-8000-000000000214'::text), ('00000000-0000-4000-8000-000000000216') $$, 'a withdrawal also reaches who paid, on a break or not');

-- Three changes told in an hour is the most: the fourth is refused, so it shows.
insert into public.outbox_event (venue_id, event_type, payload, idempotency_key, occurred_at)
select '00000000-0000-4000-8000-000000000001', 'member.notice',
       jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000213', 'tournament_id', '00000000-0000-4000-8000-0000000c4015', 'notice', 'tournament_moved', 'params', jsonb_build_array('Busy Cup', '2026-11-22T13:30:00+00:00')),
       'test401:' || n, now() - make_interval(mins => n * 5)
from generate_series(1, 3) n;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4015', 'Busy Cup', (select starts + interval '1 hour' from told_at), 'NLH', '100/200', '') $$,
  'RVRAT', null, 'a fourth change told in an hour is refused');
select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c4015', 'Busy Cup', (select starts from told_at), 'NLH', '100/200', 'Tell nobody') $$,
  'one that tells nobody is not');
reset role;

select * from finish();
rollback;
