-- Sessions only for code sign-ins (#187). RIVR signs people in by a one-time code sent to their
-- phone, but Auth also accepts phone-and-password sign-ups and password grants, and every access
-- check after link_my_login trusts any session for a user id. So Auth's Custom Access Token hook
-- calls this before it issues or refreshes any token, and it refuses one whose sign-in methods
-- (amr) include no `otp`. Auth records `otp` for any code it verifies, email codes and links
-- included, so the email provider stays off (runbook). Device logins (dealer tablets, TVs) will
-- need their own rule when they arrive.

create function private.require_code_sign_in(event jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    -- Lax JSON path: an amr that is missing, null or not an array simply has no `otp`.
    when jsonb_path_exists(event, '$.claims.amr[*] ? (@.method == "otp")') then event
    else jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'Sign in with the code sent to your phone.')
    )
  end
$$;

comment on function private.require_code_sign_in(jsonb) is
  'Auth''s Custom Access Token hook: no token for a session that was not started by a code (#187).';

-- Only Auth calls it.
revoke execute on function private.require_code_sign_in(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.require_code_sign_in(jsonb) to supabase_auth_admin;
