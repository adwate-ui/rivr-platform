-- The hidden money modules are refused to API callers (decision 0513; audit F-038). PostgREST runs
-- private.refuse_hidden_modules before every request with request.path set; signed-in and anonymous callers are refused
-- a hidden module's function, the service role and every other path are not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is((select array_to_string(r.rolconfig, ',') ~ 'pgrst.db_pre_request=private.refuse_hidden_modules' from pg_roles r
           where r.rolname = 'authenticator'), true, 'PostgREST asks private.refuse_hidden_modules before every request');

create function pg_temp.request(p_role text, p_path text) returns void language sql as $$
  select set_config('request.path', p_path, true), set_config('role', p_role, true);
$$;
grant execute on function pg_temp.request(text, text) to anon, authenticated, service_role;

select pg_temp.request('authenticated', '/rpc/cage_buy_in');
select throws_ok($$ select private.refuse_hidden_modules() $$, '42501', 'That part of RIVR is not in use',
                 'a signed-in caller is refused a cage buy-in');
reset role;
select pg_temp.request('authenticated', '/rpc/issue_marker');
select throws_ok($$ select private.refuse_hidden_modules() $$, '42501', null, 'and a marker');
reset role;
select pg_temp.request('authenticated', '/rpc/payout_accounts_to_verify');
select throws_ok($$ select private.refuse_hidden_modules() $$, '42501', null, 'and members'' bank accounts waiting to be checked');
reset role;
select pg_temp.request('authenticated', '/rpc/tv_jackpot');
select lives_ok($$ select private.refuse_hidden_modules() $$, 'but the TV''s jackpot board, which a live screen reads, passes');
reset role;
select pg_temp.request('anon', '/rpc/my_wallet');
select throws_ok($$ select private.refuse_hidden_modules() $$, '42501', null, 'an anonymous caller is refused the wallet');
reset role;
select pg_temp.request('authenticated', '/rpc/member_search');
select lives_ok($$ select private.refuse_hidden_modules() $$, 'a live function passes');
reset role;
select pg_temp.request('authenticated', '/member');
select lives_ok($$ select private.refuse_hidden_modules() $$, 'and so does a table');
reset role;
select pg_temp.request('service_role', '/rpc/send_withdrawal');
select lives_ok($$ select private.refuse_hidden_modules() $$, 'the service role is never refused');
reset role;

-- Every name on the list is a function the database has, so none is misspelt.
select is_empty($$
  select p.path from unnest(string_to_array(
    substring(pg_get_functiondef('private.refuse_hidden_modules'::regproc) from 'array\[(.*)\]\)'), ',')) as p(path)
  where not exists (select 1 from pg_proc f join pg_namespace n on n.oid = f.pronamespace
                    where n.nspname = 'public' and '/rpc/' || f.proname = trim(both E' \n''' from p.path)) $$,
  'every refused path names a public function');

select * from finish();
rollback;
