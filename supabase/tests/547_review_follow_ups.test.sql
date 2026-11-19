-- Follow-ups from the reviews of the redesign and the Bonus approvals: member search takes `%` and `_` as typed and no
-- text longer than 100 characters; no one inserts a member row through the API; a staff member's own record by name
-- ignores spacing; no computer is enrolled as the cage agent; a new venue has no high hand expense account.
-- 101 Vikram Rao (super admin).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002f1', '00000000-0000-4000-8000-000000000001', 'Vikram  Rao', '+919000077291'),
  ('00000000-0000-4000-8000-0000000002f2', '00000000-0000-4000-8000-000000000001', 'Rhea 50%_Off', '+919000077292'),
  ('00000000-0000-4000-8000-0000000002f3', '00000000-0000-4000-8000-000000000001', chr(9) || 'Vikram Rao', '+919000077295'),
  ('00000000-0000-4000-8000-0000000002f4', '00000000-0000-4000-8000-000000000001', 'Vikram' || chr(160) || 'Rao ', '+919000077296');
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f7', 'Elsewhere', 'elsewhere-f7', false, 'Elsewhere Ltd', 'Somewhere', 'ELF');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';

-- Member search.
select is_empty($$ select * from public.member_search('00000000-0000-4000-8000-000000000001', '%%') $$,
  'two percent signs find no one: they are not wildcards');
select is_empty($$ select * from public.member_search('00000000-0000-4000-8000-000000000001', '__') $$,
  'two underscores find no one');
select results_eq($$ select full_name from public.member_search('00000000-0000-4000-8000-000000000001', '50%_') $$,
  $$ values ('Rhea 50%_Off'::text) $$, 'a name holding them is found by them');
select results_eq($$ select full_name from public.member_search('00000000-0000-4000-8000-000000000001', 'rhea 50') $$,
  $$ values ('Rhea 50%_Off'::text) $$, 'a name is still found by part of it');
select is_empty($$ select * from public.member_search('00000000-0000-4000-8000-000000000001', 'rhea' || repeat(' ', 100)) $$,
  'a text longer than 100 characters finds no one');

-- No member row through the API.
select throws_ok($$ insert into public.member (venue_id, full_name, phone)
                    values ('00000000-0000-4000-8000-000000000001', 'Made By Hand', '+919000077293') $$,
  '42501', null, 'staff who manage members cannot insert a member row');

-- No computer as the cage agent.
select throws_ok($$ select * from public.add_computer('00000000-0000-4000-8000-000000000001', 'agent', 'Agent') $$,
  '22023', null, 'a computer is no longer enrolled as the cage agent');

reset role;

-- Own record by name, whatever the spacing (asked as Vikram, through the function the RVOWN checks use).
select ok(private.is_own_kyc_check('00000000-0000-4000-8000-0000000002f1'),
  'a member named "Vikram  Rao", two spaces, is Vikram Rao''s own record');
select ok(private.is_own_kyc_check('00000000-0000-4000-8000-0000000002f3'), 'nor does a tab before the name hide it');
select ok(private.is_own_kyc_check('00000000-0000-4000-8000-0000000002f4'), 'nor a no-break space in it');
select ok(not coalesce(private.is_own_kyc_check('00000000-0000-4000-8000-0000000002f2'), false), 'another member is not');

select throws_ok($$ insert into public.device (venue_id, kind, name, token_hash)
                    values ('00000000-0000-4000-8000-000000000001', 'agent', 'Agent', 'hash') $$,
  '23514', null, 'an agent holds no token');

-- A new venue's accounts (the venue made before anyone signs in, as the club's own are).
select is_empty($$ select 1 from public.ledger_account where venue_id = '00000000-0000-4000-8000-0000000000f7' and code = 'venue.high_hand_expense' $$,
  'a new venue has no high hand expense account');
select isnt_empty($$ select 1 from public.ledger_account where venue_id = '00000000-0000-4000-8000-0000000000f7' and code = 'venue.bonus_expense' $$,
  'and keeps the Bonus expense account');

select * from finish();
rollback;
