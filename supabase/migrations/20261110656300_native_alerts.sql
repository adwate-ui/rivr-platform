-- The other pushes in the native app (#805, decision 0576). The shell's web view has no web push, so Call time ending and the
-- rest go to the phones the live status already knows, as ordinary alerts. An Android phone uses its Firebase token. An iPhone's
-- push-to-start token cannot carry an alert, so it also saves the APNs device token here.

alter table public.live_status_device
  add column alert_token text check (alert_token ~ '^[0-9a-f]{64,200}$'),
  add constraint live_status_device_alert_token_is_an_iphones check (platform = 'ios' or alert_token is null);
-- One phone's alerts reach one member: a token saved on a new row leaves the old one (below).
create unique index live_status_device_alert_token_idx on public.live_status_device (alert_token) where alert_token is not null;

insert into private.member_export_column (table_name, column_name, kind) values ('live_status_device', 'alert_token', 'withheld');

-- As in 20261104300000_live_status.sql, with the iPhone's alert token. Saving without one keeps the one held for that member:
-- iOS can give it after the push-to-start token.
drop function public.save_live_status_device(text, text, text);
drop function private.save_live_status_device(text, text, text);
create function private.save_live_status_device(p_platform text, p_token text, p_device_key text, p_alert_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
  v_presented text := private.live_status_key_hash(coalesce(p_device_key, ''));
  v_existing public.live_status_device;
  v_key text;
begin
  if v_member_id is null then
    raise exception 'Only a member has a live status' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, null, v_member_id);
  select * into v_existing from public.live_status_device d where d.push_token = p_token for update;
  if v_existing.id is not null and v_existing.member_id <> v_member_id and v_existing.device_key_hash <> v_presented then
    raise exception 'That phone is another member''s' using errcode = '42501';
  end if;
  v_key := case when v_existing.device_key_hash = v_presented then p_device_key else encode(extensions.gen_random_bytes(32), 'hex') end;
  delete from public.live_status_device d where d.device_key_hash = v_presented and d.push_token <> p_token;
  update public.live_status_device d set alert_token = null where d.alert_token = p_alert_token and d.push_token <> p_token;
  insert into public.live_status_device (venue_id, member_id, platform, push_token, device_key_hash, alert_token)
  values (v_venue_id, v_member_id, p_platform, p_token, private.live_status_key_hash(v_key), p_alert_token)
  on conflict (push_token) do update
    set venue_id = excluded.venue_id, member_id = excluded.member_id, platform = excluded.platform,
        device_key_hash = excluded.device_key_hash,
        activity_push_token = case when public.live_status_device.member_id = excluded.member_id
                                   then public.live_status_device.activity_push_token end,
        shown = case when public.live_status_device.member_id = excluded.member_id then public.live_status_device.shown end,
        alert_token = coalesce(excluded.alert_token,
                               case when public.live_status_device.member_id = excluded.member_id then public.live_status_device.alert_token end);
  delete from public.live_status_device d
  where d.member_id = v_member_id
    and d.id not in (select k.id from public.live_status_device k where k.member_id = v_member_id order by k.updated_at desc, k.id limit 5);
  return v_key;
end;
$$;
create function public.save_live_status_device(p_platform text, p_token text, p_device_key text default null, p_alert_token text default null)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.save_live_status_device(p_platform, p_token, p_device_key, p_alert_token); $$;

-- The member's phones in the native app that want this kind of push: the same gates as push_targets, for web push. An iPhone
-- that has not given its alert token yet is left out.
create function private.native_push_targets(p_venue_id uuid, p_member_id uuid, p_push_type text, p_promotion_id uuid)
returns table (device_id uuid, platform text, token text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.platform, case d.platform when 'ios' then d.alert_token else d.push_token end
  from public.live_status_device d
  join public.member m on m.id = d.member_id and m.erased_at is null
  join public.venue v on v.id = d.venue_id and not v.is_practice
  where d.venue_id = p_venue_id and d.member_id = p_member_id
    and (d.platform = 'android' or d.alert_token is not null)
    and (p_push_type is null or private.wants_push(p_member_id, p_push_type))
    and (p_promotion_id is null or exists (select 1 from private.offer_recipient(p_venue_id, p_member_id, p_promotion_id)))
  order by d.updated_at desc, d.id
  limit 5;
$$;
create function public.native_push_targets(p_venue_id uuid, p_member_id uuid, p_push_type text default null, p_promotion_id uuid default null)
returns table (device_id uuid, platform text, token text)
language sql stable security invoker set search_path = ''
as $$ select * from private.native_push_targets(p_venue_id, p_member_id, p_push_type, p_promotion_id); $$;

-- A phone Apple or Firebase no longer knows for alerts. An Android phone has one token, so it goes. An iPhone keeps its row, as its
-- push-to-start token may still be good for the live status.
create function private.forget_native_alert(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.live_status_device d set alert_token = null where d.id = p_device_id and d.platform = 'ios';
  delete from public.live_status_device d where d.id = p_device_id and d.platform = 'android';
end;
$$;
create function public.forget_native_alert(p_device_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.forget_native_alert(p_device_id); $$;
revoke execute on function private.forget_native_alert(uuid), public.forget_native_alert(uuid) from public, anon, authenticated;
grant execute on function private.forget_native_alert(uuid), public.forget_native_alert(uuid) to service_role;

revoke execute on function private.save_live_status_device(text, text, text, text), public.save_live_status_device(text, text, text, text) from public, anon;
grant execute on function private.save_live_status_device(text, text, text, text), public.save_live_status_device(text, text, text, text) to authenticated;
revoke execute on function private.native_push_targets(uuid, uuid, text, uuid), public.native_push_targets(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.native_push_targets(uuid, uuid, text, uuid), public.native_push_targets(uuid, uuid, text, uuid) to service_role;

-- pg_cron runs the consumer every minute with the scheduler's secret (decision 0038).
select private.schedule_outbox_consumer('native-push');

-- The practice reset reloads this table, and it has a new column.
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
