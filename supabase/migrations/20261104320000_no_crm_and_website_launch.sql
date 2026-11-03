-- The owner's answers of 3 Nov (decision 0308):
-- - No CRM (#797, answering #658): the HubSpot sync goes. Its consumer is no longer run, the contact it read and the
--   queue that fed it are dropped, and nothing now sends member.answers_saved or member.erased, which only the CRM took.
--   The privacy notice no longer names HubSpot.
-- - Rake is allowed (#794, answering #624): "Is poker legal in Gurugram?" is published.
-- - No Academy for now (#795, answering #724): the Academy page is unpublished (it is in no menu, and no page links to it),
--   and the links page no longer offers "Book RIVR Academy".
-- Each website change applies only while the page reads as the website came with it, so a club's own words stay.

select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'outbox-crm-sync';
drop trigger member_answers_saved on public.member_preference;
drop trigger member_answers_changed on public.member_preference;
drop function private.emit_member_answers_saved();
drop function public.crm_contact(uuid, jsonb);
drop function private.crm_contact(uuid, jsonb);
drop function public.queue_crm_sync(integer);
drop function private.queue_crm_sync(integer);

-- As in 20261101100600_erasure_locked_points_and_crm.sql, without telling a CRM.
create or replace function private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
returns table (venue_id uuid, forfeited_points bigint, forfeited_bonus_paise bigint, blocked_until timestamptz, forfeited_nights bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.erase') then
    raise exception 'Only a super admin erases a member' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('member-erase:' || v_member.venue_id::text));
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.erased_at is not null then
    raise exception 'This member was erased already' using errcode = 'RVERD';
  end if;
  if btrim(coalesce(p_full_name, '')) is distinct from v_member.full_name then
    raise exception 'Type the member''s full name exactly to erase them' using errcode = 'RVNAM';
  end if;
  if not private.is_safe_erasure_reason(v_reason, v_member.full_name) then
    raise exception 'Give a reason of 3 to 300 characters with nothing of the person in it' using errcode = '22023';
  end if;
  if (select count(*) from public.audit_log a
      where a.venue_id = v_member.venue_id and a.action = 'member.erase' and a.occurred_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten members were erased in the last hour: wait before erasing another' using errcode = 'RVRAT';
  end if;
  v_summary := private.carry_out_erasure(p_member_id, v_reason);
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'points')::bigint, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz, coalesce((v_summary ->> 'nights_thousandths')::bigint, 0);
end;
$$;

-- The website at launch: the privacy notice without HubSpot, the legality article published, the Academy page not.
create function private.website_launch_answers(p_venue_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.site_block b
  set content = jsonb_set(b.content, '{body}', to_jsonb(replace(b.content ->> 'body',
    ' HubSpot holds the club''s member list for its team: your name, phone, city, membership and how you play at the club.', '')))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'privacy' and b.kind = 'text'
    and strpos(b.content ->> 'body', ' HubSpot holds the club''s member list for its team: your name, phone, city, membership and how you play at the club.') > 0;
  update public.site_page set is_published = true
  where venue_id = p_venue_id and slug = 'journal-poker-legal-gurugram' and not is_published;
  update public.site_page set is_published = false
  where venue_id = p_venue_id and slug = 'academy' and is_published;
  -- The links page loses "Book RIVR Academy", the player app's Academy being off too (Learn and Events are, #651).
  update public.site_block b
  set content = jsonb_set(b.content, '{links}', (select coalesce(jsonb_agg(x.link order by x.place), '[]'::jsonb)
                                                 from jsonb_array_elements(b.content -> 'links') with ordinality as x (link, place)
                                                 where x.link ->> 'to' is distinct from 'academy'))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'links' and b.kind = 'links'
    and b.content -> 'links' @> '[{"to": "academy"}]';
$$;
revoke execute on function private.website_launch_answers(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261102090200_website_analytics_consent.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_analytics_consent;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_analytics_consent(p_venue_id);
  perform private.website_launch_answers(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_analytics_consent(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_launch_answers(v.id) from public.venue v where not v.is_practice;
