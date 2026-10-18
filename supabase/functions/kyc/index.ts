// KYC for the signed-in member (#4): the DigiLocker hand-off, its return, and a PAN check when
// DigiLocker fails. The practice venue gets the fake vendor; a real venue without vendor keys fails
// closed (docs/decisions/0014). This function writes the member's kyc_record with the service role;
// members can only read it, so nobody verifies themselves. Every vendor call first passes
// begin_kyc_vendor_call: the kyc_signup kill switch, the member's consent, five paid calls a day.
import { createAdapters, type AdapterFailure } from '@rivr/adapters';
import { memberIdSchema, panSchema } from '@rivr/contracts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Where DigiLocker sends the member back. Fixed here, never taken from the request, so the hand-off
// cannot be pointed at someone else's page.
const playerAppUrl = Deno.env.get('PLAYER_APP_URL') ?? '';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function reply(body: object, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

function failed(failure: AdapterFailure): Response {
  return failure.code === 'not_configured' ? reply({ error: 'not_configured' }, 503) : reply({ error: 'unavailable' }, 502);
}

/** A database function's refusal, with its SQLSTATE (RVKIL, RVCON, RVRAT and so on). */
class Refused extends Error {
  constructor(readonly code: string) {
    super(`refused: ${code}`);
  }
}

/** Calls a database function, as the caller (their token) or as the server (the service role). */
async function rpc(name: string, args: object, token: string | null): Promise<unknown> {
  const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: token === null ? serviceRoleKey : anonKey,
      authorization: token === null ? `Bearer ${serviceRoleKey}` : token,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (answer.ok) return answer.status === 204 ? null : await answer.json();
  const body: unknown = await answer.json().catch(() => null);
  throw new Refused(String(typeof body === 'object' && body !== null ? Reflect.get(body, 'code') : answer.status));
}

/** What the gate's refusals mean to the app. */
function refusal(error: unknown): Response {
  const code = error instanceof Refused ? error.code : '';
  if (code === 'RVKIL' || code === 'RVFRZ' || code === 'RVMBR') return reply({ error: 'stopped' }, 423);
  if (code === 'RVRAT') return reply({ error: 'too_many_attempts' }, 429);
  if (code === 'RVCON') return reply({ error: 'no_consent' }, 403);
  return reply({ error: 'unavailable' }, 502);
}

/** The member's current record, as the server reads it. */
async function currentRecord(memberId: string): Promise<Record<string, unknown> | null> {
  const answer = await fetch(`${supabaseUrl}/rest/v1/kyc_record?member_id=eq.${memberId}&select=status,method,digilocker_session_id,date_of_birth`, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows: unknown = await answer.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function field(body: unknown, name: string): string | null {
  const value: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, name) : null;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

type Kyc = ReturnType<typeof createAdapters>['kyc'];
interface Subject {
  readonly memberId: ReturnType<typeof memberIdSchema.parse>;
  readonly fullName: string;
  readonly kyc: Kyc;
}

/** The DigiLocker hand-off: the member consents, the gate passes, then the vendor is called. */
async function start({ memberId, kyc }: Subject, token: string): Promise<Response> {
  if (playerAppUrl === '') return reply({ error: 'not_configured' }, 503);
  // DPDP: the member consents to the identity check before anything is sent to the vendor.
  await rpc('give_consent', { p_purpose: 'kyc_verification' }, token);
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const started = await kyc.startDigiLocker({ memberId, returnUrl: `${playerAppUrl}/kyc/return` });
  if (!started.ok) return failed(started.error);
  await rpc('record_kyc_started', { p_member_id: memberId, p_session_id: started.value.sessionId }, null);
  return reply({ redirectUrl: started.value.redirectUrl });
}

/** The member is back from DigiLocker: pull the record, or move them to a PAN check. */
async function complete({ memberId, kyc }: Subject): Promise<Response> {
  const record = await currentRecord(memberId);
  if (record === null || typeof record.digilocker_session_id !== 'string') return reply({ error: 'No DigiLocker hand-off to complete' }, 409);
  if (record.status !== 'started') return reply({ status: record.status });
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: false }, null);
  const pulled = await kyc.pullDigiLocker({ sessionId: record.digilocker_session_id });
  if (!pulled.ok && pulled.error.code === 'not_configured') return failed(pulled.error);
  if (!pulled.ok) {
    await rpc('record_kyc_digilocker_failed', { p_member_id: memberId }, null);
    return reply({ status: 'needs_pan' });
  }
  const { dateOfBirth, maskedAadhaar, pan, address, vendorReference } = pulled.value;
  const status = await rpc('record_kyc_digilocker', {
    p_member_id: memberId, p_date_of_birth: dateOfBirth, p_masked_aadhaar: maskedAadhaar, p_pan: pan,
    p_address: address, p_vendor_reference: vendorReference,
  }, null);
  return reply({ status });
}

/** The PAN to check, and the date of birth: DigiLocker's when it gave one, else the member's. */
function panInput(record: Record<string, unknown>, body: unknown) {
  const pan = panSchema.safeParse(field(body, 'pan') ?? '');
  const dateOfBirth = typeof record.date_of_birth === 'string' ? record.date_of_birth : field(body, 'dateOfBirth');
  if (!pan.success || dateOfBirth === null || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  return { pan: pan.data, dateOfBirth };
}

/**
 * A PAN check, when DigiLocker failed or held no PAN. The PAN is checked against the member's
 * registered name, never one from the request; the date of birth is DigiLocker's when it gave one.
 */
async function checkPan({ memberId, fullName, kyc }: Subject, body: unknown): Promise<Response> {
  const record = await currentRecord(memberId);
  if (record?.status !== 'needs_pan') return reply({ error: 'No PAN is needed' }, 409);
  const input = panInput(record, body);
  if (input === null) return reply({ error: 'pan and dateOfBirth are required' }, 400);
  const { pan, dateOfBirth } = input;
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const checked = await kyc.verifyPan({ pan, name: fullName, dateOfBirth });
  if (!checked.ok) return failed(checked.error);
  if (!checked.value.isValid || !checked.value.nameMatches) return reply({ error: 'pan_rejected' }, 422);
  const status = await rpc('record_kyc_pan', {
    p_member_id: memberId, p_pan: pan, p_date_of_birth: dateOfBirth, p_vendor_reference: checked.value.vendorReference,
  }, null);
  return reply({ status });
}

/** The signed-in member this request is for, or null for staff and the public. */
async function subjectFor(token: string): Promise<Subject | null> {
  const rows = await rpc('kyc_subject', {}, token).catch(() => []);
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (typeof row !== 'object' || row === null) return null;
  const { kyc } = createAdapters({ isPracticeVenue: Reflect.get(row, 'is_practice') === true, live: {} });
  return { memberId: memberIdSchema.parse(Reflect.get(row, 'member_id')), fullName: String(Reflect.get(row, 'full_name')), kyc };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const token = request.headers.get('authorization') ?? '';
  const body: unknown = await request.json().catch(() => null);
  const subject = await subjectFor(token);
  if (subject === null) return reply({ error: 'Only a signed-in member has KYC' }, 403);
  try {
    const action = field(body, 'action');
    if (action === 'start') return await start(subject, token);
    if (action === 'complete') return await complete(subject);
    if (action === 'pan') return await checkPan(subject, body);
    return reply({ error: 'action must be start, complete or pan' }, 400);
  } catch (error) {
    return refusal(error);
  }
});
