-- A reward priced in hotel nights is for a tier with rewards.accommodation (audit 8 Nov, F-046). The seed's Partner hotel
-- suite costs one night. Mihir (213, Member tier) holds two nights; hotel nights start off for every tier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
select private.post_nights('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 2000, 'nights_earned', 'Test', 'test:373:mihir');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.reward_item where nights is not null), 0, 'the catalogue shows a tier without hotel nights none of them');
select cmp_ok((select count(*)::integer from public.reward_item where nights is null), '>', 0, 'and still shows the rewards priced in points');
select throws_ok($$ select public.redeem_reward('00000000-0000-4000-8000-000000145004', null, 'test-373', 1) $$, '42501', null,
  'and nor can he redeem one by its id');
reset role;

insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select venue_id, id, 'rewards.accommodation', true, 'locked', now() - interval '1 day' from public.tier where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.reward_item where id = '00000000-0000-4000-8000-000000145004'), 1, 'with hotel nights on for his tier, it shows');
select lives_ok($$ select public.redeem_reward('00000000-0000-4000-8000-000000145004', null, 'test-373', 1) $$, 'and he redeems it');

select * from finish();
rollback;
