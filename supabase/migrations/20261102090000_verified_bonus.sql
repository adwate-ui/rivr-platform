-- The pre-registration bonus (owner, 2 Nov; decision 0298). Till launch, a member who signs up and whose identity check
-- is verified gets bonus points they can spend at once. The club sets how many in Settings (points.verified_bonus);
-- a 0 from 15 November 00:00 IST, set here, ends it at launch unless the club sets it again. Points are otherwise given
-- by hand (#629): this is the one bonus the owner asked to be automatic.
--
-- The points are credited once a member, keyed by the member, whichever path verifies them (DigiLocker, PAN, the
-- front desk, a recheck), and never at the practice venue. A member verified again after a recheck gets nothing more,
-- even if the club changed the number in between.

insert into public.setting_key (key, description, scope, value_schema) values
  ('points.verified_bonus',
   'Points a member gets once, when their identity check is verified (the pre-registration bonus); none set, or 0, gives none.',
   'venue',
   '{"type":"object","properties":{"points":{"type":"integer","minimum":0,"maximum":10000}},"required":["points"],"additionalProperties":false}');

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.id, 'points.verified_bonus', '', '{"points": 0}'::jsonb, '2026-11-15T00:00:00+05:30',
       'The pre-registration bonus ends at launch (owner, 2 Nov)'
from public.venue v
where not v.is_practice
on conflict (venue_id, key, subject, effective_from) do nothing;

create function private.give_verified_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key constant text := 'verified_bonus:' || new.member_id;
  v_points bigint;
begin
  if exists (select 1 from public.venue v where v.id = new.venue_id and v.is_practice)
     or exists (select 1 from public.ledger_transaction t where t.venue_id = new.venue_id and t.idempotency_key = v_key) then
    return new;
  end if;
  v_points := coalesce((private.setting_at(new.venue_id, 'points.verified_bonus', '', now()) ->> 'points')::bigint, 0);
  if v_points > 0 then
    perform private.credit_points(new.venue_id, new.member_id, v_points, 'Bonus on verification', v_key);
  end if;
  return new;
end;
$$;

revoke execute on function private.give_verified_bonus() from public, anon, authenticated;

create trigger kyc_record_verified_bonus
  after insert or update of status on public.kyc_record
  for each row
  when (new.status = 'verified')
  execute function private.give_verified_bonus();
