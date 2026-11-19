-- The website's rewrite and the wrapper that makes a club's website run only as migrations and the system run them, as the
-- earlier add_website migrations have it: revoked from service_role too (a security review nit on 20261125180000).
revoke execute on function private.website_calls_in_the_app(uuid), private.add_website(uuid), private.add_website_with_privacy_sentry(uuid)
  from service_role;
