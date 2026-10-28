-- The website's pause follows its own venue (#609): another live venue's freeze, such as one being purged, leaves the
-- club's status open, and each status names its venue by the slug the site's pages carry.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e8', 'Test Other Room', 'test-other-room', false, 'Test Other Room LLP', 'Gurugram', 'TOR');
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-0000000000e8', 'venue_freeze', 'Being purged');

select is((select venue_slug from public.public_venue_status where venue_id = '00000000-0000-4000-8000-000000000001'),
  (select slug from public.venue where id = '00000000-0000-4000-8000-000000000001'), 'each venue is named by its slug, as its website''s pages are');

set local role anon;
select is((select is_frozen from public.public_venue_status where venue_slug = 'test-other-room'), true, 'the other venue reads frozen');
select is((select is_frozen from public.public_venue_status where venue_id = '00000000-0000-4000-8000-000000000001'), false,
  'and the club does not');
select is((select count(*) from public.public_venue_status where venue_id = '00000000-0000-4000-8000-000000000002'), 0::bigint,
  'the practice venue is not there at all');

select * from finish();
rollback;
