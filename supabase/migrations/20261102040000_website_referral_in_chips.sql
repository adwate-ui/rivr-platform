-- The front page said a referral pays ₹1,000 to each side, where Promotions says 1,000 bonus chips (the website walk of
-- 2 Nov, W-08; the owner, 29 Oct: a bonus is said as bonus chips). Only while it still reads as the website came with it,
-- so a club's own words stay.
create function private.website_referral_in_chips(p_venue_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.site_block b
  set content = replace(b.content::text, '"₹1,000 for each side of a referral"', '"1,000 bonus chips for each side of a referral"')::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, '"₹1,000 for each side of a referral"') > 0;
$$;
revoke execute on function private.website_referral_in_chips(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261102010000_website_without_old_claims.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_without_old_claims;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_without_old_claims(p_venue_id);
  perform private.website_referral_in_chips(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_without_old_claims(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_referral_in_chips(v.id) from public.venue v where not v.is_practice;
