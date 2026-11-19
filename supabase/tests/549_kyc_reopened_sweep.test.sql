-- The retry for a reopened desk check's files (#931): the kyc-reopened-sweep Edge Function, run by the scheduler, reads the
-- files still listed ten minutes after their reopening, a hundred at most and none of a frozen venue or member, and forgets
-- them once Storage removed them; only the service role does either. Files are listed directly, as a reopening lists them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.path_of(p_member text, p_file text) returns text language sql as $$
  select '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000002' || p_member || '/' || p_file || '.jpg';
$$;
create function pg_temp.list(p_member text, p_file text, p_minutes_ago integer) returns void language sql as $$
  insert into private.kyc_reopened_file (path, venue_id, member_id, reopened_at)
  values (pg_temp.path_of(p_member, p_file), '00000000-0000-4000-8000-000000000001',
          ('00000000-0000-4000-8000-0000000002' || p_member)::uuid, now() - make_interval(mins => p_minutes_ago));
$$;
grant execute on function pg_temp.path_of(text, text) to service_role;

delete from private.kyc_reopened_file;
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000002f2', '00000000-0000-4000-8000-000000000001', 'Kiran Frozen', '+919000077292');
select pg_temp.list('f1', 'in-person-old', 11);
select pg_temp.list('f1', 'doc-pan-new', 2);
select pg_temp.list('f2', 'in-person-frozen', 30);
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-0000000002f2', 'Held while the club looks into it');

set local role service_role;
select is(public.reopened_kyc_files_to_sweep(), array[pg_temp.path_of('f1', 'in-person-old')],
  'the sweep reads a file still listed ten minutes after its reopening, not one listed two minutes ago, nor a frozen member''s');
select is(public.forget_swept_kyc_files(array[pg_temp.path_of('f1', 'in-person-old'), pg_temp.path_of('f1', 'doc-pan-new')]), 1,
  'once Storage removed it, it is forgotten, and a file listed two minutes ago is not');
reset role;
select is((select array_agg(path order by path) from private.kyc_reopened_file),
  array[pg_temp.path_of('f1', 'doc-pan-new'), pg_temp.path_of('f2', 'in-person-frozen')], 'the others stay listed');

-- The practice venue's files are swept as the club's (nothing leaves the project), but not while it is frozen.
insert into private.kyc_reopened_file (path, venue_id, member_id, reopened_at)
values ('00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-0000000002f4/in-person.jpg', '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-0000000002f4', now() - interval '20 minutes');
set local role service_role;
select is(public.reopened_kyc_files_to_sweep(), array['00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-0000000002f4/in-person.jpg'],
  'the practice venue''s file is read as the club''s');
reset role;
insert into public.control_state (venue_id, level, reason)
values ('00000000-0000-4000-8000-000000000002', 'venue_freeze', 'The venue is frozen for a review');
set local role service_role;
select is(public.reopened_kyc_files_to_sweep(), '{}'::text[], 'nothing of a frozen venue is read');
reset role;

insert into private.kyc_reopened_file (path, venue_id, member_id, reopened_at)
select pg_temp.path_of('f3', 'doc-' || n), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000002f3',
       now() - interval '1 hour' + make_interval(secs => n)
from generate_series(1, 120) n;
set local role service_role;
select is(cardinality(public.reopened_kyc_files_to_sweep()), 100, 'a run reads a hundred files at most');
select is((public.reopened_kyc_files_to_sweep())[1], pg_temp.path_of('f3', 'doc-1'), 'the oldest first');
reset role;

select ok(not has_function_privilege('authenticated', 'public.reopened_kyc_files_to_sweep()', 'execute')
          and not has_function_privilege('authenticated', 'public.forget_swept_kyc_files(text[])', 'execute'),
  'nobody signed in reads or forgets the sweep''s files');
select ok(not has_function_privilege('anon', 'public.reopened_kyc_files_to_sweep()', 'execute')
          and not has_function_privilege('anon', 'public.forget_swept_kyc_files(text[])', 'execute'), 'nor anybody signed out');
select results_eq($$ select schedule, command from cron.job where jobname = 'outbox-kyc-reopened-sweep' $$,
  $$ values ('*/5 * * * *'::text, 'select private.run_outbox_consumer(''kyc-reopened-sweep'')'::text) $$,
  'the scheduler runs the sweep every five minutes, with its own secret');

-- A file Storage still holds is not forgotten, so the next run removes it again (the security review of #1104); one it no
-- longer holds is forgotten, as above.
reset role;
select pg_temp.list('f1', 'kept', 15);
insert into storage.objects (bucket_id, name) values ('kyc', pg_temp.path_of('f1', 'kept'));
set local role service_role;
select is(public.forget_swept_kyc_files(array[pg_temp.path_of('f1', 'kept')]), 0, 'a file Storage still holds stays listed');
reset role;

select * from finish();
rollback;
