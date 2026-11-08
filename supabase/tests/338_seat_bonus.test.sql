-- The seat bonus (audit F-005; the owner, 8 Nov): a fixed number of bonus chips on the first seat of a visit, or on each of
-- the first N seats at a table in a club day, paid once the seat is past its two minutes of Undo by a sweep each minute. The
-- twins are proved on the golden file (024_golden_twins).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts: only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.terms_ok(p_reward jsonb) returns boolean language sql as $$
  select private.is_promotion_terms(p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [2], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', '{"perMember": "none"}',
    '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
$$;
select ok(pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 1000}') and pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 1000, "firstNSeatsPerTable": 5}'),
  'a seat bonus is fixed chips, with or without a first N');
select ok(not pg_temp.terms_ok('{"kind": "seat_bonus", "percent": 20}') and not pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 1000, "percent": 20}'),
  'never a percentage');
select ok(not pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 75}'), 'and in whole 50s of chips');
select ok(exists (select 1 from cron.job where jobname = 'seat-bonus' and schedule = '* * * * *'), 'the sweep runs each minute');

-- A version live from yesterday, every day all day, for everyone at every stake.
create function pg_temp.live(p_name text, p_reward jsonb) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', p_name, p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                             'timezone', 'Asia/Kolkata'),
          '{"perMember": "none"}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;

-- A visit for a member, opened an hour ago and closed so that it never meets a seeded open one.
create function pg_temp.visit(p_member text) returns uuid language sql as $$
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  values ('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid, now() - interval '1 hour', now(), 'door')
  returning id;
$$;

-- A seat taken `p_ago` before now and already left, so that it meets no seeded seat.
create function pg_temp.seat(p_visit uuid, p_table text, p_seat integer, p_ago interval, p_stayed interval default null, p_by uuid default null) returns uuid language sql as $$
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, seated_by_staff_id)
  select v.venue_id, v.member_id, v.id, g.id, p_seat, now() - p_ago, now() - p_ago, coalesce(now() - p_ago + p_stayed, now()), 'left', p_by
  from public.visit v join public.game_table g on g.venue_id = v.venue_id and g.name = p_table
  where v.id = p_visit
  returning id;
$$;

create function pg_temp.chips(p_member text) returns bigint language sql as $$
  select coalesce(sum((g.effect ->> 'chips')::bigint), 0)::bigint from public.promotion_grant g
  where g.member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and g.source_key like 'seated:%';
$$;

create temporary table ids (name text primary key, id uuid) on commit drop;

insert into ids select 'first seat', pg_temp.live('First seat', '{"kind": "seat_bonus", "chips": 1000}');
insert into ids select 'visit', pg_temp.visit('211');
insert into ids select 'seat one', pg_temp.seat((select id from ids where name = 'visit'), 'Table 3', 7, interval '4 minutes');
insert into ids select 'seat two', pg_temp.seat((select id from ids where name = 'visit'), 'Table 3', 8, interval '3 minutes');
insert into ids select 'in undo', pg_temp.seat(pg_temp.visit('212'), 'Table 3', 9, interval '1 minute');
insert into ids select 'too old', pg_temp.seat(pg_temp.visit('213'), 'Table 3', 6, interval '25 hours');

select private.sweep_seat_bonus();
select is(pg_temp.chips('211'), 1000::bigint, 'the first seat of a visit past its Undo pays its chips, and the later seat of that visit does not');
select is((select source_key from public.promotion_grant where member_id = '00000000-0000-4000-8000-000000000211' and source_key like 'seated:%'),
          'seated:' || (select id from ids where name = 'seat one'), 'paid for the first of the two');
select is(pg_temp.chips('212'), 0::bigint, 'a seat still inside its two minutes of Undo pays nothing yet');
select is(pg_temp.chips('213'), 0::bigint, 'a seat long past is not reached back over');

select private.sweep_seat_bonus();
select is(pg_temp.chips('211'), 1000::bigint, 'and the next minute''s sweep pays it no second time');

-- The first N at a table: the earliest seated, whoever they are and whichever seat of their visit it is.
update public.promotion_version set status = 'ended' where name = 'First seat';
select private.sync_promotion((select id from ids where name = 'first seat'));
insert into ids select 'first two', pg_temp.live('First two', '{"kind": "seat_bonus", "chips": 500, "firstNSeatsPerTable": 2}');
insert into ids select 'visit 214', pg_temp.visit('214');
select pg_temp.seat((select id from ids where name = 'visit 214'), 'Table 4', 1, interval '6 minutes');
select pg_temp.seat((select id from ids where name = 'visit 214'), 'Table 4', 2, interval '5 minutes');
select pg_temp.seat(pg_temp.visit('215'), 'Table 4', 3, interval '4 minutes 30 seconds');
select pg_temp.seat(pg_temp.visit('218'), 'Table 4', 4, interval '4 minutes');
select pg_temp.seat(pg_temp.visit('216'), 'Table 1', 1, interval '4 minutes');
select private.sweep_seat_bonus();
select is(pg_temp.chips('214'), 500::bigint, 'one member takes one of the first N a club day, whatever seats they take');
select is(pg_temp.chips('215'), 500::bigint, 'so the next member seated has the second place');
select is(pg_temp.chips('218'), 0::bigint, 'and the third member at that table has none');
select is(pg_temp.chips('216'), 500::bigint, 'and each table counts its own');

-- A seat released inside its two minutes pays nobody; nor does one a staff member gave themselves.
select pg_temp.seat(pg_temp.visit('201'), 'Table 2', 1, interval '5 minutes', interval '30 seconds');
create function pg_temp.karan() returns uuid language sql as $$
  select s.id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000108';
$$;
update public.member set user_id = '00000000-0000-4000-8000-000000000108' where id = '00000000-0000-4000-8000-000000000202';
select pg_temp.seat(pg_temp.visit('202'), 'Table 2', 2, interval '5 minutes', null, pg_temp.karan());
select private.sweep_seat_bonus();
select is(pg_temp.chips('201'), 0::bigint, 'a seat released inside its Undo pays nobody');
select is(pg_temp.chips('202'), 0::bigint, 'and staff are not paid for seating themselves');

-- A promotion approved after the seat does not reach back over it.
update public.promotion_version set status = 'ended' where name = 'First two';
insert into ids select 'approved later', pg_temp.live('Approved later', '{"kind": "seat_bonus", "chips": 750}');
update public.promotion_version set decided_at = now() - interval '1 minute' where name = 'Approved later';
select pg_temp.seat(pg_temp.visit('203'), 'Table 2', 3, interval '5 minutes');
select private.sweep_seat_bonus();
select is(pg_temp.chips('203'), 0::bigint, 'a seat taken before the terms were approved is not paid by them');
update public.promotion_version set decided_at = now() - interval '1 day' where name = 'Approved later';

-- The next club day's sweep counts the seat in the day it was taken: replayed for last week, it shows as a seat.
select ok((select bool_or(e #>> '{event,kind}' = 'seated' and (e #>> '{event,isFirstOfVisit}')::boolean)
           from jsonb_array_elements(private.replay_version_events(
             (select v from public.promotion_version v where v.name = 'Approved later'), now() - interval '1 hour', now())) e),
  'the approver''s look at last week counts the seats taken');

-- With promotions stopped nothing is paid; the seat waits, and is paid when they start again.
insert into ids select 'frozen seat', pg_temp.seat(pg_temp.visit('217'), 'Table 2', 4, interval '4 minutes');
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test of the seat bonus');
select private.sweep_seat_bonus();
select is(pg_temp.chips('217'), 0::bigint, 'nothing while promotions are stopped');
select ok(not exists (select 1 from private.seat_bonus_weighed w where w.seat_session_id = (select id from ids where name = 'frozen seat')), 'and the seat is not marked weighed');
update public.control_state set released_at = now(), released_by_staff_id = pg_temp.karan(), release_reason = 'Test over' where released_at is null and reason = 'Test of the seat bonus';
select private.sweep_seat_bonus();
select is(pg_temp.chips('217'), 750::bigint, 'it is paid once they start again');

select * from finish();
rollback;
