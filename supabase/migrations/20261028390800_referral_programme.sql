-- The referral programme (#151; scope-v1 module 7). A member's code is RIVR and their member number: RIVR1042. A new
-- member who signed up with it (the ?ref= of the link they opened, sign_up_attribution) completes the referral with
-- their first buy-in, and the referral promotion credits each side: ₹1,000 of bonus each, from the template, while
-- the owner runs it, within its budget and limits. One referral to a new member; never their own code, an erased
-- member's, or the practice venue's.
create table public.referral (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The new member, whose referral it is.
  member_id uuid not null unique,
  referrer_member_id uuid not null,
  code text not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (referrer_member_id, venue_id) references public.member (id, venue_id),
  check (member_id <> referrer_member_id)
);

comment on table public.referral is 'A completed referral (#151): the new member, who referred them, and the code, from their first buy-in.';

create index referral_referrer_idx on public.referral (referrer_member_id, venue_id);
create index referral_member_idx on public.referral (member_id, venue_id);

create trigger referral_touch_updated_at before update on public.referral
  for each row execute function private.touch_updated_at();
create trigger referral_audit after insert or update or delete on public.referral
  for each row execute function private.audit_row_change();

alter table public.referral enable row level security;
grant select (id, venue_id, member_id, referrer_member_id, code, completed_at, created_at, updated_at) on public.referral to authenticated;
create policy "staff who read members see the venue's referrals" on public.referral
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));
create policy "members see their own referral" on public.referral
  for select to authenticated using (member_id = (select private.current_member_id()));

-- A member's export gives their referral; who referred them is another member.
insert into private.member_export_column (table_name, column_name, kind)
select 'referral', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'code', 'completed_at', 'created_at', 'updated_at']) c (column_name);
insert into private.member_export_column (table_name, column_name, kind) values ('referral', 'referrer_member_id', 'other');

-- A member's code: RIVR and their member number.
create function private.referral_code(p_member_number bigint)
returns text
language sql
immutable
set search_path = ''
as $$ select 'RIVR' || p_member_number::text; $$;

-- The signed-in member's code and how many they have referred, for Rewards.
create function private.my_referral()
returns table (code text, referred integer)
language sql
stable
security definer
set search_path = ''
as $$
  select private.referral_code(m.member_number), (select count(*)::integer from public.referral r where r.referrer_member_id = m.id)
  from public.member m
  where m.id = private.current_member_id() and m.erased_at is null;
$$;

create function public.my_referral()
returns table (code text, referred integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_referral(); $$;

-- Completes the referral a member signed up with, on their first buy-in: who referred them, once, then the referral
-- promotion for each side, each with its own key.
create function private.complete_referral(p_venue_id uuid, p_member_id uuid, p_cage_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer public.member;
  v_code text;
  v_id uuid;
begin
  if (select v.is_practice from public.venue v where v.id = p_venue_id)
     or exists (select 1 from public.cage_transaction c
                where c.member_id = p_member_id and c.kind = 'buy_in' and c.id <> p_cage_transaction_id) then
    return;
  end if;
  select upper(btrim(a.referral_code)) into v_code from public.sign_up_attribution a where a.member_id = p_member_id;
  select m.* into v_referrer from public.member m
  where m.venue_id = p_venue_id and m.id <> p_member_id and m.erased_at is null and private.referral_code(m.member_number) = v_code;
  if v_referrer.id is null then
    return;
  end if;
  insert into public.referral (venue_id, member_id, referrer_member_id, code)
  values (p_venue_id, p_member_id, v_referrer.id, v_code)
  on conflict (member_id) do nothing
  returning id into v_id;
  if v_id is null then
    return;
  end if;
  perform private.evaluate_promotions(p_venue_id, 'referral', jsonb_build_object('member_id', p_member_id, 'key', 'referral:' || v_id || ':joined'));
  perform private.evaluate_promotions(p_venue_id, 'referral', jsonb_build_object('member_id', v_referrer.id, 'key', 'referral:' || v_id || ':referred'));
  perform private.emit(p_venue_id, 'referral.completed',
                       jsonb_build_object('referral_id', v_id, 'member_id', p_member_id, 'referrer_member_id', v_referrer.id),
                       'referral.completed:' || v_id);
end;
$$;

-- As before (20261021130000_practice_reset.sql), with the referral a first buy-in completes.
create or replace function private.buy_in_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  perform private.complete_referral(new.venue_id, new.member_id, new.id);
  perform private.evaluate_promotions(new.venue_id, 'buy_in', jsonb_build_object(
    'member_id', new.member_id, 'key', 'buy_in:' || new.id, 'amount_paise', new.amount_paise, 'method', new.method,
    'table_id', (select s.table_id from public.seat_session s where s.id = new.session_id)));
  return null;
end;
$$;

revoke execute on function private.complete_referral(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function private.my_referral(), public.my_referral() from public, anon;
grant execute on function private.my_referral(), public.my_referral() to authenticated;
