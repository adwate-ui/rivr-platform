-- Members whose flows open the player app's screens have finished the identity check: since #632 a member sees nothing
-- but its steps until then. The KYC flows' own members (Meera Iyer, 218, and Asha Verma, 301) are left unchecked, as
-- are the members the database tests check unverified (Kabir Sethi, 202, and Tara Menon, 209, among them).
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select m.venue_id, m.id, 'verified', 'digilocker', '1991-03-15', 'ABCPQ' || right(m.phone, 4) || 'Z',
       m.venue_id || '/' || m.id || '/selfie.jpg', now()
from public.member m
where m.phone in ('+919000000280', '+919000000290', '+919000000299', '+919000000620',
                  '+919000000621', '+919000000638', '+919000000642', '+919000000702')
  and not exists (select 1 from public.kyc_record k where k.member_id = m.id);

-- The release's sign-in flow (e2e/flows/sign-in.spec.ts, decision 0420) signs in on staging as Kabir (202) and expects a
-- check not yet done, which no app can put back once it is under way. Staging runs this seed on every deploy, after its
-- migrations, and a release waits for staging to have its commit: whatever a tester or a migration's data step did to his
-- check (20261122190000 sent it to the desk on 17 Nov, which let him into the app) is undone before a release looks.
-- Locally he has none after a reset, so this does nothing there.
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000202';
