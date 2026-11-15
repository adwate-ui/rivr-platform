-- What the removal of points and the League kept (decision 0585). The club's month, which the Glaza import and session
-- history read, turns at 06:00 IST on the first: it was the League's month, and its cases went with the League's. And a
-- device set to the tournament clock, as the stream overlay is, reads no waitlist names (audit 8 Nov, F-136), which the
-- TV boards' test of points held.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(private.club_month('2026-11-14 15:30:00+00'), '2026-11-01'::date, '21:00 IST on 14 November is November');
select is(private.club_month('2026-11-30 20:30:00+00'), '2026-11-01'::date, '02:00 IST on 1 December is still November: the club''s day has not turned');
select is(private.club_month('2026-12-01 00:29:00+00'), '2026-11-01'::date, '05:59 IST on 1 December is still November');
select is(private.club_month('2026-12-01 00:30:00+00'), '2026-12-01'::date, '06:00 IST on 1 December is December');
select is(private.club_month('2027-01-01 00:00:00+00'), '2026-12-01'::date, '05:30 IST on 1 January is still December, of the year before');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e415', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000004151');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d415', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV', '00000000-0000-4000-8000-00000000e415');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d415', '00000000-0000-4000-8000-000000000001', 'tournament_clock');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e415');
select is_empty($$ select * from public.tv_waitlist_board() $$, 'a device on the tournament clock reads no waitlist names');

select * from finish();
rollback;
