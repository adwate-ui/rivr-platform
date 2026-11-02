-- The owner's alerts (decision 0301): a visit rated 1 or 2, an in-person check that failed its PAN recheck, and a break
-- taken while seated. 103 Aditya (admin) seats Ishaan (211); members 212 to 216.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A form with 3s tells the General Manager, not the owner.
insert into public.feedback (venue_id, member_id, note, ratings, nps)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 'The chai was cold.',
        '{"ambience": 4, "cashier": 4, "gameplay": 3, "service": 3}', 7);
select is((select count(*)::integer from public.alert where kind = 'feedback.low_rating'), 0, 'a 3 tells the General Manager, not the owner');

-- A visit rated 2, and a detailed form with a 1 in it: the owner hears of each.
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-0000000a9801', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
   now() - interval '5 hours', now() - interval '1 hour', 'door');
insert into public.feedback (venue_id, member_id, visit_id, score)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000a9801', 2);
insert into public.feedback (venue_id, member_id, note, ratings, nps)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'Waited an hour for a seat.',
        '{"ambience": 4, "cashier": 5, "gameplay": 1, "service": 4}', 3);
select is((select count(*)::integer from public.alert where kind = 'feedback.low_rating'), 2, 'a 2, and a 1 in a detailed form, alert the owner');
select ok((select bool_and(detail ? 'feedback_id' and not detail ? 'note' and not detail ? 'member_id') from public.alert
            where kind = 'feedback.low_rating'), 'naming the feedback, never the member nor what was written');
insert into public.feedback (venue_id, member_id, note, ratings, nps)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'Again: waited an hour.',
       '{"ambience": 1, "cashier": 1, "gameplay": 1, "service": 1}', 0
from generate_series(1, 3);
select is((select count(*)::integer from public.alert where kind = 'feedback.low_rating'), 2, 'more poor forms from Mihir tonight alert no more');
select ok(exists (select 1 from public.outbox_event o where o.event_type = 'alert.raised' and o.payload ->> 'kind' = 'feedback.low_rating'),
  'sent on to the owner''s WhatsApp as every alert is');

-- An in-person check's PAN recheck: a difference sends it back to review and alerts the owner; a match does not.
update public.kyc_record set method = 'manual', pan_rechecked_at = null
where member_id in ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000214');
select private.record_kyc_recheck('00000000-0000-4000-8000-000000000214', 'matched');
select private.record_kyc_recheck('00000000-0000-4000-8000-000000000212', 'name_differs');
select results_eq($$ select k.member_id::text from public.alert a join public.kyc_record k on k.id = (a.detail ->> 'kyc_record_id')::uuid
                     where a.kind = 'kyc.recheck_failed' $$,
  $$ values ('00000000-0000-4000-8000-000000000212') $$, 'only the failed recheck alerts the owner, naming the check');

-- A break while seated alerts the owner; a break away from the tables does not. Aditya seats Ishaan first.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where name = 'Table 3' and venue_id = '00000000-0000-4000-8000-000000000001'), 4,
  '9000000211');
reset role;
select ok(exists (select 1 from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null),
  'Ishaan is seated');
insert into public.self_exclusion (venue_id, member_id, ends_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() + interval '7 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() + interval '7 days');
select results_eq($$ select b.member_id::text from public.alert a join public.self_exclusion b on b.id = (a.detail ->> 'break_id')::uuid
                     where a.kind = 'member.break_while_seated' $$,
  $$ values ('00000000-0000-4000-8000-000000000211') $$, 'the owner hears of the break taken while seated only, naming the break');
-- Ishaan lengthens his break again and again from his seat: one alert, not one each time.
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() + make_interval(secs => n), now() + interval '8 days'
from generate_series(1, 3) n;
select is((select count(*)::integer from public.alert where kind = 'member.break_while_seated'), 1, 'a break that lengthens one running alerts no more');

select * from finish();
rollback;
