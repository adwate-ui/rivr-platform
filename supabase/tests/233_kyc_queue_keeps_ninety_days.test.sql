-- The KYC review queue keeps the stopped and refused checks of the last 90 days (audit F1-31), and every check waiting
-- for review however old. 103 Aditya reviews KYC.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table checks as
select k.member_id, row_number() over (order by k.member_id) as n
from public.kyc_record k where k.venue_id = '00000000-0000-4000-8000-000000000001' order by k.member_id limit 3;
select is((select count(*)::int from checks), 3, 'three of the club''s checks to age');

-- Written as the past would have left them: the row's own trigger would stamp now.
alter table public.kyc_record disable trigger kyc_record_touch_updated_at;
update public.kyc_record k set status = 'refused', verified_at = null, refusal = 'staff_rejected', updated_at = now() - interval '100 days'
from checks c where c.member_id = k.member_id and c.n = 1;
update public.kyc_record k set status = 'refused', verified_at = null, refusal = 'staff_rejected', updated_at = now() - interval '10 days'
from checks c where c.member_id = k.member_id and c.n = 2;
update public.kyc_record k set status = 'needs_review', verified_at = null, updated_at = now() - interval '200 days'
from checks c where c.member_id = k.member_id and c.n = 3;
alter table public.kyc_record enable trigger kyc_record_touch_updated_at;

grant select on checks to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
create temp table listed as select q.member_id from public.kyc_review_queue('00000000-0000-4000-8000-000000000001') q;
select ok(not exists (select 1 from listed l join checks c on c.member_id = l.member_id and c.n = 1), 'a check refused 100 days ago is left out');
select ok(exists (select 1 from listed l join checks c on c.member_id = l.member_id and c.n = 2), 'one refused 10 days ago is listed');
select ok(exists (select 1 from listed l join checks c on c.member_id = l.member_id and c.n = 3), 'and one waiting for review, however old');
reset role;

select * from finish();
rollback;
