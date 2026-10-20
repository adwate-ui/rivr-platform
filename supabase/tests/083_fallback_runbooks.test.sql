-- The fallback runbooks (#52): every venue's SOP library has app down, Wi-Fi down, power cut, UPI down and
-- KYC vendor down, each owned by the duty manager, with its paper form and the step that brings the
-- paper back into the system, for the staff each concerns to acknowledge; a venue made later gets them too.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f5', 'Later room', 'later-room', false, 'Later room', 'Somewhere', 'LTR');

create temp table runbooks on commit drop as
select v.slug, s.title, sv.owner, sv.ack_roles, sv.body, sv.version
from public.sop s join public.sop_version sv on sv.sop_id = s.id join public.venue v on v.id = s.venue_id
where s.title like 'Fallback: %';

select results_eq(
  $$ select slug, count(*)::integer from runbooks group by slug order by slug $$,
  $$ values ('gurugram', 5), ('later-room', 5), ('practice', 5) $$,
  'every venue has the five runbooks, a venue made later too');
select set_eq(
  $$ select distinct title from runbooks $$,
  $$ values ('Fallback: app down'), ('Fallback: KYC vendor down'), ('Fallback: power cut'), ('Fallback: UPI down'), ('Fallback: Wi-Fi down') $$,
  'app down, Wi-Fi down, power cut, UPI down and KYC vendor down');
select is_empty($$ select title from runbooks where owner <> 'Duty manager' or version <> 1 $$, 'each at version 1, owned by the duty manager');
select is_empty(
  $$ select title from runbooks where body not like '%sheet%' and body not like '%paper log%' $$,
  'each names the paper to write on');
select is_empty($$ select title from runbooks where body not like '%Back in the system:%' $$,
  'and the step that brings it back into the system');
select is_empty($$ select title from runbooks where title = 'Fallback: app down' and not 'cashier' = any (ack_roles) $$,
  'the cashiers, who keep the cage paper log, must acknowledge app down');
select ok((select bool_and(body like '%numbers run without a gap%') from runbooks where title = 'Fallback: app down'),
  'and the duty manager checks that no slip, so no buy-in, is lost');
select is((select bool_and(body like '%No cash-outs on paper%') from runbooks where title = 'Fallback: app down'), true,
  'and no cash-out is written on paper: chips stay with the player until the system is back');
select results_eq($$ select count(*)::integer from public.sop s join public.venue v on v.id = s.venue_id where v.slug = 'gurugram' $$,
  $$ values (10) $$, 'the club''s library holds the training set and the runbooks, once each');
create temp table club_versions on commit drop as
select sv.id from public.sop s join public.sop_version sv on sv.sop_id = s.id where s.venue_id = '00000000-0000-4000-8000-000000000001';
select private.add_training_sops('00000000-0000-4000-8000-000000000001');
select set_eq(
  $$ select sv.id from public.sop s join public.sop_version sv on sv.sop_id = s.id where s.venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ select id from club_versions $$, 'loading the set again into a venue that has it changes nothing');

select * from finish();
rollback;
