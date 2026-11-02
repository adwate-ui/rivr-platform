-- The house rules said a called seat is held 10 minutes, where the club's setting (waitlist.hold_minutes, seeded at 20)
-- and the floor hold it 20 (the console walk of 2 Nov, C-05). Only while the line still reads as the website came with
-- it, so a club's own words stay.
create function private.website_seat_hold_rule(p_venue_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.site_block b
  set content = replace(b.content::text, '"Seats go in waitlist order. A seat is held for 10 minutes once it is called."',
                        '"Seats go in waitlist order. A seat is held for 20 minutes once it is called."')::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id
    and strpos(b.content::text, '"Seats go in waitlist order. A seat is held for 10 minutes once it is called."') > 0;
$$;
revoke execute on function private.website_seat_hold_rule(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261102040000_website_referral_in_chips.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_referral_in_chips;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_referral_in_chips(p_venue_id);
  perform private.website_seat_hold_rule(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_referral_in_chips(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_seat_hold_rule(v.id) from public.venue v where not v.is_practice;
