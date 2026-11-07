-- Bonus chips added by hand (the owner, 8 Nov). 101 Vikram, a super admin, adds 500 bonus chips to member 211 with a
-- reason: the member's balance rises by 500, the ledger stays balanced, and the audit log keeps it once, even when the
-- same request comes again. Odd amounts, no reason, an admin, and a super admin on their own member record are refused.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into ids values ('request', gen_random_uuid()), ('ira', '00000000-0000-4000-8000-000000000211');

create function pg_temp.bonus_of(p_member uuid) returns bigint language sql as $$
  select coalesce(sum(g.remaining_paise), 0)::bigint from public.bonus_grant g where g.member_id = p_member;
$$;
grant execute on function pg_temp.bonus_of(uuid) to authenticated;
create temp table before as select pg_temp.bonus_of('00000000-0000-4000-8000-000000000211') as paise;
grant select on before to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 500, 'Birthday at the club', (select id from ids where name = 'request')) $$,
  'a super admin adds 500 bonus chips with a reason');
select lives_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 500, 'Birthday at the club', (select id from ids where name = 'request')) $$,
  'the same request again is the same grant');
reset role;
select is(pg_temp.bonus_of('00000000-0000-4000-8000-000000000211') - (select paise from before), 50000::bigint,
  'the member has 500 bonus chips more, once');
select results_eq($$ select amount_paise, reason from public.bonus_grant where idempotency_key = 'bonus.hand:' || (select id from ids where name = 'request') $$,
  $$ values (50000::bigint, 'Birthday at the club'::text) $$, 'one grant, with its reason');
select results_eq($$ select a.reason, (a.after ->> 'chips')::integer, s.full_name from public.audit_log a
                     join public.staff s on s.user_id = a.actor_user_id and s.venue_id = a.venue_id
                     where a.action = 'bonus.give' and a.entity_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('Birthday at the club'::text, 500, 'Vikram Rao'::text) $$, 'the audit log keeps who, how many and why, once');
select results_eq($$ select count(*)::integer, sum(e.amount)::bigint from public.ledger_entry e join public.ledger_transaction t on t.id = e.transaction_id
                     where t.idempotency_key = 'bonus:bonus.hand:' || (select id from ids where name = 'request') $$,
  $$ values (2, 0::bigint) $$, 'the ledger holds its two lines, and they balance');

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 75, 'Birthday', gen_random_uuid()) $$,
  'RVCHP', null, 'not a whole fifty: refused');
select throws_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 0, 'Birthday', gen_random_uuid()) $$,
  'RVCHP', null, 'nothing: refused');
select throws_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 100050, 'Birthday', gen_random_uuid()) $$,
  'RVCHP', null, 'above 1,00,000: refused');
select lives_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 100000, 'A big night', gen_random_uuid()) $$,
  '1,00,000 itself is allowed, with no daily cap');
select throws_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 500, 'ok', gen_random_uuid()) $$,
  '22023', null, 'a reason of two characters: refused');

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.give_bonus_chips((select id from ids where name = 'ira'), 500, 'Birthday', gen_random_uuid()) $$,
  '42501', null, 'an admin adds no bonus chips');

-- Vikram signs up on his own login: his own record is refused.
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
insert into ids select 'vikram', public.sign_up('Vikram Rao', '{}');
select throws_ok($$ select public.give_bonus_chips((select id from ids where name = 'vikram'), 500, 'For me', gen_random_uuid()) $$,
  'RVOWN', null, 'never to his own member record');
reset role;

select * from finish();
rollback;
