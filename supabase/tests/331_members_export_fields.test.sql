-- Every member field in the Members export (the owner, 9 Nov). Ishaan (211) answered sign-up, came by a friend's code
-- and a campaign, and finished his identity check. Aditya (103, an admin) reads his answers, how he came and how he was
-- checked; only Vikram (101, a super admin) also reads his identity documents.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.member_preference (member_id, venue_id, city, occupation, play_times, games_played)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'Gurugram', 'salaried', '{weekends}', '{plo,bomb}')
on conflict (member_id) do update set city = excluded.city, occupation = excluded.occupation, play_times = excluded.play_times,
  games_played = excluded.games_played;
insert into public.sign_up_attribution (member_id, venue_id, referral_code, creator_code, utm_source, utm_campaign, first_seen_at)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'K7M2PQ9X', 'GURU', 'instagram', 'launch',
        '2026-11-01 18:00+05:30')
on conflict (member_id) do update set referral_code = excluded.referral_code, creator_code = excluded.creator_code,
  utm_source = excluded.utm_source, utm_campaign = excluded.utm_campaign, first_seen_at = excluded.first_seen_at;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, masked_aadhaar, aadhaar_name, address, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'verified', 'digilocker', '1990-04-12', 'ABCPV1234K',
        'XXXX XXXX 4321', 'Ishaan Verma', 'Sector 29, Gurugram',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg', '2026-11-02 20:00+05:30')
on conflict (member_id) do update set status = excluded.status, method = excluded.method, date_of_birth = excluded.date_of_birth,
  pan = excluded.pan, masked_aadhaar = excluded.masked_aadhaar, aadhaar_name = excluded.aadhaar_name, address = excluded.address,
  photo_path = excluded.photo_path, verified_at = excluded.verified_at;

create function pg_temp.answers() returns text language sql as $$
  select concat_ws('|', l.occupation, array_to_string(l.play_times, ','), array_to_string(l.games_played, ','), l.referral_code, l.creator_code,
                   l.utm_source, l.utm_campaign, l.first_seen_at is not null, l.kyc_method, l.kyc_verified_at is not null, l.own_referral_code is not null)
  from public.members_of_tier('00000000-0000-4000-8000-000000000001') l where l.member_id = '00000000-0000-4000-8000-000000000211';
$$;
create function pg_temp.documents() returns text language sql as $$
  select concat_ws('|', l.date_of_birth, l.pan, l.masked_aadhaar, l.aadhaar_name, l.address)
  from public.members_of_tier('00000000-0000-4000-8000-000000000001') l where l.member_id = '00000000-0000-4000-8000-000000000211';
$$;
grant execute on function pg_temp.answers(), pg_temp.documents() to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.answers(), 'salaried|weekends|plo,bomb|K7M2PQ9X|GURU|instagram|launch|t|digilocker|t|t',
  'an admin reads his answers, how he came and how he was checked');
select is(pg_temp.documents(), '', 'but none of his identity documents');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(pg_temp.answers(), 'salaried|weekends|plo,bomb|K7M2PQ9X|GURU|instagram|launch|t|digilocker|t|t', 'a super admin reads the same');
select is(pg_temp.documents(), '1990-04-12|ABCPV1234K|XXXX XXXX 4321|Ishaan Verma|Sector 29, Gurugram',
  'and his date of birth, PAN, Aadhaar''s last digits, the name on it and his address');
reset role;

-- A check only begun names no method; an erased member's documents, kept for TDS alone, are never exported.
update public.kyc_record set status = 'started', verified_at = null where member_id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select kyc_method from public.members_of_tier('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000211'),
  null, 'a check only begun names no method');
reset role;
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000211';
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member', qualifying_small_blind = null,
  qualifying_big_blind = null, known_as = null
where id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(pg_temp.documents(), '', 'an erased member''s documents are never exported');
reset role;

select * from finish();
rollback;
