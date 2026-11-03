-- A DigiLocker check that comes back is verified at once (decision 0400). The owner's own check on staging, 3 Nov,
-- waited for review although DigiLocker returned their Aadhaar and Cashfree matched the selfie to its photo: the
-- check also asked for the Aadhaar's name letter for letter as the member registered it. Now the face alone says
-- whose Aadhaar it is, so another spelling of the name, or a DigiLocker with no PAN, verifies, keeps the identity
-- and gives the verified bonus. Two rules still stop it: under 18 is refused, and another membership's identity is
-- refused (a verified PAN) or held for a KYC reviewer (the identity key). A face that is not the selfie's is
-- someone else's Aadhaar: it waits for staff and keeps nothing. The members are made here, with sanitized details.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000004d1', '00000000-0000-4000-8000-000000000001', 'Asha Verma', '+919000098801'),
  ('00000000-0000-4000-8000-0000000004d2', '00000000-0000-4000-8000-000000000001', 'Dev Malhotra', '+919000098802'),
  ('00000000-0000-4000-8000-0000000004d3', '00000000-0000-4000-8000-000000000001', 'Ira Sen', '+919000098803'),
  ('00000000-0000-4000-8000-0000000004d4', '00000000-0000-4000-8000-000000000001', 'Kunal Rao', '+919000098804'),
  ('00000000-0000-4000-8000-0000000004d5', '00000000-0000-4000-8000-000000000001', 'Nikhil Rao', '+919000098805'),
  ('00000000-0000-4000-8000-0000000004d6', '00000000-0000-4000-8000-000000000001', 'Meera Pillai', '+919000098806');

-- The club gives 500 points for a verified check, whatever day the test runs on.
delete from public.setting where key = 'points.verified_bonus';
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '{"points": 500}', '-infinity', 'DigiLocker test');

create function pg_temp.points(p_member uuid) returns bigint language sql as $$
  select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points';
$$;

-- A check whose selfie is in and whose DigiLocker hand-off has begun.
create function pg_temp.started(p_member uuid) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, digilocker_session_id, photo_path)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'started', 'digilocker', 'session-' || p_member,
          '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg');
$$;

-- The owner's case: DigiLocker's Aadhaar in a name not spelled as Asha registered it, no PAN, the face matched (75).
select pg_temp.started('00000000-0000-4000-8000-0000000004d1');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004d1', '1990-06-15', 'XXXX XXXX 4821', null, null,
            'Gurugram', 'session-asha', true, 75, 'asha rani verma|1990-06-15|4821'), 'verified',
  'DigiLocker''s Aadhaar with the member''s face is verified at once, whatever name they registered and with no PAN');
select is((select row(date_of_birth, masked_aadhaar, identity_key is not null, verified_at is not null)::text
           from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004d1'),
  '(1990-06-15,"XXXX XXXX 4821",t,t)', 'the identity is kept, the identity key with it, and the time it was verified');
select is(pg_temp.points('00000000-0000-4000-8000-0000000004d1'), 500::bigint, 'the verified bonus is given, as on every route');
select is((select count(*)::integer from public.outbox_event e where e.event_type = 'kyc.completed'
           and e.payload ->> 'member_id' = '00000000-0000-4000-8000-0000000004d1'), 1, 'and kyc.completed tells the rest of the system');

-- With a PAN in DigiLocker it is kept.
select pg_temp.started('00000000-0000-4000-8000-0000000004d2');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004d2', '1988-01-20', 'XXXX XXXX 7310', null, 'MLDPM4821K',
            'Gurugram', 'session-dev', true, 91, 'dev malhotra|1988-01-20|7310'), 'verified', 'DigiLocker with a PAN verifies too');
select is((select pan from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004d2'), 'MLDPM4821K', 'and keeps the PAN');

-- A face that is not the selfie's: someone else's Aadhaar.
select pg_temp.started('00000000-0000-4000-8000-0000000004d3');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004d3', '1993-09-09', 'XXXX XXXX 5150', null, 'SENPI5150Q',
            'Gurugram', 'session-ira', false, 41, 'ira sen|1993-09-09|5150'), 'needs_review',
  'a face that is not the selfie''s waits for staff');
select is((select row(date_of_birth, masked_aadhaar, pan, address, identity_key)::text
           from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004d3'),
  '(,,,,)', 'and keeps none of that person''s identity');
select is(pg_temp.points('00000000-0000-4000-8000-0000000004d3'), 0::bigint, 'and gives no bonus');

-- Under 18 on DigiLocker's date of birth is refused.
select pg_temp.started('00000000-0000-4000-8000-0000000004d4');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004d4', (current_date - interval '17 years')::date,
            'XXXX XXXX 2468', null, null, 'Gurugram', 'session-kunal', true, 88), 'refused',
  'under 18 is refused, though DigiLocker came back');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004d4'), 'under_18', 'and says why');

-- The same identity as another member's check is held for a reviewer; a verified member's PAN is refused.
select pg_temp.started('00000000-0000-4000-8000-0000000004d5');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004d5', '1990-06-15', 'XXXX XXXX 4821', null, null,
            'Gurugram', 'session-nikhil', true, 90, 'asha rani verma|1990-06-15|4821'), 'needs_review',
  'the identity of another member''s check waits for a KYC reviewer');
select pg_temp.started('00000000-0000-4000-8000-0000000004d6');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000004d6', '1985-03-03', 'XXXX XXXX 9001', null, 'MLDPM4821K',
            'Gurugram', 'session-meera', true, 93, 'meera pillai|1985-03-03|9001'), 'refused',
  'a PAN a verified member holds is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000004d6'), 'duplicate_pan', 'and says why');

select * from finish();
rollback;
