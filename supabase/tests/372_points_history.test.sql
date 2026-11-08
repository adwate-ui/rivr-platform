-- A member's points history (audit 8 Nov, F-054). Mihir (213, Member tier) earns from a visit and a promotion, is given
-- points by hand and locked, has some released, redeems a cap and has it cancelled. 101 Vikram (super admin) gives by
-- hand; 108 the host desk cancels. Reasons here start with "Test" or come from them, past what the seed gave him.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 5000, 'Test visit', 'test:372:visit');
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 800, 'Test double points', 'test:372:promotion');
insert into public.reward_item (venue_id, kind, name, detail, points, stock)
values ('00000000-0000-4000-8000-000000000001', 'merchandise', 'Test cap', 'At the desk', 1000, 2);
insert into ids select 'item', id from public.reward_item where name = 'Test cap';

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000213', 300, false, 'Test by hand', gen_random_uuid()), null, 'points given by hand');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000213', 700, true, 'Test locked', gen_random_uuid()), null, 'points given locked');
select lives_ok($$ select public.unlock_points('00000000-0000-4000-8000-000000000213', 200, 'Test released', gen_random_uuid()) $$, 'some released');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'redemption', public.redeem_reward((select id from ids where name = 'item'), 1000, 'test-372');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.cancel_redemption((select id from ids where name = 'redemption'), 'Test out of caps') $$, 'the desk cancels it');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select kind, points, reason from public.my_points_history(50) where reason like '%Test%' or reason like 'Redeemed: Test%' order by kind, points $$,
  $$ values ('earned'::text, 300::bigint, 'Test by hand'::text), ('earned', 800, 'Test double points'), ('earned', 5000, 'Test visit'),
            ('locked', 700, 'Test locked'), ('released', 200, 'Test released'),
            ('returned', 1000, 'Redemption cancelled: Test out of caps'), ('spent', 1000, 'Redeemed: Test cap') $$,
  'each earn, spend and change is one line, with what it was for');
select is((select count(*)::integer from public.my_points_history(1)), 1, 'as many lines as he asks for');
select is((select array_agg(parameter_name::text) from information_schema.parameters p
           join information_schema.routines r on r.specific_name = p.specific_name
           where r.routine_schema = 'public' and r.routine_name = 'my_points_history' and p.parameter_mode = 'OUT'),
  array['line_id', 'at', 'kind', 'points', 'reason'], 'who posted a line is not shown to members');

-- Newest first: two lines written with their own times, the older first.
reset role;
create function pg_temp.dated_line(p_memo text, p_at timestamptz) returns void language plpgsql as $$
declare
  v_transaction uuid;
begin
  insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at, memo)
  values ('00000000-0000-4000-8000-000000000001', 'points_earned', 'test:372:' || p_memo, p_at, p_memo) returning id into v_transaction;
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', v_transaction, a.id, case when a.code = 'member.points' then -10 else 10 end
  from public.ledger_account a
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and ((a.member_id = '00000000-0000-4000-8000-000000000213' and a.code = 'member.points') or (a.member_id is null and a.code = 'venue.points_issued'));
end;
$$;
select pg_temp.dated_line('Test older', now() - interval '2 hours');
select pg_temp.dated_line('Test newer', now() - interval '1 hour');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select reason from public.my_points_history(50) where reason in ('Test older', 'Test newer') $$,
  $$ values ('Test newer'::text), ('Test older') $$, 'the newest line comes first');

-- Another member sees none of his lines.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select 1 from public.my_points_history(50) where reason like '%Test%' $$, 'another member sees none of his');

-- A staff member who is no member has no history, and cannot read the private read.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select 1 from public.my_points_history(50) $$, 'someone who is no member has none');
select throws_ok($$ select * from private.points_history('00000000-0000-4000-8000-000000000213', 5) $$, '42501', null, 'and nobody signed in reads a member''s lines directly');
reset role;

-- Off for his tier: no lines, though his balance stays his.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
select venue_id, id, 'rewards.points_history', false, now() from public.tier where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.my_points_history(50) $$, 'with rewards.points_history off there are no lines');

select * from finish();
rollback;
