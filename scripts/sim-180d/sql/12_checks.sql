-- 180-day simulation: the checks, by area. SIMULATION ONLY. See 11_invariants.sql for how a check is recorded.

-- Ledger and state, kept from the 90-day set where a live screen still reaches the code (the catalogue decides).
create function sim.checks_state(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'L01', 'Every ledger transaction sums to zero with at least two lines',
    'select t.id, sum(e.amount) as s, count(*) as n from public.ledger_transaction t join public.ledger_entry e on e.transaction_id = t.id
     where t.venue_id = sim.venue() group by t.id having sum(e.amount) <> 0 or count(*) < 2');
  perform sim.check(d, p_scope, 'L02', 'Every transaction uses one unit',
    'select e.transaction_id from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
     where e.venue_id = sim.venue() group by e.transaction_id having count(distinct a.unit) > 1');
  perform sim.check(d, p_scope, 'L03', 'No request id is used twice',
    'select ''fnb_order'' as t, idempotency_key::text as k from public.fnb_order where venue_id = sim.venue() and idempotency_key is not null group by 2 having count(*) > 1
     union all select ''waitlist_entry'', idempotency_key::text from public.waitlist_entry where venue_id = sim.venue() and idempotency_key is not null group by 2 having count(*) > 1
     union all select ''call_time_request'', idempotency_key::text from public.call_time_request where venue_id = sim.venue() group by 2 having count(*) > 1
     union all select ''redemption'', idempotency_key::text from public.redemption where venue_id = sim.venue() and idempotency_key is not null group by 2 having count(*) > 1
     union all select ''bonus_grant'', idempotency_key::text from public.bonus_grant where venue_id = sim.venue() and idempotency_key is not null group by 2 having count(*) > 1');
  perform sim.check(d, p_scope, 'S01', 'No open seat on a closed visit',
    'select s.id from public.seat_session s join public.visit v on v.id = s.visit_id where s.venue_id = sim.venue() and s.ended_at is null and v.closed_at is not null');
  perform sim.check(d, p_scope, 'S02', 'No open seat at a closed table',
    'select s.id from public.seat_session s join public.game_table t on t.id = s.table_id where s.venue_id = sim.venue() and s.ended_at is null and not t.is_open');
  perform sim.check(d, p_scope, 'S03', 'Nothing outlives its night: visits, seats, places, join requests, top-ups, orders, time requests',
    'select ''visit'' as kind, id from public.visit where venue_id = sim.venue() and closed_at is null and opened_at < private.tonight_began(sim_clock.now())
     union all select ''seat'', id from public.seat_session where venue_id = sim.venue() and ended_at is null and started_at < private.tonight_began(sim_clock.now())
     union all select ''waitlist'', id from public.waitlist_entry where venue_id = sim.venue() and status = ''waiting'' and joined_at < private.tonight_began(sim_clock.now())
     union all select ''top_up'', id from public.top_up_request where venue_id = sim.venue() and closed_at is null and requested_at < private.tonight_began(sim_clock.now())
     union all select ''order'', id from public.fnb_order where venue_id = sim.venue() and delivered_at is null and cancelled_at is null and created_at < private.tonight_began(sim_clock.now())
     union all select ''time_request'', id from public.call_time_request where venue_id = sim.venue() and status = ''pending'' and requested_at < private.tonight_began(sim_clock.now())');
  perform sim.check(d, p_scope, 'S07', 'No outbox delivery is stuck or failed',
    'select id, consumer, status, last_error from public.outbox_delivery where venue_id = sim.venue()
       and ((status = ''processing'' and locked_until < sim_clock.now() - interval ''10 minutes'') or status = ''failed'')');
  perform sim.check(d, p_scope, 'S08', 'No seat or visit runs longer than 16 hours',
    'select ''seat'' as kind, id from public.seat_session where venue_id = sim.venue() and started_at >= sim.since()
       and coalesce(ended_at, sim_clock.now()) - started_at > interval ''16 hours''
     union all select ''visit'', id from public.visit where venue_id = sim.venue() and opened_at >= sim.since()
       and coalesce(closed_at, sim_clock.now()) - opened_at > interval ''16 hours''');
  perform sim.check(d, p_scope, 'S09', 'The practice venue reaches no vendor (no delivery, no message)',
    'select dl.id::text from public.outbox_delivery dl join public.venue v on v.id = dl.venue_id where v.is_practice and dl.status = ''delivered''
     union all select m.id::text from sim.message m where m.payload ->> ''venue_id'' = sim.practice()::text');
end $$;

-- Bonus chips, play-time steps, points, the hand-given extras and the identity check at the club.
create function sim.checks_features(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'N01', 'Bonus chips: the ledger balance equals the grants not yet used, never negative, never expired',
    'select g.member_id, g.left_paise, coalesce(b.natural_balance, 0) as ledger from
       (select member_id, sum(remaining_paise) as left_paise from public.bonus_grant where venue_id = sim.venue() group by 1) g
       left join public.ledger_balance b on b.member_id = g.member_id and b.code = ''member.bonus''
     where coalesce(b.natural_balance, 0) <> g.left_paise or g.left_paise < 0
     union all select member_id, remaining_paise, null from public.bonus_grant where venue_id = sim.venue() and expired_at >= sim.since()');
  perform sim.check(d, p_scope, 'N02', 'Play-time bonus: each step paid once a visit, and only while seated',
    'select member_id, period_key, promotion_rule_id, count(*) as paid from public.promotion_grant
     where promotion_version_id = (select version_id from sim.promo where key = ''hours'') group by 1, 2, 3 having count(*) > 1
     union all select g.member_id, g.period_key, g.promotion_rule_id, 0 from public.promotion_grant g
     where g.promotion_version_id = (select version_id from sim.promo where key = ''hours'')
       and not exists (select 1 from public.seat_session s where s.member_id = g.member_id and s.started_at <= g.created_at
                       and coalesce(s.ended_at, ''infinity'') >= g.created_at - interval ''10 minutes'')');
  perform sim.check(d, p_scope, 'N03', 'Points by hand: a staff member over the daily cap has alerted the owner',
    'select s.key, private.points_given_tonight(sim.venue(), s.user_id) as given from sim.staff s
     where s.role <> ''super_admin'' and private.points_given_tonight(sim.venue(), s.user_id) > 10000
       and not exists (select 1 from public.alert a where a.venue_id = sim.venue() and a.kind = ''points.daily_cap''
                       and a.raised_at >= private.tonight_began(sim_clock.now()))');
  perform sim.check(d, p_scope, 'N04', 'Bonus chips by hand: a reason, and never to the giver''s own record',
    'select g.id, g.reason from public.bonus_grant g join public.audit_log a on a.entity = ''bonus_grant'' and a.entity_id = g.id::text and a.action = ''insert''
       join public.member m on m.id = g.member_id
     where g.venue_id = sim.venue() and a.actor_user_id is not null and (a.actor_user_id = m.user_id or length(trim(coalesce(g.reason, ''''))) < 3)');
  perform sim.check(d, p_scope, 'N05', 'No points, locked points or bonus chips balance is negative',
    'select member_id, code, natural_balance from public.ledger_balance where venue_id = sim.venue()
       and code in (''member.points'', ''member.points_locked'', ''member.bonus'') and natural_balance < 0');
  perform sim.check(d, p_scope, 'N12', 'Identity check: one welcome grant per member, even after a reopened check',
    'select member_id, count(*) from public.promotion_grant where promotion_version_id = (select version_id from sim.promo where key = ''signup'')
     group by 1 having count(*) > 1');
end $$;
