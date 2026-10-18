-- The minimum age from the venue's kyc.minimum_age setting (#203; lane C contract, "Settings keys
-- added"), in place of a fixed 18. The setting can raise it, never lower it: its schema and
-- private.kyc_minimum_age both hold the floor at 18. Without a setting in force it is 18. The
-- refusal keeps the name under_18: under the venue's minimum age.

insert into public.setting_key (key, description, scope, value_schema) values
  ('kyc.minimum_age',
   'The age a member must have reached to be verified and to play; never below 18 (scope-v1 module 1, "18+ gate").',
   'venue',
   '{"type":"object","properties":{"years":{"type":"integer","minimum":18,"maximum":25}},"required":["years"],"additionalProperties":false}');

-- The age a member of the venue must have reached today: the setting in force, never below 18. The
-- value is cast from JSON, not from text, so 21.0, which the schema accepts as an integer, reads as 21.
create function private.kyc_minimum_age(p_venue_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(18, coalesce((private.setting_at(p_venue_id, 'kyc.minimum_age', '', now()) -> 'years')::integer, 18));
$$;

create or replace function private.kyc_refusal(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when k.date_of_birth > (now() at time zone v.time_zone)::date - make_interval(years => private.kyc_minimum_age(k.venue_id))
      then 'under_18'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified' and o.pan = k.pan)
      then 'duplicate_pan'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and o.aadhaar_reference = k.aadhaar_reference)
      then 'duplicate_aadhaar'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id = k.same_face_as and o.member_id <> k.member_id
                   and o.status = 'verified')
      then 'duplicate_face'
  end
  from public.kyc_record k join public.venue v on v.id = k.venue_id
  where k.member_id = p_member_id;
$$;

-- Whether a member may take a seat or buy in (lanes A and B): verified, with a KYC photo, and at
-- least the venue's minimum age today on its calendar. Refused checks, duplicates among them, never pass.
create or replace function private.is_kyc_complete(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select k.status = 'verified' and k.photo_path is not null
       and k.date_of_birth <= (now() at time zone v.time_zone)::date - make_interval(years => private.kyc_minimum_age(k.venue_id))
    from public.kyc_record k join public.venue v on v.id = k.venue_id
    where k.member_id = p_member_id
  ), false);
$$;
