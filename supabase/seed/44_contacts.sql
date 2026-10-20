-- The club's contacts (#53): the internal escalation matrix, vendors, Glaza, the police station, the fire
-- service and DHBVN. Staff numbers are the seeded test numbers; the public helplines are India's own (112,
-- 101, DHBVN's 1912). Vendors and Glaza are placeholders until the club gives their numbers. Local and
-- staging only: production is never seeded.

insert into public.contact (venue_id, kind, position, name, role, phone, notes)
select '00000000-0000-4000-8000-000000000001', c.kind::public.contact_kind, c.position, c.name, c.role, c.phone, c.notes
from (values
  ('escalation', 1, 'Rohit Chawla', 'Duty manager', '+91 90000 00113', 'First call for anything on the floor or at the cage.'),
  ('escalation', 2, 'Vikram Rao', 'Owner', '+91 90000 00101', 'When the duty manager cannot resolve it, or for any police matter.'),
  ('vendor', 1, 'CCTV vendor', 'Cameras and recorder', '+91 90000 00901', 'Placeholder: the club gives the number.'),
  ('vendor', 2, 'Internet provider', 'Wi-Fi and the line', '+91 90000 00902', 'Placeholder: the club gives the number.'),
  ('glaza', 1, 'Glaza duty manager', 'Food and drink, the building', '+91 90000 00903', 'Placeholder: the club gives the number.'),
  ('police', 1, 'Police', 'Emergency', '112', 'Sector 65 police station for anything that is not an emergency.'),
  ('fire', 1, 'Fire service', 'Emergency', '101', ''),
  ('electricity', 1, 'DHBVN', 'Power cut complaints', '1912', 'Give the connection number on the meter.')
) as c (kind, position, name, role, phone, notes)
where not exists (select 1 from public.contact x where x.venue_id = '00000000-0000-4000-8000-000000000001');
