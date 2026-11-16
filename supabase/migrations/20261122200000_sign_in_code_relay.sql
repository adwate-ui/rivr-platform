-- Sign-in codes by Message Central's VerifyNow (decision 0679). VerifyNow texts the member a code of its own,
-- so Auth's code goes nowhere: the Send SMS hook (auth-send-code) keeps it here, encrypted, with VerifyNow's
-- check, and sign-in-verify gives it back once VerifyNow accepts the code the member typed. Kept by a keyed
-- hash of the number, as private.sign_in_code_send is; never the number, never a code in the clear.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sign_in_code_key',
                           'Encrypts Auth''s sign-in codes in private.sign_in_code_relay');

create table private.sign_in_code_relay (
  phone_hash text primary key,
  verification_id text not null,
  code_secret bytea not null,
  tries smallint not null default 0,
  sent_at timestamptz not null default now(),
  -- Once VerifyNow accepted a code: when, and the accepted code's keyed hash. The same code gets Auth's
  -- again for two minutes, should the app's sign-in with it fail (Auth's limit, a dropped connection).
  taken_at timestamptz,
  accepted_hash text
);

comment on table private.sign_in_code_relay is
  'Auth''s sign-in code for a number, encrypted, until VerifyNow accepts the code it texted (decision 0679).';

-- Every check sign-in-verify asks of the database, by a keyed hash of the caller's address: 30 in five
-- minutes, as Auth allows code checks from one address, so nobody can use up members' tries from one place.
create table private.sign_in_check (
  client text not null,
  checked_at timestamptz not null default now()
);

create index sign_in_check_client_idx on private.sign_in_check (client, checked_at);
create index sign_in_check_checked_at_idx on private.sign_in_check (checked_at);

comment on table private.sign_in_check is 'Sign-in code checks by the caller''s address, for its limit (decision 0679).';

-- No venue and no policies (decision 0042): a sign-in belongs to no venue, and only the functions
-- below, running as their owner, ever read or write these.
alter table private.sign_in_code_relay enable row level security;
alter table private.sign_in_check enable row level security;
revoke all on table private.sign_in_code_relay, private.sign_in_check from public, anon, authenticated, service_role;

-- A keyed hash, under the key private.note_sign_in_code_send hashes numbers with.
create function private.sign_in_hash(p_text text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'sign_in_send_key');
begin
  if v_key is null then
    raise exception 'The sign-in send key is missing from Vault';
  end if;
  return encode(extensions.hmac(convert_to(p_text, 'UTF8'), decode(v_key, 'hex'), 'sha256'), 'hex');
end;
$$;

-- The key Auth's codes are encrypted under.
create function private.sign_in_code_key()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'sign_in_code_key');
begin
  if v_key is null then
    raise exception 'The sign-in code key is missing from Vault';
  end if;
  return v_key;
end;
$$;

revoke execute on function private.sign_in_hash(text), private.sign_in_code_key() from public;

-- Keeps Auth's code for p_phone with VerifyNow's check p_verification_id, in place of anything kept
-- before. With no check, VerifyNow's last code to the number still stands: Auth's new code replaces
-- the old under that check, while it can still be tried. False when it cannot. Rows over an hour old
-- go as it runs. The send is noted as auth-send-code notes one by WhatsApp, so the hourly code
-- limit's alert still knows codes are going out (raise_sms_limit_alert).
create function private.keep_sign_in_code(p_phone text, p_code text, p_verification_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := private.sign_in_hash(p_phone);
  v_secret bytea := extensions.pgp_sym_encrypt(p_code, private.sign_in_code_key());
begin
  perform private.note_sign_in_code_send(p_phone);
  delete from private.sign_in_code_relay r where r.sent_at < now() - interval '1 hour';
  if p_verification_id is null then
    update private.sign_in_code_relay r set code_secret = v_secret
    where r.phone_hash = v_hash and r.sent_at > now() - interval '10 minutes' and r.tries < 5 and r.taken_at is null;
    return found;
  end if;
  insert into private.sign_in_code_relay (phone_hash, verification_id, code_secret)
  values (v_hash, p_verification_id, v_secret)
  on conflict (phone_hash) do update
    set verification_id = excluded.verification_id, code_secret = excluded.code_secret, tries = 0, sent_at = now(),
        taken_at = null, accepted_hash = null;
  return true;
end;
$$;

-- An alert for the owner when an address reaches the limit: at most one every 15 minutes.
create function private.raise_sign_in_guess_alert()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1);
begin
  if v_venue_id is null or exists (select 1 from public.alert a where a.venue_id = v_venue_id
                                   and a.kind = 'auth.sign_in_guessed' and a.raised_at > now() - interval '15 minutes') then
    return;
  end if;
  perform private.raise_alert(v_venue_id, 'auth.sign_in_guessed',
          jsonb_build_object('note', 'Many sign-in codes were tried from one address: its tries are paused for up to five minutes.'));
end;
$$;

-- Counts a try at p_phone's code, typed as p_code from p_client, and says what to do with it:
--   verification_id: ask VerifyNow about the code under this check;
--   auth_code: VerifyNow accepted this very code in the last two minutes, so Auth's code again;
--   refusal 'too_many': the address has tried 30 times in five minutes;
--   nothing: no check waits for the number (VerifyNow sent it no code, or its tries or time ran out).
-- Five tries per code sent, within ten minutes, the two minutes after it was accepted included.
create function private.sign_in_code_attempt(p_phone text, p_code text, p_client text)
returns table (verification_id text, auth_code text, refusal text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client text := private.sign_in_hash(private.pairing_client(p_client));
  v_hash text := private.sign_in_hash(p_phone);
  v_row private.sign_in_code_relay;
begin
  -- One check at a time from an address, so the limit holds under a burst.
  perform pg_advisory_xact_lock(hashtext('sign-in-check:' || v_client));
  delete from private.sign_in_check c where c.checked_at < now() - interval '1 hour';
  if (select count(*) from private.sign_in_check c where c.client = v_client and c.checked_at > now() - interval '5 minutes') >= 30 then
    perform private.raise_sign_in_guess_alert();
    return query select null::text, null::text, 'too_many'::text;
    return;
  end if;
  insert into private.sign_in_check (client) values (v_client);
  update private.sign_in_code_relay r set tries = r.tries + 1
  where r.phone_hash = v_hash and r.tries < 5 and r.sent_at > now() - interval '10 minutes'
    and (r.taken_at is null or r.taken_at > now() - interval '2 minutes')
  returning r.* into v_row;
  if v_row.phone_hash is null then
    delete from private.sign_in_code_relay r where r.phone_hash = v_hash;
    return query select null::text, null::text, null::text;
  elsif v_row.taken_at is null then
    return query select v_row.verification_id, null::text, null::text;
  else
    return query select null::text,
      case when v_row.accepted_hash = private.sign_in_hash(p_code)
           then extensions.pgp_sym_decrypt(v_row.code_secret, private.sign_in_code_key()) end,
      null::text;
  end if;
end;
$$;

-- Auth's code for p_phone, once VerifyNow has accepted p_code under p_verification_id; null when the
-- number's check is another (a new code was sent meanwhile), or was accepted already.
create function private.take_sign_in_code(p_phone text, p_verification_id text, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  update private.sign_in_code_relay r set taken_at = now(), accepted_hash = private.sign_in_hash(p_code)
  where r.phone_hash = private.sign_in_hash(p_phone) and r.verification_id = p_verification_id
    and r.taken_at is null and r.sent_at > now() - interval '10 minutes'
  returning extensions.pgp_sym_decrypt(r.code_secret, private.sign_in_code_key()) into v_code;
  return v_code;
end;
$$;

revoke execute on function private.keep_sign_in_code(text, text, text), private.sign_in_code_attempt(text, text, text),
  private.take_sign_in_code(text, text, text), private.raise_sign_in_guess_alert() from public;
grant execute on function private.keep_sign_in_code(text, text, text), private.sign_in_code_attempt(text, text, text),
  private.take_sign_in_code(text, text, text) to service_role;

-- auth-send-code and sign-in-verify call these with the service role; nobody else may.
create function public.keep_sign_in_code(p_phone text, p_code text, p_verification_id text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.keep_sign_in_code(p_phone, p_code, p_verification_id);
$$;

create function public.sign_in_code_attempt(p_phone text, p_code text, p_client text)
returns table (verification_id text, auth_code text, refusal text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.sign_in_code_attempt(p_phone, p_code, p_client);
$$;

create function public.take_sign_in_code(p_phone text, p_verification_id text, p_code text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.take_sign_in_code(p_phone, p_verification_id, p_code);
$$;

revoke execute on function public.keep_sign_in_code(text, text, text), public.sign_in_code_attempt(text, text, text),
  public.take_sign_in_code(text, text, text) from public, anon, authenticated;
grant execute on function public.keep_sign_in_code(text, text, text), public.sign_in_code_attempt(text, text, text),
  public.take_sign_in_code(text, text, text) to service_role;
