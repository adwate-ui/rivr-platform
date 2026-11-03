-- A member's views of their own KYC selfie, ten a minute at most (#744; the security review of the card selfie, decision
-- 0300). A verified member could call kyc-image-url in a loop for their own selfie, and each call wrote an audit row and
-- had the service role sign a URL. The card asks again only as its one-minute link runs out, so ten a minute is far above
-- any real use. The audit log's own rows count the views; staff views are not capped. Refusal: RVRAT.

-- authorize_kyc_image, as 20261102110200_own_photo_on_card.sql made it, with the cap.
create or replace function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
  v_is_staff boolean := private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact');
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]+\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_name)
     or not (v_is_staff
             or exists (select 1 from public.kyc_record k
                        where k.member_id = private.current_member_id() and k.venue_id = v_venue_id
                          and k.status = 'verified' and k.photo_path = p_name)) then
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
