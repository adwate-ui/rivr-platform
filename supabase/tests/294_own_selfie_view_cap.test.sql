-- A member's views of their own KYC selfie are capped at ten a minute (#744; the security review of the card selfie,
-- decision 0300): each view writes an audit row and has the service role sign a URL. Views older than a minute do not
-- count, and staff views are not capped. Arjun (201) is verified with his selfie kept; 103 Aditya reviews KYC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table selfie as select '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg'::text as path;
grant select on selfie to authenticated;

insert into storage.objects (bucket_id, name) select 'kyc', path from selfie;
-- Ten views two minutes ago.
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id)
select '00000000-0000-4000-8000-000000000001', now() - interval '2 minutes', '00000000-0000-4000-8000-000000000201', 'kyc_image.view', 'kyc_image', path
from selfie, generate_series(1, 10);

select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select lives_ok($$ select public.authorize_kyc_image(path) from selfie, generate_series(1, 10) $$,
  'Arjun sees his own selfie ten times in a minute, whatever he viewed before it');
select throws_ok($$ select public.authorize_kyc_image(path) from selfie $$, 'RVRAT', null, 'and is refused an eleventh');
reset role;
select is((select count(*)::integer from public.audit_log a, selfie
           where a.entity_id = selfie.path and a.actor_user_id = '00000000-0000-4000-8000-000000000201' and a.occurred_at > now() - interval '1 minute'),
  10, 'so the audit log holds ten views of it in that minute, not one per call');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.authorize_kyc_image(path) from selfie, generate_series(1, 12) $$, 'a KYC reviewer is not capped');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select throws_ok($$ select public.authorize_kyc_image(path) from selfie $$, '42501', null, 'and another member is still refused it outright');
reset role;

select * from finish();
rollback;
