-- Buy-in promotions (#88; design prompt flow 3). The seed runs the design prompt's three promotions,
-- among them Buy-in bonus Tuesday: 20% of each of the first five buy-ins at a table that club day, as
-- bonus, given at the cage's buy-in itself. 211 Ishaan sits at Table 3 with ₹2,00,000 of wallet cash;
-- 212 Vihaan at Table 5. 103 Aditya is the floor; 104 Sana a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A buy-in at the club's cage, by the cashier signed in.
create function pg_temp.buy_in(p_member text, p_amount bigint, p_method text, p_key uuid default gen_random_uuid()) returns uuid language sql as $$
  select public.cage_buy_in('00000000-0000-4000-8000-000000000001', p_member::uuid, p_amount, p_method, p_key);
$$;
grant execute on function pg_temp.buy_in(text, bigint, text, uuid) to authenticated;
-- The member's Tuesday bonuses, in paise, in the order given.
create function pg_temp.bonuses(p_member text) returns text language sql as $$
  select coalesce(string_agg(g.amount_paise::text, ' ' order by g.created_at, g.id), 'none') from public.bonus_grant g
  where g.member_id = p_member::uuid and g.reason = 'Buy-in bonus Tuesday';
$$;

-- The seed: Buy-in bonus Tuesday, high hands and referral live, in both venues.
select results_eq($$ select venue_id::text, template_key from public.promotion where status = 'live' order by 1, 2 $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::text, 'high_hands'::text), ('00000000-0000-4000-8000-000000000001', 'referral'),
            ('00000000-0000-4000-8000-000000000001', 'tuesday_bonus'), ('00000000-0000-4000-8000-000000000002', 'high_hands'),
            ('00000000-0000-4000-8000-000000000002', 'referral'), ('00000000-0000-4000-8000-000000000002', 'tuesday_bonus') $$,
  'the seed runs the design prompt''s three promotions in both venues');

-- Ishaan's wallet holds ₹2,00,000; he sits at Table 3 and Vihaan at Table 5.
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-tuesday-deposit',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001'
                                                      and code = 'venue.bank' and member_id is null), 'amount', '20000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000211'
                                                      and code = 'member.cash'), 'amount', '-20000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211');
select public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'), 1, '9000000212');
reset role;

-- Flow 3: a ₹10,000 buy-in from the wallet, the first at Table 3 today, credits ₹2,000 of bonus.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select pg_temp.buy_in('00000000-0000-4000-8000-000000000211', 1000000, 'wallet', '00000000-0000-4000-8000-0000000c8801');
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000211'), '200000', 'a ₹10,000 buy-in, the first at Table 3 today, credits ₹2,000 of bonus');
select ok((select expires_at between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days'
           from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000211' and reason = 'Buy-in bonus Tuesday'),
  'for a week');
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000211', now()), 200000::bigint, 'and it is in force at once');
select is((select count(*)::integer from public.outbox_event where event_type = 'promotion.granted'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000211'), 1, 'announced by promotion.granted');

-- A retried tap is one buy-in, so one bonus.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select pg_temp.buy_in('00000000-0000-4000-8000-000000000211', 1000000, 'wallet', '00000000-0000-4000-8000-0000000c8801');
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000211'), '200000', 'a retried buy-in gives no second bonus');

-- The second to the fifth at Table 3 each earn theirs; the sixth earns none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select pg_temp.buy_in('00000000-0000-4000-8000-000000000211', 1000000, 'wallet') from generate_series(2, 5);
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000211'), '200000 200000 200000 200000 200000', 'the first five at Table 3 each earn ₹2,000');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select pg_temp.buy_in('00000000-0000-4000-8000-000000000211', 2000000, 'cash');
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000211'), '200000 200000 200000 200000 200000', 'the sixth earns none');
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000211', now()), 1000000::bigint, 'Ishaan holds ₹10,000 of bonus');

-- Another table counts on its own; a buy-in paid from bonus earns none (question #392).
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 1000000, 'Referral',
  now() + interval '1 day', 'test:tuesday:vihaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select pg_temp.buy_in('00000000-0000-4000-8000-000000000212', 1000000, 'bonus');
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000212'), 'none', 'a buy-in paid from bonus earns no bonus');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select pg_temp.buy_in('00000000-0000-4000-8000-000000000212', 1500000, 'cash');
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000212'), '300000', 'and the first paid in cash at Table 5 earns 20%: ₹3,000');

-- Promotions switched off: the buy-in goes on, and nothing is given.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(pg_temp.buy_in('00000000-0000-4000-8000-000000000212', 1000000, 'cash'), null, 'with promotions switched off, the buy-in goes on');
reset role;
select is(pg_temp.bonuses('00000000-0000-4000-8000-000000000212'), '300000', 'and earns nothing');

select * from finish();
rollback;
