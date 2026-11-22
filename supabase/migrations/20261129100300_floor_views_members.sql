-- The floor sees everything in Members, to view (the owner, 22 Nov): the mobile column, the selfie, the tier and break,
-- and the account's details. Staff who read mobiles (members.phone: super admins, admins and the floor) see them; editing
-- stays with the permissions that had it. A member's PAN and Aadhaar photos, date of birth and address stay with super
-- admins (9 Nov), as before.

-- The list's mobile column, its search by any digits, and the record's number.
create or replace function private.members_page_json(p_venue_id uuid, p_view jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_reads boolean := coalesce(private.has_permission(p_venue_id, 'members.read'), false);
  v_sees_phone boolean := coalesce(private.has_permission(p_venue_id, 'members.phone'), false);
  v_sees_identity boolean := coalesce(private.is_super_admin(p_venue_id), false);
  v_size integer := least(greatest(coalesce((v_view ->> 'page_size')::integer, 50), 1), 1000);
  v_page integer := greatest(coalesce((v_view ->> 'page')::integer, 1), 1);
  v_list record;
  v_total bigint;
  v_rows jsonb;
begin
  select * into v_list from private.members_list_sql(v_view, v_sees_phone);
  execute 'select count(*) from public.member m' || v_list.o_joins || ' where $2 and ' || v_list.o_where into v_total using p_venue_id, v_reads;
  execute
    'select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from (
       select listed.place, m.id as member_id, m.member_number, m.full_name, case when $4 then m.phone end as phone, right(m.phone, 4) as phone_last4,
              t.name as tier_name, ' || private.members_column_sql('visits') || ' as visits,
              (select max(v.opened_at) from public.visit v where v.member_id = m.id) as last_visit_at,
              ' || private.members_column_sql('kyc') || ' as kyc_status,
              ' || private.members_column_sql('played') || ' as minutes_played,
              pr.city, m.created_at as member_since, m.known_as, m.referral_code as own_referral_code, pr.occupation,
              coalesce(pr.play_times, ''{}'') as play_times, coalesce(pr.games_played, ''{}'') as games_played,
              sa.referral_code, sa.creator_code, sa.utm_source, sa.utm_medium, sa.utm_campaign, sa.utm_content, sa.utm_term, sa.first_seen_at,
              case when k.verified_at is not null then k.method end as kyc_method, k.verified_at as kyc_verified_at,
              case when $6 and m.erased_at is null then k.date_of_birth end as date_of_birth,
              case when $6 and m.erased_at is null then k.pan end as pan,
              case when $6 and m.erased_at is null then k.masked_aadhaar end as masked_aadhaar,
              case when $6 and m.erased_at is null then k.aadhaar_name end as aadhaar_name,
              case when $6 and m.erased_at is null then k.address end as address,
              ' || private.members_column_sql('bonus') || ' as bonus_paise
       from unnest(array(select m.id from public.member m' || v_list.o_joins || ' where $5 and ' || v_list.o_where
                        || ' order by ' || v_list.o_order || ' limit $2 offset $3)) with ordinality as listed(id, place)
       join public.member m on m.id = listed.id
       join public.tier t on t.id = m.tier_id
       left join public.kyc_record k on k.member_id = m.id
       left join public.member_preference pr on pr.member_id = m.id
       left join public.sign_up_attribution sa on sa.member_id = m.id) r'
    into v_rows using p_venue_id, v_size, (v_page - 1)::bigint * v_size, v_sees_phone, v_reads, v_sees_identity;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create or replace function private.members_choices_json(p_venue_id uuid, p_view jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_reads boolean := coalesce(private.has_permission(p_venue_id, 'members.read'), false);
  v_sees_phone boolean := coalesce(private.has_permission(p_venue_id, 'members.phone'), false);
  v_key text;
  v_list record;
  v_counted jsonb;
  v_all jsonb := '[]'::jsonb;
begin
  foreach v_key in array array['status', 'kyc', 'city', 'tonight'] loop
    -- Sorted by the column, the list joins what the column reads; without the column's own filter.
    select * into v_list from private.members_list_sql(
      v_view || jsonb_build_object('sort', jsonb_build_object('key', v_key),
                                   'filters', case when jsonb_typeof(v_view -> 'filters') = 'object' then (v_view -> 'filters') - v_key else '{}'::jsonb end),
      v_sees_phone);
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(top)), ''[]''::jsonb)
       from (select %L::text as column_key, counted.value, counted.members
             from (select (%s)::text as value, count(*) as members from public.member m%s where $2 and %s group by 1) counted
             where counted.value is not null order by counted.members desc, counted.value limit 200) top',
      v_key, private.members_column_sql(v_key), v_list.o_joins, v_list.o_where)
      into v_counted using p_venue_id, v_reads;
    v_all := v_all || v_counted;
  end loop;
  return v_all;
end;
$$;

create or replace function private.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text,
               tier_until date, qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean,
               photo_path text, visits integer, last_visit_at timestamptz, is_in_room boolean, early_departures integer,
               known_as text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name,
         case when private.has_permission(p_venue_id, 'members.phone') then m.phone end,
         t.id, t.name,
         (select ((c.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date from public.member_tier_change c
          where c.member_id = m.id and not c.is_expiry and (c.ends_at is null or c.ends_at > now()) order by c.created_at desc limit 1),
         m.qualifying_small_blind, m.qualifying_big_blind, private.is_kyc_complete(m.id),
         coalesce(k.photo_path,
                  case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                       then m.venue_id || '/' || m.id || '/photo.jpg' end),
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         private.current_visit(m.id) is not null,
         (select count(*)::integer from public.early_departure e where e.member_id = m.id
            and not exists (select 1 from public.early_departure_withdrawal w where w.early_departure_id = e.id)),
         m.known_as
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;

-- The record's photo: staff who read mobiles see a member's selfie and the desk's photo too. ID document photos stay
-- with super admins, checked first.
create or replace function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
  v_is_staff boolean := private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact')
                        or private.has_permission(v_venue_id, 'members.phone')
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

-- The account's feature overrides, on the record: read by staff who read mobiles too; set and lifted by super admins only,
-- as before, and the table itself still shows a venue's to super admins alone.
create or replace function private.member_feature_overrides(p_venue_id uuid, p_member_id uuid)
returns table (override_id uuid, feature_key text, feature_name text, is_granted boolean, reason text, until date, standing text,
               created_at timestamptz, staff_name text, lifted_by text, lift_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.feature_key, f.name, o.is_granted, o.reason,
         case when o.ends_at is null then null else ((o.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date end,
         case when o.lift_reason is not null then 'lifted' when o.revoked_at is not null then 'replaced'
              when o.ends_at is not null and o.ends_at <= now() then 'ended' else 'in_force' end,
         o.created_at, s.full_name, l.full_name, o.lift_reason
  from public.member_feature_override o
  join public.feature f on f.key = o.feature_key
  left join public.staff s on s.id = o.created_by_staff_id
  left join public.staff l on l.id = o.lifted_by_staff_id
  where o.member_id = p_member_id and o.venue_id = p_venue_id
    and (private.has_permission(p_venue_id, 'members.override_features') or private.has_permission(p_venue_id, 'members.phone'))
  order by o.created_at desc;
$$;
