-- The member's own KYC selfie on their membership card (decision 0300; the owner's list of 2 Nov: "Add selfie
-- in membership card"). A member may see one KYC image: their own selfie, once their check is verified. Every
-- other image (another member's, or their own document images) stays staff-only, and every view is audited.

-- Whether the caller may see one KYC image: active staff with KYC review (at review) or the cage (at a
-- withdrawal) at the image's venue, or the member whose verified KYC photo it is. Every view is audited.
-- Refuses with 42501 otherwise. The name must be exactly <venue_id>/<member_id>/<file>.<jpg|png|webp> and an
-- object that exists: a name with `..` would pass a check of its first folder, then resolve to another
-- venue's image once the signing request's URL is normalised.
create or replace function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]+\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_name)
     or not (private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact')
             or exists (select 1 from public.kyc_record k
                        where k.member_id = private.current_member_id() and k.venue_id = v_venue_id
                          and k.status = 'verified' and k.photo_path = p_name)) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  perform private.audit(v_venue_id, 'kyc_image.view', 'kyc_image', p_name);
end;
$$;

-- The card gains the member's photo: their verified KYC selfie, where the image is kept; null otherwise, so a
-- card never shows a photo it cannot load. The return type changes, so both functions are made again.
drop function public.my_membership_card();
drop function private.my_membership_card();

create function private.my_membership_card()
returns table (member_number bigint, full_name text, tier_name text, code text, ms_left integer, photo_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_card_id uuid;
  v_window record;
begin
  select * into v_member from public.member m where m.id = private.current_member_id();
  if v_member.id is null then return; end if;
  insert into public.membership_card (venue_id, member_id) values (v_member.venue_id, v_member.id) on conflict (member_id) do nothing;
  select c.id into v_card_id from public.membership_card c where c.member_id = v_member.id;
  select * into v_window from private.card_window(v_member.venue_id, now());
  return query
  select v_member.member_number, v_member.full_name, t.name, private.card_code(v_card_id, v_window.o_start),
         ceil((v_window.o_start + v_window.o_seconds - extract(epoch from now())) * 1000)::integer,
         (select k.photo_path from public.kyc_record k
          where k.member_id = v_member.id and k.status = 'verified'
            and exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = k.photo_path))
  from public.tier t where t.id = v_member.tier_id;
end;
$$;

create function public.my_membership_card()
returns table (member_number bigint, full_name text, tier_name text, code text, ms_left integer, photo_path text)
language sql volatile security invoker set search_path = ''
as $$ select * from private.my_membership_card(); $$;

revoke execute on function private.my_membership_card(), public.my_membership_card() from public, anon;
grant execute on function private.my_membership_card(), public.my_membership_card() to authenticated;
