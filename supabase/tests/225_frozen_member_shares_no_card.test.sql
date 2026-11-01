-- A frozen member shares no winner card (audit of 28 Oct, A4-16).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.as_system() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_system() to authenticated;

-- A4-16: a member with a winner card, their tier given winner cards, then the member frozen.
create temporary table carded on commit drop as
select w.id as card_id, w.member_id from public.winner_card w join public.member m on m.id = w.member_id and m.erased_at is null limit 1;
grant select on carded to authenticated;
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, 'social.winner_cards', true, 'locked', now() - interval '1 second' from public.tier t;
insert into public.control_state (venue_id, level, member_id, reason)
select m.venue_id, 'member_freeze', m.id, 'C3 test' from public.member m where m.id = (select member_id from carded);
select pg_temp.as_person((select member_id::text from carded));
select throws_ok($$ select public.share_winner_card((select card_id from carded), true) $$, 'RVMBR', null,
  'a frozen member shares no winner card (A4-16)');
select lives_ok($$ select public.share_winner_card((select card_id from carded), false) $$,
  'but stops sharing one, their consent withdrawn');
select pg_temp.as_system();

select * from finish();
rollback;
