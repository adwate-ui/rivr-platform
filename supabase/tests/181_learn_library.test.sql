-- The Learn library (#133): a member sees and reads the licensed sources their tier has, until the licence ends.
-- 101 Vikram is a super admin; 213 Mihir and 214 Yash are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into storage.objects (bucket_id, name) values ('learn-sources', '00000000-0000-4000-8000-000000000001/src_book.json');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select public.register_learn_source('00000000-0000-4000-8000-000000000001', 'src_book', 'The Book', 'An Author', 'abc', 'Licensed to the club', current_date + 30);
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'learn.source.src_book', false, 'Test');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select title from public.learn_source $$, $$ values ('The Book'::text) $$, 'Mihir sees the licensed source his tier has');
select ok(private.may_read_learn_source('00000000-0000-4000-8000-000000000001/src_book.json'), 'and may read its encoding');
select ok(not private.may_read_learn_source('00000000-0000-4000-8000-000000000002/src_book.json'), 'at his own club only');
select ok(not private.may_read_learn_source('00000000-0000-4000-8000-000000000001/src_other.json'), 'and only a source he has');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select 1 from public.learn_source $$, 'Yash, without it, sees nothing');
select ok(not private.may_read_learn_source('00000000-0000-4000-8000-000000000001/src_book.json'), 'and reads nothing');
reset role;
update public.feature set available_until = current_date - 1 where key = 'learn.source.src_book';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.learn_source $$, 'once the licence lapses, Mihir sees it no more');
select ok(not private.may_read_learn_source('00000000-0000-4000-8000-000000000001/src_book.json'), 'nor reads it');
reset role;

select * from finish();
rollback;
