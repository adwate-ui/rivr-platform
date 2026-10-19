-- The design prompt's waitlist for 100/200: Kabir Sethi, Naina Kapoor, then Rohan Bhatia, joined
-- 15, 9 and 0 minutes before the seed ran. 50/100 is empty (#38).

insert into public.waitlist_entry (venue_id, member_id, table_type_id, joined_at, idempotency_key)
select tt.venue_id, w.member_id, tt.id, now() - w.ago, w.member_id
from (values
  ('00000000-0000-4000-8000-000000000202'::uuid, interval '15 minutes'),
  ('00000000-0000-4000-8000-000000000203'::uuid, interval '9 minutes'),
  ('00000000-0000-4000-8000-000000000204'::uuid, interval '0 minutes')
) as w (member_id, ago)
join public.table_type tt on tt.code = 'nlh_100_200' and tt.venue_id = '00000000-0000-4000-8000-000000000001'
on conflict (venue_id, idempotency_key) do nothing;

-- Ishaan Verma has finished the identity check, so the Waitlist flow and a demo can join a list.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'verified', 'digilocker',
        '1994-08-21', 'ABCPV2111K',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg', now())
on conflict do nothing;
