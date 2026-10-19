-- When a sign-in code last went to a number (#181), so a second code within ten minutes goes by SMS:
-- Meta accepts a code for a number not on WhatsApp and reports the failure only later. Kept as an
-- HMAC of the number, under a key in Vault, and the time; never the code, never the number.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sign_in_send_key',
                           'HMAC key for private.sign_in_code_send.phone_hash');

create table private.sign_in_code_send (
  phone_hash text primary key,
  sent_at timestamptz not null
);

comment on table private.sign_in_code_send is 'When a sign-in code last went to a number, by a keyed hash of the number only.';

-- No venue and no policies (decision 0042): a sign-in belongs to no venue, and only the function
-- below, running as its owner, ever reads or writes it.
alter table private.sign_in_code_send enable row level security;
revoke all on table private.sign_in_code_send from public, anon, authenticated, service_role;

-- Notes a code going to `p_phone` now, and says whether one went there in the last ten minutes.
-- Rows older than a day are dropped as it goes: nothing older is ever asked about.
create function private.note_sign_in_code_send(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'sign_in_send_key');
  v_hash text;
  v_last timestamptz;
begin
  if v_key is null then
    raise exception 'The sign-in send key is missing from Vault';
  end if;
  v_hash := encode(extensions.hmac(convert_to(p_phone, 'UTF8'), decode(v_key, 'hex'), 'sha256'), 'hex');
  delete from private.sign_in_code_send where sent_at < now() - interval '1 day';
  select s.sent_at into v_last from private.sign_in_code_send s where s.phone_hash = v_hash for update;
  insert into private.sign_in_code_send (phone_hash, sent_at) values (v_hash, now())
  on conflict (phone_hash) do update set sent_at = excluded.sent_at;
  return v_last is not null and v_last > now() - interval '10 minutes';
end;
$$;

revoke execute on function private.note_sign_in_code_send(text) from public;
grant execute on function private.note_sign_in_code_send(text) to service_role;

-- The auth-send-code function calls this with the service role; nobody else may.
create function public.note_sign_in_code_send(p_phone text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.note_sign_in_code_send(p_phone);
$$;

revoke execute on function public.note_sign_in_code_send(text) from public;
grant execute on function public.note_sign_in_code_send(text) to service_role;
