-- The privacy notice's Sentry line covers every app and the website, which now report too (decision 0673, #1004). Only
-- while the line still reads as 20261122110000_website_privacy_names_sentry.sql wrote it: a club's own words stay.
create function private.website_privacy_sentry_for_every_app(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old constant text := 'gets a report when the app hits an error:';
  v_new constant text := 'gets a report when one of RIVR''s apps or this website hits an error:';
begin
  update public.site_block b set content = replace(b.content::text, v_old, v_new)::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'privacy' and strpos(b.content::text, v_old) > 0;
end;
$$;
revoke all on function private.website_privacy_sentry_for_every_app(uuid) from public, anon, authenticated, service_role;

-- A club's website comes with it: private.add_website, as 20261122110000_website_privacy_names_sentry.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_naming_sentry_for_the_app;
create function private.add_website(p_venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.add_website_naming_sentry_for_the_app(p_venue_id);
  perform private.website_privacy_sentry_for_every_app(p_venue_id);
end;
$$;
revoke all on function private.add_website(uuid), private.add_website_naming_sentry_for_the_app(uuid) from public, anon, authenticated, service_role;

-- The club made before. The practice venue reports nothing, so its notice is left as it is.
select private.website_privacy_sentry_for_every_app(v.id) from public.venue v where not v.is_practice;
