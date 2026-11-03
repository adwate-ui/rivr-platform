-- The member's name is the Aadhaar's once DigiLocker verifies them (#803): the name they gave stays as what they are
-- known as, a name in capitals is set in ordinary capitals, nothing changes on a face that is not theirs, a reviewer's
-- approval of a held check gives the name too, and erasure clears both names. The members are made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-000000000001', 'Ashu', '+919000097701'),
  ('00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-000000000001', 'Dev M', '+919000097702'),
  ('00000000-0000-4000-8000-0000000005a3', '00000000-0000-4000-8000-000000000001', 'Ira', '+919000097703'),
  ('00000000-0000-4000-8000-0000000005a4', '00000000-0000-4000-8000-000000000001', 'Kunal Rao', '+919000097704');

create function pg_temp.started(p_member uuid) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, method, digilocker_session_id, photo_path)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'started', 'digilocker', 'session-' || p_member,
          '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg');
$$;
create function pg_temp.names(p_member uuid) returns text language sql as $$
  select row(full_name, known_as)::text from public.member where id = p_member;
$$;

-- How a name is written.
select is(private.legal_name('  ASHA   RANI VERMA '), 'Asha Rani Verma', 'capitals become ordinary capitals, and spaces single');
select is(private.legal_name('Dev Malhotra'), 'Dev Malhotra', 'a name already in mixed capitals is kept as given');
select is(private.legal_name('D''SOUZA'), 'D''Souza', 'a name with an apostrophe keeps its capital after it');
select is(private.legal_name('   '), null, 'no name is none');

-- Verified at once: the Aadhaar's name is the member's, and the one they gave is what they are known as.
select pg_temp.started('00000000-0000-4000-8000-0000000005a1');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005a1', '1990-06-15', 'XXXX XXXX 4821', null, null,
            'Gurugram', 'session-asha', true, 80, 'asha rani verma|1990-06-15|4821', 'ASHA RANI VERMA'), 'verified', 'DigiLocker verifies Ashu');
select is(pg_temp.names('00000000-0000-4000-8000-0000000005a1'), '("Asha Rani Verma",Ashu)',
  'her name is now her Aadhaar''s, and Ashu is what she is known as');
-- Staff who read members (103, an admin) see both names on the member's record.
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}', true);
select is((select row(full_name, known_as)::text from public.member_record('00000000-0000-4000-8000-000000000001',
             '00000000-0000-4000-8000-0000000005a1')), '("Asha Rani Verma",Ashu)', 'staff see her legal name and what she is known as');
reset role;
select set_config('request.jwt.claims', '', true);

-- The same name already: nothing to keep apart.
select pg_temp.started('00000000-0000-4000-8000-0000000005a4');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005a4', '1985-02-02', 'XXXX XXXX 1111', null, 'KUNPR4821K',
            'Gurugram', 'session-kunal', true, 90, 'kunal rao|1985-02-02|1111', 'Kunal Rao'), 'verified', 'Kunal is verified');
select is(pg_temp.names('00000000-0000-4000-8000-0000000005a4'), '("Kunal Rao",)', 'the same name: no other name kept');

-- A face that is not the selfie's: no name is kept and the member's stays as it was.
select pg_temp.started('00000000-0000-4000-8000-0000000005a3');
select is(public.record_kyc_digilocker('00000000-0000-4000-8000-0000000005a3', '1992-09-09', 'XXXX XXXX 2222', null, null,
            'Gurugram', 'session-ira', false, 20, 'someone else|1992-09-09|2222', 'SOMEONE ELSE'), 'needs_review', 'not her face');
select is((select aadhaar_name from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005a3'), null::text,
  'the Aadhaar''s name is not kept');
select is(pg_temp.names('00000000-0000-4000-8000-0000000005a3'), '(Ira,)', 'and her name stays');

-- Held for a reviewer with her own face (here a clash), then approved: the name comes with the approval.
select pg_temp.started('00000000-0000-4000-8000-0000000005a2');
update public.kyc_record set status = 'needs_review', aadhaar_name = 'Dev Malhotra', date_of_birth = '1988-01-20'
where member_id = '00000000-0000-4000-8000-0000000005a2';
select is(pg_temp.names('00000000-0000-4000-8000-0000000005a2'), '("Dev M",)', 'while held, his name is the one he gave');
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-0000000005a2';
select is(pg_temp.names('00000000-0000-4000-8000-0000000005a2'), '("Dev Malhotra","Dev M")', 'approved, the Aadhaar''s name is his');

-- Erasure clears both names and the Aadhaar's on the check, and from the audit rows about her.
select ok(exists (select 1 from public.audit_log a where '00000000-0000-4000-8000-0000000005a1' in (a.entity_id, a.after ->> 'member_id')
                  and (a.after ? 'known_as' and a.after ->> 'known_as' is not null or a.after ->> 'aadhaar_name' is not null)),
  'before erasure, the audit log holds the name she gave or the Aadhaar''s');
select private.anonymise_member(m) from public.member m where m.id = '00000000-0000-4000-8000-0000000005a1';
select private.scrub_member_audit(m) from public.member m where m.id = '00000000-0000-4000-8000-0000000005a1';
select is((select count(*)::integer from public.audit_log a
           where '00000000-0000-4000-8000-0000000005a1' in (a.entity_id, a.before ->> 'member_id', a.after ->> 'member_id')
             and (a.before ? 'known_as' or a.after ? 'known_as' or a.before ? 'aadhaar_name' or a.after ? 'aadhaar_name')),
  0, 'erased: no audit row about her holds either name');
select is(pg_temp.names('00000000-0000-4000-8000-0000000005a1'), '("Erased member",)', 'erased: no name known by');
select is((select count(*)::integer from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000005a1' and aadhaar_name is not null),
  0, 'and no Aadhaar name on the check');
select throws_ok($$ update public.member set known_as = 'Ashu' where id = '00000000-0000-4000-8000-0000000005a1' $$, '23514', null,
  'an erased member is never given a name known by again');

select * from finish();
rollback;
