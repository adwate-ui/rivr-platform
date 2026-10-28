-- Winner cards (#155; decision 0273): made by a tournament win, a high hand and a bad-beat jackpot; drawn nightly; seen by
-- their player, and by staff who publish marketing (636 Arjun) only while the player shares them. Kabir (202), Naina (203).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.cards(p_member uuid) returns table (kind text, prize_paise bigint, details jsonb) language sql as $$
  select kind, prize_paise, details from public.winner_card where member_id = p_member order by kind;
$$;

-- Kabir wins the Weeknight Turbo (a freeroll here: no prize paid); his high hand at Table 2, seat 5; a jackpot he lost and Naina won.
select private.emit('00000000-0000-4000-8000-000000000001', 'tournament.finished',
  jsonb_build_object('tournament_id', '00000000-0000-4000-8000-0000000007a2', 'winner_member_id', '00000000-0000-4000-8000-000000000202'), 'test:finished');

insert into public.visit (id, venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-0000000009b2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', now() - interval '2 hours');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-0000000009b2', t.id, 5, now() - interval '1 hour'
from public.game_table t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 2';
select private.emit('00000000-0000-4000-8000-000000000001', 'high_hand.approved',
  jsonb_build_object('claim_id', '00000000-0000-4000-8000-0000000009b3', 'table_id', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'),
                     'seat', 5, 'category', 'four_of_a_kind', 'rank', 'A', 'payout_paise', 1000000, 'played_at', now() - interval '30 minutes'), 'test:high-hand');

insert into public.jackpot_event (id, venue_id, kind, table_id, loser_member_id, winner_member_id, table_member_ids, pool_paise, loser_paise, winner_paise,
                                  each_at_table_paise, total_paise, rule, staff_id, idempotency_key)
select '00000000-0000-4000-8000-0000000009b4', '00000000-0000-4000-8000-000000000001', 'payout', t.id, '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203', '{}',
       10000000, 6000000, 3000000, 0, 9000000, '{}', (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000103' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
       'test-jackpot-1'
from public.game_table t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 2';
select private.emit('00000000-0000-4000-8000-000000000001', 'jackpot.paid', jsonb_build_object('event_id', '00000000-0000-4000-8000-0000000009b4'), 'test:jackpot');
select private.emit('00000000-0000-4000-8000-000000000001', 'jackpot.paid', jsonb_build_object('event_id', '00000000-0000-4000-8000-0000000009b4'), 'test:jackpot-again');

select results_eq($$ select * from pg_temp.cards('00000000-0000-4000-8000-000000000202') $$,
  $$ values ('high_hand'::text, 1000000::bigint, '{"category": "four_of_a_kind", "rank": "A", "table_name": "Table 2"}'::jsonb),
            ('jackpot', 6000000, '{}'), ('tournament', 0, '{"event_name": "Weeknight Turbo"}') $$,
  'a tournament win, the high hand in his seat and his jackpot share each make Kabir a card, once');
select results_eq($$ select * from pg_temp.cards('00000000-0000-4000-8000-000000000203') $$,
  $$ values ('jackpot'::text, 3000000::bigint, '{}'::jsonb) $$, 'and Naina one for her share of the jackpot');
select private.emit('00000000-0000-4000-8000-000000000002', 'tournament.finished',
  jsonb_build_object('tournament_id', '00000000-0000-4000-8000-0000000007a3', 'winner_member_id', '00000000-0000-4000-8000-000000000202'), 'test:practice');
select is((select count(*)::integer from public.winner_card where source_id = '00000000-0000-4000-8000-0000000007a3'), 0, 'never at the practice venue');

-- The nightly job draws each card once; an image no card names is removed.
reset role;
select is((select count(*)::integer from public.winner_cards_to_draw() where card_id in (select id from public.winner_card where member_id = '00000000-0000-4000-8000-000000000202')), 3,
  'Kabir''s three cards wait to be drawn');
select is((select player_name || ' / ' || venue_address from public.winner_cards_to_draw() where kind = 'tournament' and player_name like 'Kabir%'),
  'Kabir S. / ' || coalesce((select address from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'), ''), 'as Kabir S., at the club''s address');
select public.record_winner_card_image(id) from public.winner_card where member_id = '00000000-0000-4000-8000-000000000202';
select is_empty($$ select * from public.winner_cards_to_draw() where player_name like 'Kabir%' $$, 'drawn, they are not drawn again');
insert into storage.objects (bucket_id, name) values ('winner-cards', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000009ff.png');
insert into storage.objects (bucket_id, name) select 'winner-cards', image_path from public.winner_card where member_id = '00000000-0000-4000-8000-000000000202';
select results_eq($$ select name from public.winner_card_images_to_remove() $$, $$ values ('00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000009ff.png'::text) $$,
  'an image no card names is removed');

-- Kabir sees his cards and shares one; marketing sees it, and its image, only while he shares it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select kind, is_shared from public.my_winner_cards() order by kind $$,
  $$ values ('high_hand'::text, false), ('jackpot', false), ('tournament', false) $$, 'Kabir sees his three cards, none shared');
select is((select count(*)::integer from storage.objects where bucket_id = 'winner-cards'), 3, 'and their images');
select lives_ok($$ select public.share_winner_card((select card_id from public.my_winner_cards() where kind = 'tournament'), true) $$, 'he shares his tournament card');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select is_empty($$ select * from public.my_winner_cards() where kind <> 'jackpot' $$, 'Naina sees only her own');
select throws_ok($$ select public.share_winner_card((select id from public.winner_card where kind = 'tournament' and member_id = '00000000-0000-4000-8000-000000000202'), false) $$,
  '42501', null, 'and cannot stop Kabir sharing his');
select is((select count(*)::integer from storage.objects where bucket_id = 'winner-cards'), 0, 'nor see his images');
select pg_temp.as_person('00000000-0000-4000-8000-000000000636');
select results_eq($$ select player_name, kind, prize_paise from public.winner_cards_to_post('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Kabir S.'::text, 'tournament'::text, 0::bigint) $$, 'marketing sees the shared card only');
select is((select count(*)::integer from storage.objects where bucket_id = 'winner-cards'), 1, 'and its image only');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select public.share_winner_card((select card_id from public.my_winner_cards() where kind = 'tournament'), false);
select pg_temp.as_person('00000000-0000-4000-8000-000000000636');
select is_empty($$ select * from public.winner_cards_to_post('00000000-0000-4000-8000-000000000001') $$, 'once Kabir stops sharing, it is gone from marketing');
select is((select count(*)::integer from storage.objects where bucket_id = 'winner-cards'), 0, 'image and all');
select throws_ok($$ select * from public.winner_cards_to_draw() $$, '42501', null, 'staff do not draw cards');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select is_empty($$ select * from public.winner_cards_to_post('00000000-0000-4000-8000-000000000001') $$, 'nobody else who does not publish marketing sees any');
reset role;

-- A reversed high hand or jackpot takes its cards away.
select private.emit('00000000-0000-4000-8000-000000000001', 'high_hand.reversed', jsonb_build_object('claim_id', '00000000-0000-4000-8000-0000000009b3'), 'test:hh-reversed');
select private.emit('00000000-0000-4000-8000-000000000001', 'jackpot.reversed',
  jsonb_build_object('event_id', gen_random_uuid(), 'payout_event_id', '00000000-0000-4000-8000-0000000009b4'), 'test:jp-reversed');
select results_eq($$ select kind from public.winner_card where member_id in ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203') $$,
  $$ values ('tournament'::text) $$, 'a reversed high hand or jackpot takes its cards away');

select * from finish();
rollback;
