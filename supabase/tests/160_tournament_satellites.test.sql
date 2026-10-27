-- Satellites (#117; decision 0250; question #489): a Rebuy Wednesday made a satellite for a Weeknight Turbo. Its
-- pool buys seats at the Turbo's buy-in; the seats' winners get tickets and the next finisher the cash left. A
-- ticket pays an entry from the app or at the cage, comes back when its alternate is refunded, and lapses to the
-- wallet once the Turbo's registration closes. 213 Mihir, 214 Yash and 215 Ritika are members with their
-- identity checks done; 103 Aditya an admin (tournaments.manage); 104 a cashier; Elsewhere's admin runs nothing
-- at the club.
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
create function pg_temp.ticket_status(p_member uuid) returns text language sql security definer as $$
  select status from public.tournament_ticket where member_id = p_member and target_id = pg_temp.named('Ticket Turbo');
$$;
grant execute on function pg_temp.named(text), pg_temp.run(text, uuid), pg_temp.balance(text), pg_temp.ticket_status(uuid) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');
select pg_temp.fund('00000000-0000-4000-8000-000000000213', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000214', 5000000);
select pg_temp.fund('00000000-0000-4000-8000-000000000215', 5000000);
create temporary table before on commit drop as
  select pg_temp.balance('venue.tournament_pool') as pool, pg_temp.balance('venue.tournament_tickets') as tickets,
         private.wallet_cash('00000000-0000-4000-8000-000000000215') as ritika;
grant select on before to authenticated;

-- The target: a Weeknight Turbo, ₹3,000 with a ₹300 fee, in a room of one table of two seats. The satellite: a
-- Rebuy Wednesday, ₹2,000 with a ₹200 fee.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.create_tournament('00000000-0000-4000-8000-0000000007c2', 'Ticket Turbo', now(), true);
select public.set_tournament_room(pg_temp.named('Ticket Turbo'), 1, 2);
select public.create_tournament('00000000-0000-4000-8000-0000000007c3', 'Ticket Satellite', now(), true);
select public.create_tournament('00000000-0000-4000-8000-0000000007c8', 'Ticket Knockout', now(), true);
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Turbo')) $$, '42501', null,
  'a member makes no satellite');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Turbo')) $$, '42501', null,
  'nor does another venue''s admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Satellite'), pg_temp.named('Ticket Satellite')) $$, '22023', null,
  'a satellite is never for itself');
select throws_ok($$ select public.set_tournament_satellite(pg_temp.named('Ticket Knockout'), pg_temp.named('Ticket Turbo')) $$, '22023', null,
  'a bounty tournament is no satellite');
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
select lives_ok($$ select public.finish_tournament(pg_temp.named('Ticket Satellite')) $$, 'two left for two seats: the floor finishes it');
select lives_ok($$ select public.finish_tournament(pg_temp.named('Ticket Satellite')) $$, 'the same finish again changes nothing');

select results_eq($$ select m.full_name, k.value_paise, k.status, k.target_id = pg_temp.named('Ticket Turbo')
                     from public.tournament_ticket k join public.member m on m.id = k.member_id
                     where k.satellite_id = pg_temp.named('Ticket Satellite') order by m.full_name $$,
  $$ values ('Ritika Das'::text, 300000::bigint, 'held'::text, true), ('Yash Gupta', 300000, 'held', true) $$,
  'Yash and Ritika each win a ₹3,000 ticket to the Turbo');
select results_eq($$ select p.place, p.full_name, p.prize_paise from public.tournament_payouts(pg_temp.named('Ticket Satellite')) p $$,
  $$ values (3, 'Mihir Shah'::text, 120000::bigint) $$, 'and Mihir is paid the ₹1,200 left, to his wallet');
reset role;
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), -600000::bigint, 'the seats'' ₹6,000 are held as tickets');
select is(pg_temp.balance('venue.tournament_pool') - (select pool from before), 0::bigint, 'and the satellite''s pool pays out to nothing');

-- Who sees the tickets: a member their own, the floor all, another venue's staff none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq($$ select status, value_paise from public.tournament_ticket $$, $$ values ('held'::text, 300000::bigint) $$,
  'Yash sees his own ticket only');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.tournament_ticket $$, 'another venue''s admin sees none');

-- Yash enters the Turbo with his ticket from the app; Mihir, without one, cannot.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select lives_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                     '00000000-0000-4000-8000-00000000f411') $$, 'Yash enters the Turbo with his ticket');
select lives_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                     '00000000-0000-4000-8000-00000000f411') $$, 'the same request again');
select results_eq($$ select kind, paid_by, price_paise, fee_paise from public.tournament_purchase where tournament_id = pg_temp.named('Ticket Turbo') $$,
  $$ values ('entry'::text, 'ticket'::text, 300000::bigint, 30000::bigint) $$, 'one entry, paid with the ticket, its fee included');
select is(pg_temp.ticket_status('00000000-0000-4000-8000-000000000214'), 'used', 'Yash''s ticket is used');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000214',
                                                      '00000000-0000-4000-8000-00000000f412') $$, 'RVTRN', null, 'a ticket pays one entry');
select throws_ok($$ select public.use_tournament_ticket(pg_temp.named('Ticket Turbo'), '00000000-0000-4000-8000-000000000215',
                                                      '00000000-0000-4000-8000-00000000f413') $$, '42501', null, 'and never Ritika''s');
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
select is(pg_temp.ticket_status('00000000-0000-4000-8000-000000000215'), 'held', 'and her ticket is hers to use again');
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), -300000::bigint, 'its ₹3,000 back in the tickets held');
select ok('tournament' = any(private.member_erasure_blockers('00000000-0000-4000-8000-000000000215')),
  'a ticket held is settled before its member is erased');

-- The Turbo's registration closes with Ritika's ticket unused: it lapses, and the ₹3,000 goes to her wallet, once.
select private.lapse_tournament_tickets();
select is(pg_temp.ticket_status('00000000-0000-4000-8000-000000000215'), 'held', 'while registration is open, a ticket waits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.start_tournament_clock(pg_temp.named('Ticket Turbo'));
reset role;
update public.tournament set last_registration_level = 0 where id = pg_temp.named('Ticket Turbo');
select private.lapse_tournament_tickets();
select private.lapse_tournament_tickets();
select is(pg_temp.ticket_status('00000000-0000-4000-8000-000000000215'), 'refunded', 'once it closes, the ticket lapses');
select is(private.wallet_cash('00000000-0000-4000-8000-000000000215') - (select ritika from before), -100000::bigint,
  'Ritika paid ₹4,000 into the satellite and has ₹3,000 back');
select is(pg_temp.balance('venue.tournament_tickets') - (select tickets from before), 0::bigint, 'and no tickets are held');
select is((select count(*)::integer from public.ledger_transaction where kind = 'tournament_ticket_refund'
           and idempotency_key = 'tournament_ticket_refund:' || (select id from public.tournament_ticket where member_id = '00000000-0000-4000-8000-000000000215')),
  1, 'refunded once');
select ok(exists (select 1 from cron.job where jobname = 'tournament-ticket-lapse' and schedule = '* * * * *'), 'tickets lapse each minute');

select * from finish();
rollback;
