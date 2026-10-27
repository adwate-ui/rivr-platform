-- Satellites (#117; decision 0250; question #489): a Rebuy Wednesday made a satellite for a Weeknight Turbo. Its
-- pool buys seats at the Turbo's buy-in; the seats' winners get tickets and the next finisher the cash left. A
-- ticket pays an entry from the app or at the cage, comes back when its alternate is refunded, and lapses to the
-- wallet once the Turbo's registration closes. Then a guaranteed satellite with a seat for every run, a satellite
-- too small for a seat, and a target that finishes with tickets unused. 213 Mihir, 214 Yash and 215 Ritika are
-- members with their identity checks done; 216 a member without tournament registration; 103 Aditya an admin
-- (tournaments.manage); 104 a cashier; 106 a dealer; Elsewhere's admin runs nothing at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.fund(p_member uuid, p_paise bigint) returns uuid language sql as $$
  select private.post_ledger_transaction(m.venue_id, 'deposit', 'test-fund:' || p_member, jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = m.venue_id and a.code = 'venue.bank' and a.member_id is null),
                       'amount', p_paise::text),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member and a.code = 'member.cash'),
                       'amount', (-p_paise)::text)), null, 'Test deposit')
  from public.member m where m.id = p_member;
$$;
create function pg_temp.balance(p_code text) returns bigint language sql security definer as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = p_code and a.member_id is null;
$$;
create function pg_temp.named(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
create function pg_temp.run(p_name text, p_member uuid) returns uuid language sql security definer as $$
  select id from public.tournament_entry where tournament_id = pg_temp.named(p_name) and member_id = p_member order by entry_number desc limit 1;
$$;
create function pg_temp.ticket_status(p_target text, p_member uuid) returns text language sql security definer as $$
  select status from public.tournament_ticket where member_id = p_member and target_id = pg_temp.named(p_target);
$$;
grant execute on function pg_temp.named(text), pg_temp.run(text, uuid), pg_temp.balance(text), pg_temp.ticket_status(text, uuid) to authenticated;
-- Releases the controls a test engaged, by the reason it gave them.
create function pg_temp.release(p_reason text) returns void language sql as $$
  update public.control_state
  set released_at = now(), release_reason = 'Test over',
      released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001'),
      release_second_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001')
  where reason = p_reason and released_at is null;
$$;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published)
values ('00000000-0000-4000-8000-0000000000e1', 'Elsewhere Event', now(), 300000, true);
-- The cashier's own member record, on her number.
create temp table own as
  with made as (insert into public.member (venue_id, full_name, phone)
                values ('00000000-0000-4000-8000-000000000001', 'Sana Q.', '+919000000104') returning id)
  select id from made;
grant select on own to authenticated;
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000214', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000215', 5000000);
create temporary table before on commit drop as
  select pg_temp.balance('venue.tournament_pool') as pool, pg_temp.balance('venue.tournament_tickets') as tickets,
         private.wallet_cash('00000000-0000-4000-8000-000000000215') as ritika;
grant select on before to authenticated;

-- The target: a Weeknight Turbo, ₹3,000 with a ₹300 fee, in a room of one table of two seats. The satellite: a
-- Rebuy Wednesday, ₹2,000 with a ₹200 fee and 10,000 chips.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Ticket Turbo', now(), true);
select public.set_tournament_room(pg_temp.named('Ticket Turbo'), 1, 2);
select public.create_tournament('00000000-0000-4000-8000-0000000007c3', 'Ticket Satellite', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'Ticket Knockout', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c3', 'Entered Wednesday', now(), true);
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Turbo')) $$, '42501', null,
  'a member makes no satellite');
select public.register_tournament_entry(pg_temp.named('Entered Wednesday'), 'entry', '00000000-0000-4000-8000-00000000f400');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Turbo')) $$, '42501', null,
  'nor does another venue''s admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Satellite')) $$, '22023', null,
  'a satellite is never for itself');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Elsewhere Event')) $$, '22023', null,
  'nor for another venue''s tournament');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Knockout'), pg_temp.named('Ticket Turbo')) $$, '22023',
  'A satellite, with no bounty, for a tournament at this venue', 'a bounty tournament is no satellite');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Entered Wednesday'), pg_temp.named('Ticket Turbo')) $$, '22023', null,
  'nor is one players have already entered for its prizes');
select lives_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Turbo')) $$,
  'the floor makes the Rebuy Wednesday a satellite for the Turbo');
select public.start_tournament_clock(pg_temp.named('Ticket Satellite'));
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), null) $$, '22023', null,
  'once its clock starts, it stays one');

-- Three entries and Ritika's rebuy put ₹7,200 in: two seats at ₹3,000, and ₹1,200 left for third.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Ticket Satellite'), 'entry', '00000000-0000-4000-8000-00000000f401');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select public.register_tournament_entry(pg_temp.named('Ticket Satellite'), 'entry', '00000000-0000-4000-8000-00000000f402');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select public.register_tournament_entry(pg_temp.named('Ticket Satellite'), 'entry', '00000000-0000-4000-8000-00000000f403');
select public.register_tournament_entry(pg_temp.named('Ticket Satellite'), 'rebuy', '00000000-0000-4000-8000-00000000f404');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Ticket Satellite')) $$, 'RVTRN', null,
  'three players left for two seats: not yet, and no places'' shares asked for');
select throws_ok(format($$ select public.finish_tournament(%L, 'chip_chop', %L) $$, pg_temp.named('Ticket Satellite'),
                        jsonb_build_object(pg_temp.run('Ticket Satellite', '00000000-0000-4000-8000-000000000213'), 10000,
                                           pg_temp.run('Ticket Satellite', '00000000-0000-4000-8000-000000000214'), 10000,
                                           pg_temp.run('Ticket Satellite', '00000000-0000-4000-8000-000000000215'), 10000)), '22023', null,
  'a satellite takes no deal');
select is(public.bust_tournament_entry(pg_temp.run('Ticket Satellite', '00000000-0000-4000-8000-000000000213')), 3,
  'Mihir is out third, just outside the seats');
select throws_ok($$ select public.finish_tournament(pg_temp.named('Ticket Satellite')) $$, '22023', null,
  'with two left, the floor counts their chips to place them');
select lives_ok(format($$ select public.finish_tournament(%L, null, %L) $$, pg_temp.named('Ticket Satellite'),
                       jsonb_build_object(pg_temp.run('Ticket Satellite', '00000000-0000-4000-8000-000000000214'), 15000,
                                          pg_temp.run('Ticket Satellite', '00000000-0000-4000-8000-000000000215'), 25000)),
  'two left for two seats: the floor finishes it');
select lives_ok($$ select public.finish_tournament(pg_temp.named('Ticket Satellite')) $$, 'the same finish again changes nothing');

select results_eq($$ select m.full_name, e.place, k.value_paise, k.status, k.target_id = pg_temp.named('Ticket Turbo')
                     from public.tournament_ticket k join public.member m on m.id = k.member_id join public.tournament_entry e on e.id = k.entry_id
                     where k.satellite_id = pg_temp.named('Ticket Satellite') order by e.place $$,
  $$ values ('Ritika Das'::text, 1, 300000::bigint, 'held'::text, true), ('Yash Gupta', 2, 300000, 'held', true) $$,
  'Ritika, with more chips, first and Yash second: each wins a ₹3,000 ticket to the Turbo');
select results_eq($$ select p.place, p.full_name, p.prize_paise from public.tournament_payouts(pg_temp.named('Ticket Satellite')) p $$,
  $$ values (3, 'Mihir Shah'::text, 120000::bigint) $$, 'and Mihir is paid the ₹1,200 left, to his wallet');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Knockout'), pg_temp.named('Ticket Satellite')) $$, '22023',
  'Before anyone enters, a satellite for another tournament whose registration is open', 'a finished tournament is no target');
reset role;
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), -600000::bigint, 'the seats'' ₹6,000 are held as tickets');
select is(pg_temp.balance('venue.tournament_pool') - (select pool from before), -180000::bigint,
  'and the satellite''s pool pays out to nothing (Mihir''s other entry waits in its own)');

-- Who sees the tickets: a member their own, the floor all; a dealer and another venue's staff none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq($$ select status, value_paise from public.tournament_ticket $$, $$ values ('held'::text, 300000::bigint) $$,
  'Yash sees his own ticket only');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.tournament_ticket), 2, 'the floor sees both');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.tournament_ticket $$, 'a dealer sees none');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.tournament_ticket $$, 'nor does another venue''s admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is((select count(*)::integer from public.tournament_ticket), 2, 'an owner who reads the ledger sees both');

-- No ticket is used while tournament registration is switched off, the venue is frozen, or the member is.
reset role;
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'tournament_registration', 'Ticket kill');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                      '00000000-0000-4000-8000-00000000f421') $$, 'RVKIL', null,
  'no ticket is used with tournament registration switched off');
reset role;
select pg_temp.release('Ticket kill');
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Ticket freeze');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                      '00000000-0000-4000-8000-00000000f422') $$, 'RVFRZ', null, 'nor in a frozen venue');
reset role;
select pg_temp.release('Ticket freeze');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000214', 'Ticket member freeze');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                      '00000000-0000-4000-8000-00000000f423') $$, 'RVMBR', null, 'nor by a frozen member');
reset role;
select pg_temp.release('Ticket member freeze');

-- Yash enters the Turbo with his ticket from the app; Mihir, without one, cannot.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select lives_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                     '00000000-0000-4000-8000-00000000f411') $$, 'Yash enters the Turbo with his ticket');
select lives_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                     '00000000-0000-4000-8000-00000000f411') $$, 'the same request again');
select results_eq($$ select kind, paid_by, price_paise, fee_paise from public.tournament_purchase where tournament_id = pg_temp.named('Ticket Turbo') $$,
  $$ values ('entry'::text, 'ticket'::text, 300000::bigint, 30000::bigint) $$, 'one entry, paid with the ticket, its fee included');
select is(pg_temp.ticket_status('Ticket Turbo', '00000000-0000-4000-8000-000000000214'), 'used', 'Yash''s ticket is used');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                      '00000000-0000-4000-8000-00000000f412') $$, 'RVTRN', null, 'a ticket pays one entry');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000215',
                                                      '00000000-0000-4000-8000-00000000f413') $$, '42501', null, 'and never Ritika''s');
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'tournaments.register', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000216',
                                                      '00000000-0000-4000-8000-00000000f419') $$, '42501', null,
  'a member without tournament registration uses no ticket from the app');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000213',
                                                      '00000000-0000-4000-8000-00000000f414') $$, 'RVTRN', 'No ticket to this tournament',
  'Mihir has no ticket');
select public.register_tournament_entry(pg_temp.named('Ticket Turbo'), 'entry', '00000000-0000-4000-8000-00000000f415');

-- At the cage, the cashier enters Ritika with hers, taking no cash: the room is full, so she waits as an alternate.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000215',
                                                      '00000000-0000-4000-8000-00000000f416') $$, '42501', null, 'another venue''s staff use no ticket');
reset role;
create temporary table drawer_before on commit drop as select pg_temp.balance('venue.cash_drawer') as paise;
grant select on drawer_before to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), (select id from own), '00000000-0000-4000-8000-00000000f417') $$,
  'RVOWN', null, 'a cashier serves no ticket of her own member record');
select lives_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000215',
                                                     '00000000-0000-4000-8000-00000000f416') $$, 'the cashier enters Ritika with her ticket');
reset role;
select is((select status from public.tournament_entry where id = pg_temp.run('Ticket Turbo', '00000000-0000-4000-8000-000000000215')), 'alternate',
  'every seat is taken, so she waits as an alternate');
select is(pg_temp.balance('venue.cash_drawer'), (select paise from drawer_before), 'no cash went into the drawer');
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), 0::bigint, 'both tickets have paid their entries');

-- The floor refunds Ritika, who never sat: her ticket is hers again, and keeps her from being erased.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.refund_tournament_alternate(pg_temp.run('Ticket Turbo', '00000000-0000-4000-8000-000000000215')) $$,
  'the floor refunds an alternate who entered with a ticket');
reset role;
select is(pg_temp.ticket_status('Ticket Turbo', '00000000-0000-4000-8000-000000000215'), 'held', 'and her ticket is hers to use again');
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), -300000::bigint, 'its ₹3,000 back in the tickets held');
select ok('tournament' = any(private.member_erasure_blockers('00000000-0000-4000-8000-000000000215')),
  'a ticket held is settled before its member is erased');

-- The Turbo's registration closes with Ritika's ticket unused: it lapses, and the ₹3,000 goes to her wallet, once.
select private.lapse_tournament_tickets();
select is(pg_temp.ticket_status('Ticket Turbo', '00000000-0000-4000-8000-000000000215'), 'held', 'while registration is open, a ticket waits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.start_tournament_clock(pg_temp.named('Ticket Turbo'));
reset role;
update public.tournament set last_registration_level = 0 where id = pg_temp.named('Ticket Turbo');
select private.lapse_tournament_tickets();
select private.lapse_tournament_tickets();
select is(pg_temp.ticket_status('Ticket Turbo', '00000000-0000-4000-8000-000000000215'), 'refunded', 'once it closes, the ticket lapses');
select is(private.wallet_cash('00000000-0000-4000-8000-000000000215') - (select ritika from before), -100000::bigint,
  'Ritika paid ₹4,000 into the satellite and has ₹3,000 back');
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), 0::bigint, 'and no tickets are held');
select is((select count(*)::integer from public.ledger_transaction where kind = 'tournament_ticket_refund'
           and idempotency_key = 'tournament_ticket_refund:' || (select id from public.tournament_ticket where member_id = '00000000-0000-4000-8000-000000000215')),
  1, 'refunded once');
select is((select count(*)::integer from public.outbox_event where event_type = 'tournament.ticket_refunded'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000215' and (payload ->> 'value_paise')::bigint = 300000),
  1, 'and tournament.ticket_refunded goes out once, for Ritika to be told');
select ok(exists (select 1 from cron.job where jobname = 'tournament-ticket-lapse' and schedule = '* * * * *'), 'tickets lapse each minute');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.create_tournament('00000000-0000-4000-8000-0000000007c3', 'Late Satellite', now(), true);
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Late Satellite'), pg_temp.named('Ticket Turbo')) $$, '22023', null,
  'a tournament whose registration has closed is no target');

-- A guaranteed satellite (₹3,000 entries, ₹10,000 guaranteed) for a second Turbo: three runs put in ₹8,100, the
-- club adds ₹1,900, and ₹10,000 buys a seat for every run with ₹1,000 left, which goes to the last seat.
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Second Turbo', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Guaranteed Satellite', now(), true);
select public.set_tournament_satellite(pg_temp.named('Guaranteed Satellite'), pg_temp.named('Second Turbo'));
reset role;
update public.tournament set guarantee_paise = 1000000 where id = pg_temp.named('Guaranteed Satellite');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.start_tournament_clock(pg_temp.named('Guaranteed Satellite'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Guaranteed Satellite'), 'entry', '00000000-0000-4000-8000-00000000f501');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select public.register_tournament_entry(pg_temp.named('Guaranteed Satellite'), 'entry', '00000000-0000-4000-8000-00000000f502');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select public.register_tournament_entry(pg_temp.named('Guaranteed Satellite'), 'entry', '00000000-0000-4000-8000-00000000f503');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok(format($$ select public.finish_tournament(%L, null, %L) $$, pg_temp.named('Guaranteed Satellite'),
                       jsonb_build_object(pg_temp.run('Guaranteed Satellite', '00000000-0000-4000-8000-000000000214'), 20000,
                                          pg_temp.run('Guaranteed Satellite', '00000000-0000-4000-8000-000000000215'), 15000,
                                          pg_temp.run('Guaranteed Satellite', '00000000-0000-4000-8000-000000000213'), 10000)),
  'with a seat for each, the floor finishes it at once');
select results_eq($$ select m.full_name, e.place from public.tournament_ticket k join public.member m on m.id = k.member_id
                     join public.tournament_entry e on e.id = k.entry_id where k.satellite_id = pg_temp.named('Guaranteed Satellite') order by e.place $$,
  $$ values ('Yash Gupta'::text, 1), ('Ritika Das', 2), ('Mihir Shah', 3) $$, 'every run wins a ticket, placed by its chips');
select results_eq($$ select p.place, p.full_name, p.prize_paise from public.tournament_payouts(pg_temp.named('Guaranteed Satellite')) p $$,
  $$ values (3, 'Mihir Shah'::text, 100000::bigint) $$, 'and the last seat, Mihir, is paid the ₹1,000 left');
select is((select overlay_paise from public.tournament where id = pg_temp.named('Guaranteed Satellite')), 190000::bigint,
  'the club''s ₹1,900 overlay is booked');

-- A satellite too small for a seat: Mihir alone puts ₹1,800 in for a ₹3,000 seat, so he is paid it in cash. It
-- finishes with TDS switched on: a ticket carries no TDS (question #517, answered).
select public.create_tournament('00000000-0000-4000-8000-0000000007c3', 'Small Satellite', now(), true);
select public.set_tournament_satellite(pg_temp.named('Small Satellite'), pg_temp.named('Second Turbo'));
select public.start_tournament_clock(pg_temp.named('Small Satellite'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.register_tournament_entry(pg_temp.named('Small Satellite'), 'entry', '00000000-0000-4000-8000-00000000f504');
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'tds.config', '',
        '{"enabled": true, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
        now() - interval '2 minutes', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.finish_tournament(pg_temp.named('Small Satellite')) $$, 'a satellite finishes with TDS switched on');
select is_empty($$ select 1 from public.tournament_ticket where satellite_id = pg_temp.named('Small Satellite') $$, 'with no ticket');
select results_eq($$ select p.place, p.full_name, p.prize_paise from public.tournament_payouts(pg_temp.named('Small Satellite')) p $$,
  $$ values (1, 'Mihir Shah'::text, 180000::bigint) $$, 'and Mihir is paid the ₹1,800 in cash');

-- Mihir plays the second Turbo with his ticket and wins it. Yash's and Ritika's tickets lapse as it finishes;
-- Ritika's waits while she is frozen.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select public.use_tournament_ticket(pg_temp.named('Second Turbo'), '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-00000000f505');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.start_tournament_clock(pg_temp.named('Second Turbo'));
select public.set_tournament_payouts(pg_temp.named('Second Turbo'), array[10000]);
select public.finish_tournament(pg_temp.named('Second Turbo'));
reset role;
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000215', 'Under review');
-- Yash's refund fails, for now.
create function public.fail_yash_refund() returns trigger language plpgsql as $$
begin
  if new.member_id = '00000000-0000-4000-8000-000000000214' and new.status = 'refunded' then
    raise exception 'Refund failed';
  end if;
  return new;
end;
$$;
create trigger fail_yash_refund before update on public.tournament_ticket for each row execute function public.fail_yash_refund();
select lives_ok($$ select private.lapse_tournament_tickets() $$, 'a refund that fails stops the lapse of no other ticket');
select results_eq($$ select m.full_name, k.status from public.tournament_ticket k join public.member m on m.id = k.member_id
                     where k.target_id = pg_temp.named('Second Turbo') order by m.full_name $$,
  $$ values ('Mihir Shah'::text, 'used'::text), ('Ritika Das', 'held'), ('Yash Gupta', 'held') $$,
  'the finished Turbo''s unused tickets lapse, a frozen member''s waiting, and one whose refund failed held still');
update public.control_state
set released_at = now(), release_reason = 'Reviewed',
    released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001')
where member_id = '00000000-0000-4000-8000-000000000215' and released_at is null;
select private.lapse_tournament_tickets();
select is(pg_temp.ticket_status('Second Turbo', '00000000-0000-4000-8000-000000000215'), 'refunded', 'and hers once she is released');
select is(pg_temp.ticket_status('Second Turbo', '00000000-0000-4000-8000-000000000214'), 'held', 'while Yash''s refund still fails');
select results_eq($$ select detail ->> 'ticket_id' from public.alert where kind = 'tournaments.ticket_refund_failed' $$,
  $$ select id::text from public.tournament_ticket where member_id = '00000000-0000-4000-8000-000000000214'
     and target_id = pg_temp.named('Second Turbo') $$, 'one alert names the ticket, however often it fails');
drop trigger fail_yash_refund on public.tournament_ticket;
select private.lapse_tournament_tickets();
select is(pg_temp.ticket_status('Second Turbo', '00000000-0000-4000-8000-000000000214'), 'refunded', 'and it is refunded once it can be');
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), 0::bigint, 'no tickets are held');

select * from finish();
rollback;
