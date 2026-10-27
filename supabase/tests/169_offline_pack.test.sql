-- The offline pack's contents (#168, decision 0260): only the service role reads it, never for the practice venue,
-- and each part is what the tables hold for that venue alone. 101 Vikram is a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A venue of its own, made first as its settings take effect when the test begins, with a contact of its own.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into public.contact (venue_id, kind, name, phone) values ('00000000-0000-4000-8000-0000000000e1', 'police', 'Elsewhere police', '100');

create temporary table pack on commit drop as select public.offline_pack('00000000-0000-4000-8000-000000000001') as body;

select is((select body ->> 'venue_name' from pack), (select name from public.venue where id = '00000000-0000-4000-8000-000000000001'),
  'the pack is the club''s');
select is((select body -> 'issuer' ->> 'legal_name' from pack),
  (select legal_name from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'), 'headed by its legal name');
select is((select jsonb_array_length(body -> 'contacts') from pack),
  (select count(*)::integer from public.contact where venue_id = '00000000-0000-4000-8000-000000000001'), 'with every contact of the club''s');
select is((select count(*)::integer from pack, jsonb_array_elements(body -> 'contacts') c where c ->> 'name' = 'Elsewhere police'), 0,
  'and none of another venue''s');
select is((select jsonb_array_length(body -> 'tables') from pack),
  (select count(*)::integer from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and is_open), 'every open table');
select is((select coalesce(sum(jsonb_array_length(t -> 'seats')), 0)::integer from pack, jsonb_array_elements(body -> 'tables') t),
  (select count(*)::integer from public.seat_session where venue_id = '00000000-0000-4000-8000-000000000001' and ended_at is null),
  'with everyone seated');
select is((select jsonb_array_length(body -> 'sops') from pack),
  (select count(*)::integer from public.sop s cross join lateral private.sop_version_in_force(s.id) v
   where s.venue_id = '00000000-0000-4000-8000-000000000001' and v.id is not null), 'every SOP in force');
select ok((select bool_and((b ->> 'wallet_paise')::bigint <> 0 or (b ->> 'markers_paise')::bigint <> 0) from pack, jsonb_array_elements(body -> 'balances') b)
          is not false, 'balances list only members with money held or owed');
select is((select (body ->> 'wallets_paise')::bigint from pack),
  (select coalesce(sum((b ->> 'wallet_paise')::bigint), 0)::bigint from pack, jsonb_array_elements(body -> 'balances') b), 'the wallets total their rows');
select is((select (body ->> 'markers_paise')::bigint from pack),
  (select coalesce(sum(outstanding_paise), 0)::bigint from public.marker where venue_id = '00000000-0000-4000-8000-000000000001' and settled_at is null),
  'and the markers total what is outstanding');

select throws_ok($$ select public.offline_pack('00000000-0000-4000-8000-000000000002') $$, 'RVPRA', null, 'the practice venue has no pack');
select is((select count(*)::integer from public.offline_pack_venues() where venue_id = '00000000-0000-4000-8000-000000000002'), 0,
  'and the nightly job makes none for it');
select is((select count(*)::integer from public.offline_pack_venues() where venue_id = '00000000-0000-4000-8000-000000000001'), 1,
  'but one for the club');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select throws_ok($$ select public.offline_pack('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'a signed-in super admin cannot read it: the nightly job alone does');
reset role;
set local role anon;
select throws_ok($$ select public.offline_pack('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor can anyone signed out');
reset role;

select is((select public from storage.buckets where id = 'offline-packs'), false, 'the packs are kept in a private bucket');
select is((select allowed_mime_types from storage.buckets where id = 'offline-packs'), array['application/pdf'], 'of PDFs only');

select * from finish();
rollback;
