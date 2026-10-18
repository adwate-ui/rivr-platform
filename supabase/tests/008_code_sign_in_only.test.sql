-- Auth's Custom Access Token hook issues tokens only to sessions started by a code (#187).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.event(methods text[], authentication_method text) returns jsonb language sql as $$
  select jsonb_build_object(
    'user_id', '00000000-0000-4000-8000-000000000201',
    'authentication_method', authentication_method,
    'claims', jsonb_build_object(
      'sub', '00000000-0000-4000-8000-000000000201',
      'amr', coalesce((select jsonb_agg(jsonb_build_object('method', m, 'timestamp', 1760000000)) from unnest(methods) as m), '[]'::jsonb)));
$$;

select is(private.require_code_sign_in(pg_temp.event(array['otp'], 'otp')), pg_temp.event(array['otp'], 'otp'),
  'a code sign-in gets its token, claims unchanged');
select is(private.require_code_sign_in(pg_temp.event(array['otp'], 'token_refresh')), pg_temp.event(array['otp'], 'token_refresh'),
  'a code session is refreshed');
select is(private.require_code_sign_in(pg_temp.event(array['password'], 'password')) -> 'error' ->> 'http_code', '403',
  'a password sign-in gets no token');
select is(private.require_code_sign_in(pg_temp.event(array['password'], 'token_refresh')) -> 'error' ->> 'http_code', '403',
  'a password session is never refreshed');
select is(private.require_code_sign_in(pg_temp.event(array[]::text[], 'password')) -> 'error' ->> 'http_code', '403',
  'a session with no sign-in method gets no token');
select is(private.require_code_sign_in('{}'::jsonb) -> 'error' ->> 'message', 'Sign in with the code sent to your phone.',
  'an event without claims gets no token, and the reason says how to sign in');

select ok(has_function_privilege('supabase_auth_admin', 'private.require_code_sign_in(jsonb)', 'execute'), 'Auth can call it');
select ok(not has_function_privilege('authenticated', 'private.require_code_sign_in(jsonb)', 'execute'), 'a signed-in person cannot');
select ok(not has_function_privilege('anon', 'private.require_code_sign_in(jsonb)', 'execute'), 'a visitor cannot');

select * from finish();
rollback;
