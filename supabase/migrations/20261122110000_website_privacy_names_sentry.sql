-- The privacy notice names Sentry, which receives the apps' error reports from now on (decision 0672, #1004). Only while the
-- providers' line still reads as the website came with it: a club's own words stay.
create function private.website_privacy_names_sentry(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old constant text := 'Supabase holds RIVR''s records, and Cloudflare serves the app and this website.';
  v_new constant text := 'Supabase holds RIVR''s records, and Cloudflare serves the app and this website. Sentry, run by Functional Software in the United States, gets a report when the app hits an error: what failed, the screens and requests just before it, and the browser, with phone numbers, PANs and other long numbers removed first. It also notes the city a report comes from.';
begin
  update public.site_block b set content = replace(b.content::text, v_old, v_new)::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'privacy'
    and strpos(b.content::text, v_old) > 0 and strpos(b.content::text, 'Sentry') = 0;
end;
$$;
revoke all on function private.website_privacy_names_sentry(uuid) from public, anon, authenticated, service_role;

-- A club's website comes with it: private.add_website, as 20261118100000_bonus_chips_become_bonus.sql last made it, then this.
alter function private.add_website(uuid) rename to add_website_before_sentry;
create function private.add_website(p_venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.add_website_before_sentry(p_venue_id);
  perform private.website_privacy_names_sentry(p_venue_id);
end;
$$;
revoke all on function private.add_website(uuid), private.add_website_before_sentry(uuid) from public, anon, authenticated, service_role;

-- The club made before. The practice venue reports nothing, so its notice is left as it is.
select private.website_privacy_names_sentry(v.id) from public.venue v where not v.is_practice;
