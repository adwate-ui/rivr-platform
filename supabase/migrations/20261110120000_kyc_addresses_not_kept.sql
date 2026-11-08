-- What the club no longer keeps, cleared (audit of 8 Nov 2026, F-215; the owner, 8 Nov: go ahead). Since identity is
-- checked at the desk (5 Nov), the privacy notice lists what the desk records: a photo, the date of birth, the PAN and
-- the last four Aadhaar digits. Checks done through DigiLocker before that also kept the member's address and the name on
-- their Aadhaar, which the notice no longer names and the super admins' export still showed. Read on 8 Nov: one such
-- verified record at the club on production, none on staging. The audit of these records never held them (it keeps only a
-- check's id, member, status, method, refusal, vendor reference and when it was verified); the name a member took from their
-- Aadhaar stays on their member record, by design (#803).
--
-- Verified checks only: a check still held keeps what a reviewer reads and the rename an approval makes, and an update here
-- would restart how long it has waited.
--
-- A DigiLocker check, should the club turn it back on, keeps them again; the notice would then need to name them.

update public.kyc_record set address = null, aadhaar_name = null
where status = 'verified' and (address is not null or aadhaar_name is not null);
