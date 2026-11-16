-- DigiLocker on Zoop (#1023; decision 0676): the webhook's delivery waits for the complete step. The hand-off keeps the
-- session and only the hash of its key; the webhook finds the session by the key alone; a delivery is kept under that key,
-- once, while the check waits on that session and the venue still takes checks; the complete step reads it and asks Zoop at
-- most every 30 seconds; it goes as soon as the check leaves the session, and within the hour after two hours. Only the
-- service role reaches any of it. The members are made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005f1', '00000000-0000-4000-8000-000000000001', 'Asha Verma', '+919000052001'),
  ('00000000-0000-4000-8000-0000000005f2', '00000000-0000-4000-8000-000000000001', 'Kabir Rao', '+919000052002');

-- A check whose selfie is in, before its hand-off.
create function pg_temp.selfie_in(p_member uuid) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, photo_path)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'started', '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg');
$$;

-- Zoop's delivery of a session, by the key given.
create function pg_temp.deliver(p_session text, p_key text) returns text language sql as $$
  select public.keep_kyc_digilocker_delivery(p_session, p_key, 'fetched', 'Asha Rani Verma', '1991-03-07', 'XXXX XXXX 4321',
    'ABCPV1234D', 'Sector 65, Gurugram, Haryana, 122102', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', p_session, null);
$$;

create function pg_temp.held(p_member uuid) returns integer language sql as $$
  select count(*)::int from private.kyc_digilocker_delivery where member_id = p_member;
$$;

select pg_temp.selfie_in('00000000-0000-4000-8000-0000000005f1');
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f1', 'zoop-session-a', 'key-for-session-a-0000');
select is((select row(session_id, key_hash = encode(extensions.digest('key-for-session-a-0000', 'sha256'), 'hex'), delivered_at is null)::text
           from private.kyc_digilocker_delivery where member_id = '00000000-0000-4000-8000-0000000005f1'),
  '(zoop-session-a,t,t)', 'the hand-off keeps the session and its key''s hash, waiting');
select is((select count(*)::int from private.kyc_digilocker_delivery where key_hash = 'key-for-session-a-0000'), 0, 'never the key itself');
select is(public.kyc_digilocker_delivery('00000000-0000-4000-8000-0000000005f1') ->> 'outcome', null, 'the complete step sees nothing come yet');

-- The webhook finds the session by the header's key alone, before it reads the body.
select is(public.kyc_digilocker_session('key-for-session-a-0000'), 'zoop-session-a', 'the key names its session');
select is(public.kyc_digilocker_session('not-the-key-0000000000'), null, 'another key names none');

select is(pg_temp.deliver('zoop-session-a', 'not-the-key-0000000000'), 'unknown', 'a delivery under another key is not kept');
select is(pg_temp.deliver('zoop-session-b', 'key-for-session-a-0000'), 'unknown', 'nor one for another session under this key');
select is(pg_temp.deliver('zoop-session-a', 'key-for-session-a-0000'), 'kept', 'the delivery under its key is kept');
select is(pg_temp.deliver('zoop-session-a', 'key-for-session-a-0000'), 'unknown', 'once');
select is(public.kyc_digilocker_session('key-for-session-a-0000'), null, 'and its key names no session after it');
select is((select row(d ->> 'outcome', d ->> 'name', d ->> 'date_of_birth', d ->> 'masked_aadhaar', d ->> 'pan', d ->> 'photo')::text
           from public.kyc_digilocker_delivery('00000000-0000-4000-8000-0000000005f1') d),
  '(fetched,"Asha Rani Verma",1991-03-07,"XXXX XXXX 4321",ABCPV1234D,"data:image/jpeg;base64,/9j/4AAQSkZJRg==")', 'and the complete step reads it');

-- A new hand-off drops the last session's delivery; one with no key (the fake) holds nothing.
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f1', 'zoop-session-c', 'key-for-session-c-0000');
select is((select session_id || '/' || (delivered_at is null)::text from private.kyc_digilocker_delivery
           where member_id = '00000000-0000-4000-8000-0000000005f1'), 'zoop-session-c/true', 'a new hand-off starts afresh');
select throws_ok($$ select public.keep_kyc_digilocker_delivery('zoop-session-c', 'key-for-session-c-0000', 'fetched', null, null, null,
                     null, null, null, null, null) $$,
  '23514', null, 'a fetched delivery without what the check needs is not kept');
select throws_ok($$ select public.keep_kyc_digilocker_delivery('zoop-session-c', 'key-for-session-c-0000', 'fetched', 'A', null,
                     'XXXX XXXX 4321', null, null, 'https://example.com/a.jpg', 'zoop-session-c', null) $$,
  '23514', null, 'nor one whose photo is not a JPEG sent with it');
select is(public.keep_kyc_digilocker_delivery('zoop-session-c', 'key-for-session-c-0000', 'fetched', repeat('A', 300), null,
            'XXXX XXXX 4321', null, null, 'data:image/jpeg;base64,/9j/4AAQ', 'zoop-session-c', null), 'kept',
  'a name too long is kept');
select is((select length(name) from private.kyc_digilocker_delivery where member_id = '00000000-0000-4000-8000-0000000005f1'), 200,
  'cut to 200 characters, so it never fails a check that would write the row to the log');
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f1', 'fake-digilocker-x');
select is(pg_temp.held('00000000-0000-4000-8000-0000000005f1'), 0, 'one with no key holds nothing');
select is(public.kyc_digilocker_delivery('00000000-0000-4000-8000-0000000005f1'), null, 'and the complete step sees no session');

-- Zoop is asked where a session stands once every 30 seconds at most.
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f1', 'zoop-session-d', 'key-for-session-d-0000');
select ok(public.may_ask_kyc_digilocker_status('00000000-0000-4000-8000-0000000005f1'), 'the complete step may ask Zoop');
select ok(not public.may_ask_kyc_digilocker_status('00000000-0000-4000-8000-0000000005f1'), 'but not again at once');
update private.kyc_digilocker_delivery set status_asked_at = now() - interval '31 seconds'
where member_id = '00000000-0000-4000-8000-0000000005f1';
select ok(public.may_ask_kyc_digilocker_status('00000000-0000-4000-8000-0000000005f1'), 'and again after 30 seconds');
select ok(not public.may_ask_kyc_digilocker_status('00000000-0000-4000-8000-0000000005f2'), 'never for a member with no session');

-- The check leaving its session takes the delivery with it: recorded either way, or the record gone.
select pg_temp.deliver('zoop-session-d', 'key-for-session-d-0000');
select public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005f1', '1991-03-07', 'XXXX XXXX 4321', null, 'ABCPV1234D',
  'Gurugram', 'zoop-session-d', true, 100, 'asha rani verma|1991-03-07|4321', 'Asha Rani Verma');
select is(pg_temp.held('00000000-0000-4000-8000-0000000005f1'), 0, 'a recorded check forgets its delivery');
select pg_temp.selfie_in('00000000-0000-4000-8000-0000000005f2');
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f2', 'zoop-session-k', 'key-for-session-k-0000');
select public.record_kyc_digilocker_failed('00000000-0000-4000-8000-0000000005f2');
select is(pg_temp.held('00000000-0000-4000-8000-0000000005f2'), 0, 'so does one sent to the desk (decision 0678)');
select is(public.keep_kyc_digilocker_delivery('zoop-session-k', 'key-for-session-k-0000', 'refused', null, null, null, null, null, null,
            null, 'Zoop CSD'), 'unknown', 'and a delivery after it is not kept');
update public.kyc_record set status = 'started' where member_id = '00000000-0000-4000-8000-0000000005f2';
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f2', 'zoop-session-m', 'key-for-session-m-0000');
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005f2';
select is(pg_temp.held('00000000-0000-4000-8000-0000000005f2'), 0, 'a check deleted (erased) takes its delivery with it');

-- One nobody took in two hours is forgotten by the hourly job.
select pg_temp.selfie_in('00000000-0000-4000-8000-0000000005f2');
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f2', 'zoop-session-n', 'key-for-session-n-0000');
update private.kyc_digilocker_delivery set started_at = now() - interval '2 hours 1 minute'
where member_id = '00000000-0000-4000-8000-0000000005f2';
select private.forget_stale_kyc_digilocker_deliveries();
select is(pg_temp.held('00000000-0000-4000-8000-0000000005f2'), 0, 'a delivery nobody took in two hours is forgotten');
select is((select schedule from cron.job where jobname = 'kyc-digilocker-deliveries-forget'), '35 * * * *', 'hourly');

-- With KYC sign-up stopped, a delivery is not kept, and the session waiting for it is dropped.
select public.record_kyc_started('00000000-0000-4000-8000-0000000005f2', 'zoop-session-p', 'key-for-session-p-0000');
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'kyc_signup', 'Vendor breach', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select is(public.kyc_digilocker_session('key-for-session-p-0000'), null, 'with KYC sign-up stopped the key names no session');
select is(pg_temp.held('00000000-0000-4000-8000-0000000005f2'), 0, 'and the session waiting is dropped');

-- Only the service role reaches any of it.
select ok(not has_function_privilege('authenticated', 'public.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text)', 'execute'),
  'a signed-in user cannot keep a delivery');
select ok(not has_function_privilege('anon', 'public.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text)', 'execute'),
  'nor can anyone signed out');
select ok(not has_function_privilege('authenticated', 'public.kyc_digilocker_session(text)', 'execute'), 'nor try a key');
select ok(not has_function_privilege('authenticated', 'public.kyc_digilocker_delivery(uuid)', 'execute'), 'nor read one');
select ok(not has_function_privilege('authenticated', 'public.may_ask_kyc_digilocker_status(uuid)', 'execute'), 'nor spend the asking');
select ok(not has_function_privilege('authenticated', 'public.record_kyc_started(uuid, text, text)', 'execute'), 'nor start a hand-off');
select ok(not has_table_privilege('authenticated', 'private.kyc_digilocker_delivery', 'select'), 'nor read the table');
select ok(has_function_privilege('service_role', 'public.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.kyc_digilocker_session(text)', 'execute')
  and has_function_privilege('service_role', 'public.kyc_digilocker_delivery(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.may_ask_kyc_digilocker_status(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.record_kyc_started(uuid, text, text)', 'execute'), 'the service role reaches all of it');

select * from finish();
rollback;
