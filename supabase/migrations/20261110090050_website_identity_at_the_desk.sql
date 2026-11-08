-- The website's identity check as the club runs it (8 Nov audit, I-09, F-012). Since 5 Nov (decision 0502) a member takes a
-- selfie in the app and the front desk checks their Aadhaar and PAN on their first visit, but the front page, Membership,
-- Questions, About and the terms still sent visitors to DigiLocker, and the privacy notice named Cashfree as the processor
-- and an address the desk does not record. Each line only while it still reads as the website came with it, so a club's
-- own words stay.
create function private.website_identity_at_the_desk(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Each line as the website came with it, and what replaces it.
  v_lines constant text[][] := array[
    ['"18 and over, with your identity checked by DigiLocker and a selfie before you take a seat."',
     '"18 and over, with a selfie in the app and an ID check at the front desk before you take a seat."'],
    ['"Sign up in the RIVR app with your mobile number, then finish the identity check with DigiLocker and a selfie. You must be 18 or over. Check in at the front desk with the card in your app."',
     '"Sign up in the RIVR app with your mobile number and a selfie. You must be 18 or over. On your first visit, bring your Aadhaar and PAN: the front desk checks them and checks you in with the card in your app."'],
    ['"Anyone 18 or over. Sign up in the app and finish the identity check with DigiLocker and a selfie."',
     '"Anyone 18 or over. Sign up in the app with a selfie, and bring your Aadhaar and PAN to the front desk on your first visit."'],
    ['"Anyone 18 or over. Sign up in the app with your mobile number, then finish the identity check with DigiLocker and a selfie."',
     '"Anyone 18 or over. Sign up in the app with your mobile number and a selfie, then bring your Aadhaar and PAN to the front desk on your first visit."'],
    ['"With DigiLocker and a selfie. You must be 18 or over."',
     '"A selfie in the app, then your Aadhaar and PAN at the front desk on your first visit. You must be 18 or over."'],
    ['"A phone with the RIVR app, and DigiLocker for the identity check. You must be 18 or over."',
     '"A phone with the RIVR app, and your Aadhaar and PAN for the front desk on your first visit. You must be 18 or over."'],
    ['Before you play, you finish the identity check: DigiLocker and a selfie in the app, or a check in person at the front desk.',
     'Before you play, you finish the identity check: a selfie in the app, then a check of your Aadhaar and PAN at the front desk on your first visit.'],
    -- The privacy notice: what the desk records (check_kyc_in_person keeps its own photo, the date of birth, the PAN and
    -- the last four Aadhaar digits, and no address), and no vendor.
    ['From the identity check: the selfie you take, your date of birth, your address, your PAN and the last four digits of your Aadhaar.',
     'From the identity check: the selfie you take in the app and, when the front desk checks your Aadhaar and PAN on your first visit, a photo the desk takes of you, your date of birth, your PAN and the last four digits of your Aadhaar.'],
    [' Cashfree runs the identity check with DigiLocker.', '']
  ];
  v_line text[];
begin
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0;
  end loop;
end;
$$;
revoke execute on function private.website_identity_at_the_desk(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261105120100_journal_legal_card.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_journal_legal_card;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_journal_legal_card(p_venue_id);
  perform private.website_identity_at_the_desk(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_journal_legal_card(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_identity_at_the_desk(v.id) from public.venue v where not v.is_practice;
