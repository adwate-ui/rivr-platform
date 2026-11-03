-- Where a version shows (console v3 phase 7; owner's decisions 2 and 4): the player app's cards (with promotions.feed),
-- the TVs, the website (never the practice venue) and the WhatsApp offer, each only on its version's channel. A cab home
-- shows nowhere while no tier offers cab requests. An offer goes out only through the outbox, which never claims a
-- practice venue's events. 212 Vihaan has promotions.feed and opts in to marketing; 301 Asha is the practice venue's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The seed's live promotions back to drafts (decision 0491): only this test's own show.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

-- A version put live as an approval does, on the channels given: the promotion goes live and is announced.
create function pg_temp.live(p_venue uuid, p_name text, p_reward jsonb, p_channels jsonb) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values (p_venue, p_name) returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels, detail, runs)
  values (p_venue, v_promotion, 1, 'live', p_name, p_reward, '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                             'timezone', 'Asia/Kolkata'),
          '{"perMember": "per_day"}', p_channels, p_name || ' for everyone', 'Every day');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
create temporary table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;
insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'marketing') on conflict do nothing;

insert into ids select 'app', pg_temp.live('00000000-0000-4000-8000-000000000001', 'App and TVs', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}',
  '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}');
insert into ids select 'web', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Website only', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}',
  '{"playerApp": false, "tv": false, "website": true, "whatsapp": false}');
insert into ids select 'whatsapp', pg_temp.live('00000000-0000-4000-8000-000000000001', 'On WhatsApp', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}',
  '{"playerApp": false, "tv": false, "website": false, "whatsapp": true}');
insert into ids select 'cab', pg_temp.live('00000000-0000-4000-8000-000000000001', 'Cab home', '{"kind": "cab_home", "fromVisitInMonth": 4}',
  '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}');
insert into ids select 'practice', pg_temp.live('00000000-0000-4000-8000-000000000002', 'Practice offer', '{"kind": "bonus_chips", "chips": 100, "on": "visit"}',
  '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}');

-- Each channel shows its own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select title from public.my_promotion_cards() order by title $$, $$ values ('App and TVs'::text) $$,
  'Home shows only the version on the player app, and no cab home while cab requests are off');
reset role;
select results_eq($$ select c.title from private.promotion_cards('00000000-0000-4000-8000-000000000001') c
                     where private.promotion_shows_on(c.promotion_id, 'tv') order by c.title $$,
  $$ values ('App and TVs'::text) $$, 'the TVs show only the version on the TVs');
set local role anon;
select results_eq($$ select title from public.public_promotion_cards order by title $$, $$ values ('Website only'::text) $$,
  'the website shows only the version on the website, and never the practice venue''s');
reset role;

-- WhatsApp: offered only for the version on WhatsApp, and never claimed from the practice venue.
select is((select count(*)::integer from public.outbox_event where event_type = 'promotion.offered'
           and payload ->> 'promotion_id' = (select id::text from ids where name = 'whatsapp')), 1, 'the version on WhatsApp is offered to Vihaan');
select is((select count(*)::integer from public.outbox_event where event_type = 'promotion.offered'
           and payload ->> 'promotion_id' in (select id::text from ids where name in ('app', 'web', 'cab'))), 0, 'the others to nobody');
select is_empty($$ select * from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212',
                   (select id from ids where name = 'app')) $$, 'nor sent at send time');
select isnt_empty($$ select * from public.offer_recipient('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212',
                    (select id from ids where name = 'whatsapp')) $$, 'which the version on WhatsApp is');
select is_empty($$ select * from public.claim_outbox_deliveries('whatsapp', array['promotion.offered'], true, 100)
                   where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'no practice venue offer is ever claimed for sending');

-- A cab home shows once a tier offers cab requests.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, 'cab.requests', true, 'locked', now() from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select title from public.my_promotion_cards() order by title $$, $$ values ('App and TVs'::text), ('Cab home') $$,
  'with cab requests on, the cab home shows');
reset role;

-- Paused, a version leaves every channel.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.set_promotion_version_live(v.id, false) from public.promotion_version v where v.promotion_id = (select id from ids where name = 'app');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select results_eq($$ select title from public.my_promotion_cards() order by title $$, $$ values ('Cab home'::text) $$, 'paused, it leaves Home');
reset role;

select * from finish();
rollback;
