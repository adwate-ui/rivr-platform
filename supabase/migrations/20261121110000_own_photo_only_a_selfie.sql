-- A member's own photo in the app is only a selfie they took (the owner, 15 Nov night, decision 0662): "only keep the selfie
-- as app photo because on-site photos are randomly taken by the staff". A photo the desk took (in-person-<id>.jpg) is no
-- longer theirs to see, even once their check is verified; a member with no selfie of their own shows their initial. Staff
-- see what they saw before. As 20261117220000_own_selfie_before_the_desk.sql made both functions, the desk's photo now
-- excluded in every state of the check.

-- Where the signed-in member's own face photo is kept: the selfie their check points to, or else the selfie they took at
-- sign-up. Only a photo that is kept is named, so the app asks for no image it would be refused. Null with neither, and for
-- anyone who is not a member.
create or replace function private.my_photo_path()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select o.name from storage.objects o where o.bucket_id = 'kyc' and o.name = k.photo_path
                     and k.photo_path !~ '/in-person-[0-9a-f-]{36}\.jpg$'),
                  (select o.name from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg'))
  from public.member m
  left join public.kyc_record k on k.member_id = m.id
  where m.id = private.current_member_id();
$$;

-- What a member uploaded themselves is theirs whatever the state of their check: the selfie it points to and their sign-up
-- selfie. A photo the desk took never is. Everything else is as it was.
create or replace function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
  v_is_staff boolean := private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact')
                        or (private.has_permission(v_venue_id, 'kyc.in_person')
                            and (p_name ~ '/photo\.jpg$'
                                 -- The selfie of a member reopened for the desk, who may have no sign-up photo.
                                 or exists (select 1 from public.kyc_record k where k.photo_path = p_name and k.status = 'started'
                                              and k.at_club_from is not null)));
begin
  -- A member's PAN and Aadhaar photos are for super admins alone, whoever took them (the owner, 9 Nov).
  if p_name ~ '/doc-(pan|aadhaar)-[0-9a-f-]{36}\.jpg$' and not coalesce(private.is_super_admin(v_venue_id), false) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]+\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_name)
     or not (v_is_staff
             or exists (select 1 from public.kyc_record k
                        where k.member_id = private.current_member_id() and k.venue_id = v_venue_id
                          and k.photo_path = p_name
                          -- A photo the desk took is staff's, never the member's own (decision 0662).
                          and p_name !~ '/in-person-[0-9a-f-]{36}\.jpg$')
             or exists (select 1 from public.member m
                        where m.id = private.current_member_id() and p_name = m.venue_id || '/' || m.id || '/photo.jpg')) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  -- One of the member's views at a time, so calls made together cannot all count the same views and all pass.
  if not v_is_staff then
    perform pg_advisory_xact_lock(hashtextextended('kyc-view:' || (select auth.uid())::text, 0));
  end if;
  if not v_is_staff and (select count(*) from public.audit_log a
                         where a.entity = 'kyc_image' and a.entity_id = p_name and a.action = 'kyc_image.view'
                           and a.actor_user_id = (select auth.uid()) and a.occurred_at > now() - interval '1 minute') >= 10 then
    raise exception 'Ten views of your photo a minute at most. Try again shortly.' using errcode = 'RVRAT';
  end if;
  perform private.audit(v_venue_id, 'kyc_image.view', 'kyc_image', p_name);
end;
$$;
