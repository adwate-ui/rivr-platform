-- The club's numbers for calls and WhatsApp (the owner, 12 Nov; decision 0582; #917): in the club's details, set by a super
-- admin (venue.configure) and no one else, read by anyone through public_club_contact, the club's and never the practice
-- venue's. 101 Vikram is a super admin, 103 Aditya an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.last_change() returns jsonb language sql security definer as $$
  select a.detail -> 'fields' from public.alert a where a.venue_id = '00000000-0000-4000-8000-000000000001'
    and a.kind = 'venue.config_changed' order by a.raised_at desc, a.id desc limit 1;
$$;
grant execute on function pg_temp.last_change() to authenticated;

-- The number in use until now, filled in for the club only.
select results_eq($$ select contact_phone, contact_whatsapp from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('+918796580435'::text, '+918796580435'::text) $$, 'the club starts with the number it had in code');
select results_eq($$ select contact_phone, contact_whatsapp from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  $$ values (null::text, null::text) $$, 'the practice venue has none');

-- Anyone reads the club's two numbers, and nothing else.
set local role anon;
select results_eq($$ select venue_slug, phone, whatsapp from public.public_club_contact $$,
  $$ values ('gurugram'::text, '+918796580435'::text, '+918796580435'::text) $$, 'a visitor, not signed in, reads the club''s numbers alone');
select throws_ok($$ select contact_phone from public.venue_config $$, '42501', null, 'and nothing of the club''s details directly');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.public_club_contact), 1, 'a member reads the same one row');
reset role;

-- A super admin changes them, which alerts the owner; an admin cannot.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
update public.venue_config set contact_phone = '+911244000000' where venue_id = '00000000-0000-4000-8000-000000000001';
reset role;
select is((select contact_phone from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'), '+918796580435',
  'an admin who does not configure the venue changes nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ update public.venue_config set contact_phone = '+911244000000', contact_whatsapp = '+919811100022'
                   where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'a super admin sets a landline to call and a mobile to WhatsApp');
select is(pg_temp.last_change(), '["contact_phone", "contact_whatsapp"]'::jsonb, 'and the owner hears that both changed');
select throws_ok($$ update public.venue_config set contact_whatsapp = '+911244000000' where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'WhatsApp takes a mobile number only');
select throws_ok($$ update public.venue_config set contact_phone = '8796580435' where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'and each is +91 and ten digits');
reset role;
set local role anon;
select results_eq($$ select phone, whatsapp from public.public_club_contact $$,
  $$ values ('+911244000000'::text, '+919811100022'::text) $$, 'the website and the app read the change at once');
reset role;

select * from finish();
rollback;
