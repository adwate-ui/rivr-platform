-- A member's sign-up on their record (the owner, 8 Nov). Member 211 answered the sign-up questions and came by a creator's
-- campaign. Aditya (103, an admin) reads it all; a dealer (106) reads nothing; the club's member is not read as the
-- practice venue's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.member_preference (member_id, venue_id, city, occupation, play_times, games_played)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'Gurugram', 'salaried',
        '{weekday_evenings,weekends}', '{plo,poker}')
on conflict (member_id) do update
set city = excluded.city, occupation = excluded.occupation, play_times = excluded.play_times, games_played = excluded.games_played;
insert into public.sign_up_attribution (member_id, venue_id, creator_code, utm_source, utm_medium, utm_campaign, first_seen_at)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'ASHU', 'instagram', 'social', 'diwali',
        '2026-11-01 20:00+05:30');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select city, occupation, play_times, games_played, referral_code, creator_code, utm_source, utm_medium, utm_campaign, first_seen_at
     from public.member_sign_up('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  $$ values ('Gurugram'::text, 'salaried'::text, '{weekday_evenings,weekends}'::text[], '{plo,poker}'::text[], null::text, 'ASHU'::text,
             'instagram'::text, 'social'::text, 'diwali'::text, '2026-11-01 20:00+05:30'::timestamptz) $$,
  'an admin reads the member''s sign-up answers and how they came');
select is((select signed_up_at from public.member_sign_up('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211')),
  (select created_at from public.member where id = '00000000-0000-4000-8000-000000000211'), 'and the day they joined');
select is_empty($$ select 1 from public.member_sign_up('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211') $$,
  'not as a member of another venue');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.member_sign_up('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'a dealer, who reads no members, reads nothing');
reset role;

select * from finish();
rollback;
