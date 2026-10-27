-- Creators (#163; scope-v1 "Growth"). Each creator has a code; a link carrying ?creator=<code> credits a sign-up to
-- them, first touch (sign_up_attribution.creator_code, #10). A creator's dashboard counts the members who signed up
-- with their code and how many finished KYC, came in and bought in, and what they are owed: their commission, in
-- paise, on each member who reached the stage it is paid on. Staff who run promotions keep creators.
create table public.creator (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  code public.attribution_code not null check (code ~ '^[A-Za-z0-9_.+-]{2,32}$'),
  commission_basis text not null check (commission_basis in ('kyc', 'first_visit', 'first_buy_in')),
  commission_paise bigint not null check (commission_paise >= 0 and commission_paise % 100 = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);
comment on table public.creator is 'A creator''s code and commission (#163): what a sign-up with their code earns them.';
create unique index creator_code_idx on public.creator (venue_id, lower(code));
create trigger creator_touch_updated_at before update on public.creator
  for each row execute function private.touch_updated_at();
create trigger creator_audit after insert or update or delete on public.creator
  for each row execute function private.audit_row_change();
alter table public.creator enable row level security;
grant select on public.creator to authenticated;
create policy "staff who run promotions see the venue's creators" on public.creator
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));

-- Adds a creator. Refusals: 42501 not staff who run promotions; 22023 a name, code, basis or commission out of
-- bounds; 23505 a code the venue already gives another creator; RVFRZ the venue frozen.
create function private.save_creator(p_venue_id uuid, p_name text, p_code text, p_basis text, p_commission_paise bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions keep the creators' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.creator (venue_id, name, code, commission_basis, commission_paise)
  values (p_venue_id, btrim(coalesce(p_name, '')), btrim(coalesce(p_code, '')), p_basis, p_commission_paise)
  returning id into v_id;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'A name, a code of 2 to 32 letters or digits, a basis and a commission in whole rupees' using errcode = '22023';
end;
$$;

-- Each creator with the members who signed up with their code (erased members are no longer counted) and how many
-- finished KYC, came in and bought in; and what they are owed, their commission on each at their basis.
create function private.creator_dashboard(p_venue_id uuid)
returns table (creator_id uuid, name text, code text, commission_basis text, commission_paise bigint, signed_up integer, kyc_done integer,
               visited integer, bought_in integer, owed_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions read the creators' using errcode = '42501';
  end if;
  return query
  with reached as (
    select c.id, count(m.id)::integer as signed_up,
           (count(m.id) filter (where exists (select 1 from public.kyc_record k where k.member_id = m.id and k.status = 'verified')))::integer as kyc_done,
           (count(m.id) filter (where exists (select 1 from public.visit v where v.member_id = m.id)))::integer as visited,
           (count(m.id) filter (where exists (select 1 from public.cage_transaction t where t.member_id = m.id and t.kind = 'buy_in')))::integer
             as bought_in
    from public.creator c
    left join public.sign_up_attribution a on a.venue_id = c.venue_id and lower(a.creator_code) = lower(c.code)
    left join public.member m on m.id = a.member_id and m.erased_at is null
    where c.venue_id = p_venue_id
    group by c.id
  )
  select c.id, c.name, c.code::text, c.commission_basis, c.commission_paise, r.signed_up, r.kyc_done, r.visited, r.bought_in,
         c.commission_paise * case c.commission_basis when 'kyc' then r.kyc_done when 'first_visit' then r.visited else r.bought_in end
  from public.creator c join reached r on r.id = c.id
  order by c.name, c.code;
end;
$$;

create function public.save_creator(p_venue_id uuid, p_name text, p_code text, p_basis text, p_commission_paise bigint)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_creator(p_venue_id, p_name, p_code, p_basis, p_commission_paise); $$;
create function public.creator_dashboard(p_venue_id uuid)
returns table (creator_id uuid, name text, code text, commission_basis text, commission_paise bigint, signed_up integer, kyc_done integer,
               visited integer, bought_in integer, owed_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.creator_dashboard(p_venue_id); $$;

revoke execute on function private.save_creator(uuid, text, text, text, bigint), private.creator_dashboard(uuid),
  public.save_creator(uuid, text, text, text, bigint), public.creator_dashboard(uuid) from public, anon;
grant execute on function private.save_creator(uuid, text, text, text, bigint), private.creator_dashboard(uuid),
  public.save_creator(uuid, text, text, text, bigint), public.creator_dashboard(uuid) to authenticated;
