-- The minimum age (#203): 18 unless the venue's kyc.minimum_age setting raises it, never lower.
-- 201 Arjun and 202 Kabir (members of the club, venue ...0001); the practice venue is ...0002.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Arjun's seeded identity check (#21) is set aside: this test takes him through the check from the start.
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201';

-- A verified check for a member born `p_years` years ago today, as the kyc Edge Function would leave it.
create function pg_temp.verified(p_member uuid, p_years integer) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, photo_path, verified_at)
  select m.venue_id, m.id, 'verified', 'digilocker',
         ((now() at time zone 'Asia/Kolkata')::date - make_interval(years => p_years))::date,
         m.venue_id::text || '/' || m.id::text || '/selfie.jpg', now()
  from public.member m where m.id = p_member;
$$;

select is(private.kyc_minimum_age('00000000-0000-4000-8000-000000000001'), 18, 'the minimum age is 18 without a setting');
select pg_temp.verified('00000000-0000-4000-8000-000000000201', 20);
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'so a verified 20-year-old may play');

insert into public.setting (venue_id, key, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'kyc.minimum_age', '{"years": 21}', now() - interval '1 day', 'Club rule');
select is(private.kyc_minimum_age('00000000-0000-4000-8000-000000000001'), 21, 'the venue can raise it to 21');
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000201'), 'and then a 20-year-old may not play');
select pg_temp.verified('00000000-0000-4000-8000-000000000202', 21);
select ok(private.is_kyc_complete('00000000-0000-4000-8000-000000000202'), 'while a member who turned 21 today may');
select is(private.kyc_refusal('00000000-0000-4000-8000-000000000202'), null, 'and is not refused');
-- A day short of 21.
update public.kyc_record
set date_of_birth = ((now() at time zone 'Asia/Kolkata')::date - interval '21 years' + interval '1 day')::date
where member_id = '00000000-0000-4000-8000-000000000202';
select ok(not private.is_kyc_complete('00000000-0000-4000-8000-000000000202'), 'a member a day short of 21 may not play');
select is(private.kyc_refusal('00000000-0000-4000-8000-000000000202'), 'under_18', 'and is refused');
select is(private.kyc_minimum_age('00000000-0000-4000-8000-000000000002'), 18, 'another venue keeps its own minimum');

-- The gate refuses a new check under the venue's minimum.
update public.kyc_record set status = 'started', verified_at = null where member_id = '00000000-0000-4000-8000-000000000201';
select is(private.kyc_refusal('00000000-0000-4000-8000-000000000201'), 'under_18', 'a check under the venue''s minimum is refused');

-- A raise dated in the future applies from then, not now.
insert into public.setting (venue_id, key, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000002', 'kyc.minimum_age', '{"years": 25}', now() + interval '1 day', 'Next month');
select is(private.kyc_minimum_age('00000000-0000-4000-8000-000000000002'), 18, 'a raise from tomorrow does not apply today');

-- 21.0 is accepted as an integer and must read as 21, never stop the gate.
insert into public.setting (venue_id, key, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'kyc.minimum_age', '{"years": 21.0}', now(), 'Written with a decimal point');
select is(private.kyc_minimum_age('00000000-0000-4000-8000-000000000001'), 21, '21.0 reads as 21');

-- Never below 18.
select throws_ok(
  $$ insert into public.setting (venue_id, key, value, effective_from, reason)
     values ('00000000-0000-4000-8000-000000000002', 'kyc.minimum_age', '{"years": 17}', now(), 'Too low') $$,
  '23514', null, 'a setting below 18 is refused'
);

select * from finish();
rollback;
