-- A seat bonus in tiers (the owner, 12 Nov; decision 0580; #909): the first X members to claim it get A chips, the next Y get
-- B, over the promotion's life, each member once, on their first seat of a visit; nothing once the last tier is claimed. The
-- twins are proved on the golden file (024_golden_twins); here the sweep pays them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's live promotions back to drafts: only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.terms_ok(p_reward jsonb, p_limits jsonb) returns boolean language sql as $$
  select private.is_promotion_terms(p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
    '{"days": [2], "from": "06:00", "to": "06:00", "startsOn": "2026-11-01", "timezone": "Asia/Kolkata"}', p_limits,
    '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
$$;
select ok(pg_temp.terms_ok('{"kind": "seat_bonus", "tiers": [{"count": 10, "chips": 5000}, {"count": 20, "chips": 2000}]}', '{"perMember": "once"}'),
  'a seat bonus in tiers, once a member');
select ok(not pg_temp.terms_ok('{"kind": "seat_bonus", "tiers": [{"count": 10, "chips": 5000}]}', '{"perMember": "none"}'),
  'never more than once a member');
select ok(not pg_temp.terms_ok('{"kind": "seat_bonus", "tiers": [{"count": 10, "chips": 5000}]}',
                               '{"perMember": "once", "budgetChips": 100000, "budgetPeriod": "month"}'),
  'and never counted afresh each month');
select ok(not pg_temp.terms_ok('{"kind": "seat_bonus", "tiers": []}', '{"perMember": "once"}')
          and not pg_temp.terms_ok('{"kind": "seat_bonus", "tiers": [{"count": 0, "chips": 5000}]}', '{"perMember": "once"}')
          and not pg_temp.terms_ok('{"kind": "seat_bonus", "tiers": [{"count": 10, "chips": 75}]}', '{"perMember": "once"}'),
  'with at least one tier, each of at least one claim, in whole 50s');
select ok(not pg_temp.terms_ok('{"kind": "seat_bonus", "chips": 1000, "tiers": [{"count": 10, "chips": 5000}]}', '{"perMember": "once"}'),
  'and never both fixed chips and tiers');

-- Live from yesterday: the first member to claim it gets 1,000, the next 500, and no one after.
insert into public.promotion (id, venue_id, name) values ('40900000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'First two');
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
values ('00000000-0000-4000-8000-000000000001', '40900000-0000-4000-8000-000000000001', 1, 'live', 'First two',
        '{"kind": "seat_bonus", "tiers": [{"count": 1, "chips": 1000}, {"count": 1, "chips": 500}]}',
        '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
        jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                           'timezone', 'Asia/Kolkata'),
        '{"perMember": "once"}', '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
select private.sync_promotion('40900000-0000-4000-8000-000000000001');

-- A member's first seat of a visit, taken `p_ago` before now and left, past its two minutes of Undo.
create function pg_temp.first_seat(p_member text, p_ago interval) returns uuid language sql as $$
  with v as (
    insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
    values ('00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || p_member)::uuid, now() - p_ago - interval '5 minutes', now(), 'door')
    returning id, venue_id, member_id
  )
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select v.venue_id, v.member_id, v.id, g.id, 1, now() - p_ago, now() - p_ago, now() - p_ago + interval '10 minutes', 'left'
  from v join public.game_table g on g.venue_id = v.venue_id and g.name = 'Table 2'
  returning id;
$$;
create function pg_temp.paid(p_member text) returns bigint language sql as $$
  select coalesce(sum(g.chips), 0)::bigint from public.promotion_grant g
  where g.promotion_id = '40900000-0000-4000-8000-000000000001' and g.member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid;
$$;

select pg_temp.first_seat('211', interval '50 minutes');
select pg_temp.first_seat('212', interval '40 minutes');
select pg_temp.first_seat('213', interval '30 minutes');
select private.sweep_seat_bonus();
select is(pg_temp.paid('211'), 1000::bigint, 'the first to claim it gets the first tier''s 1,000');
select is(pg_temp.paid('212'), 500::bigint, 'the next the next tier''s 500');
select is(pg_temp.paid('213'), 0::bigint, 'and the third nothing: every tier is claimed');

-- Ishaan's next visit: never a second time.
select pg_temp.first_seat('211', interval '20 minutes');
select private.sweep_seat_bonus();
select is(pg_temp.paid('211'), 1000::bigint, 'a member claims it once');
select is((select count(*)::integer from public.promotion_grant where promotion_id = '40900000-0000-4000-8000-000000000001'), 2,
  'two grants in all');

select * from finish();
rollback;
