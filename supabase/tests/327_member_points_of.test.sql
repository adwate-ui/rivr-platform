-- A member's points on their record (the owner, 8 Nov). Vikram (101) gives member 211 300 points to spend and 200 locked;
-- a host (108), who reads members, reads both on the record; a dealer (106) reads nothing; nor does anyone as the
-- practice venue's.
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
create temp table before as select h.o_earned as earned, h.o_locked as locked from private.points_held('00000000-0000-4000-8000-000000000211') h;
grant select on before to authenticated;

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000211', 300, false, 'Birthday', gen_random_uuid()) $$, '300 points to spend');
select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000211', 200, true, 'Founders pack', gen_random_uuid()) $$, '200 locked');

select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select results_eq($$ select earned - (select earned from before), locked - (select locked from before)
                     from public.member_points_of('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  $$ values (300::bigint, 200::bigint) $$, 'a host reads the member''s points: 300 more to spend, 200 more locked');
select is_empty($$ select 1 from public.member_points_of('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211') $$,
  'not as a member of another venue');

select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.member_points_of('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'a dealer, who reads no members, reads no points');
reset role;

select * from finish();
rollback;
