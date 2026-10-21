-- The hundred more members of the seed (15_players_more.sql): their spread of logins, tiers, identity
-- checks and balances, and nothing of theirs that the flows count (visits, lists, breaks, credit, consent,
-- attribution, withdrawal accounts waiting for the cage).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary view more_member as
select m.* from public.member m
where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.phone between '+919000000400' and '+919000000499';

select is((select count(*) from more_member), 100::bigint, 'a hundred more members at the club');
select is((select count(*) from more_member where user_id is not null), 80::bigint, 'eighty with the app, twenty walk-ins with no login');

select results_eq(
  $$ select t.name, count(*) from more_member m join public.tier t on t.id = m.tier_id group by t.name order by t.name $$,
  $$ values ('Academy graduate'::text, 12::bigint), ('Black card', 8), ('Founders'' Circle', 10), ('Member', 70) $$,
  'in every tier');
select is((select count(*) from more_member m join public.tier t on t.id = m.tier_id
           where t.name = 'Black card' and m.qualifying_big_blind is not null), 8::bigint, 'each black card qualifying at a stake');

select results_eq(
  $$ select coalesce(k.status, 'none'), coalesce(k.method, ''), count(*) from more_member m
     left join public.kyc_record k on k.member_id = m.id group by 1, 2 order by 1, 2 $$,
  $$ values ('needs_pan'::text, 'digilocker'::text, 10::bigint), ('none', '', 26), ('started', 'digilocker', 10),
            ('verified', 'digilocker', 30), ('verified', 'manual', 14), ('verified', 'pan', 10) $$,
  'with identity checks not started, under way, and done each way');

select results_eq(
  $$ select split_part(t.idempotency_key, ':', 4), count(*) from public.ledger_transaction t
     where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.idempotency_key like 'seed:more:%' group by 1 order by 1 $$,
  $$ values ('bonus'::text, 6::bigint), ('cash', 30), ('points', 39) $$,
  'wallet cash, points and bonuses, each a ledger transaction of its own');
select is((select count(*) from public.bonus_grant g join more_member m on m.id = g.member_id), 6::bigint, 'each bonus a grant');
select results_eq(
  $$ select a.code, sum(e.amount)::bigint from public.ledger_entry e
     join public.ledger_account a on a.id = e.account_id
     join more_member m on m.id = a.member_id
     where a.code in ('member.bonus', 'member.cash', 'member.points') group by a.code order by a.code $$,
  $$ values ('member.bonus'::text, -1400000::bigint), ('member.cash', -124500000), ('member.points', -553590) $$,
  'credited to the members: ₹14,000 of bonus, ₹12,45,000 of cash and 553,590 points');

select results_eq(
  $$ select a.kind, a.status, count(*) from public.payout_account a join more_member m on m.id = a.member_id group by 1, 2 order by 1, 2 $$,
  $$ values ('bank'::text, 'verified'::text, 3::bigint), ('upi', 'rejected', 2), ('upi', 'verified', 8) $$,
  'withdrawal accounts verified and refused, none waiting for the cage');

select is((select count(distinct full_name) from more_member), 100::bigint, 'every name its own');
select is((select count(*) from public.member m join more_member n on n.full_name = m.full_name and n.id <> m.id), 0::bigint,
  'and no name shared with another member');

select is((select count(*) from public.visit v join more_member m on m.id = v.member_id)
        + (select count(*) from public.waitlist_entry w join more_member m on m.id = w.member_id)
        + (select count(*) from public.self_exclusion x join more_member m on m.id = x.member_id)
        + (select count(*) from public.credit_line c join more_member m on m.id = c.member_id)
        + (select count(*) from public.consent c join more_member m on m.id = c.member_id)
        + (select count(*) from public.sign_up_attribution s join more_member m on m.id = s.member_id), 0::bigint,
  'no visit, list entry, break, credit line, consent or attribution of theirs');

select * from finish();
rollback;
