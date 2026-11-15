-- The Google review link is removed (redesign RD-18): no setting, and a third visit asks for no review. The table of
-- requests made before stays until #954, read as it was: by staff who read members, never by a member. 103 is an admin,
-- 214 a member with two visits behind him.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select is_empty($$ select 1 from public.setting_key where key = 'reviews.google_url' $$, 'no setting holds a Google review link');
select is_empty($$ select 1 from public.setting where key = 'reviews.google_url' $$, 'and no venue has one set');
select hasnt_trigger('public', 'visit', 'visit_review_request', 'a visit that closes asks for no review');
select hasnt_function('private', 'request_review', 'and the rule that asked is gone');

-- A third visit closes, with a link's worth of consent, and nothing is asked.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - d.ago, now() - d.ago + interval '4 hours', 'door'
from (values (interval '20 days'), (interval '10 days'), (interval '5 hours')) as d (ago);
select is((select count(*)::integer from public.review_request where member_id = '00000000-0000-4000-8000-000000000214'), 0,
  'three visits closed, and no review is asked');

-- A request made before the removal is read as before.
insert into public.review_request (venue_id, member_id, visit_id)
select venue_id, member_id, id from public.visit where member_id = '00000000-0000-4000-8000-000000000214' order by opened_at desc limit 1;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.review_request), 1, 'staff who read members see the request');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is((select count(*)::integer from public.review_request), 0, 'a member reads none');
reset role;

select * from finish();
rollback;
