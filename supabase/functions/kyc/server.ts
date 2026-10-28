// What the kyc function needs from the platform: replies, database calls as the caller or as the
// server, the member's current record, and the KYC photo in the private kyc bucket.
import type { AdapterFailure } from '@rivr/adapters';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` };

// How long the vendor has to fetch the selfie.
const PHOTO_URL_SECONDS = 300;

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export function reply(body: object, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

export function failed(failure: AdapterFailure): Response {
  return failure.code === 'not_configured' ? reply({ error: 'not_configured' }, 503) : reply({ error: 'unavailable' }, 502);
}

/** A database function's refusal, with its SQLSTATE (RVKIL, RVCON, RVRAT and so on). */
class Refused extends Error {
  constructor(readonly code: string) {
    super(`refused: ${code}`);
  }
}

/** Calls a database function, as the caller (their token) or as the server (the service role). */
export async function rpc(name: string, args: object, token: string | null): Promise<unknown> {
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

// What the gate's refusals mean to the app, by SQLSTATE: the member's own steps, and a check staff
// make in person (kyc-in-person). Anything else is a fault.
const REFUSALS: Readonly<Record<string, readonly [string, number]>> = {
  RVKIL: ['stopped', 423],
  RVFRZ: ['stopped', 423],
  RVMBR: ['stopped', 423],
  RVRAT: ['too_many_attempts', 429],
  RVCON: ['no_consent', 403],
  '42501': ['not_allowed', 403],
  RVKYC: ['decided', 409],
  RVPHT: ['no_photo', 409],
  '22023': ['invalid', 400],
};

/** What the gate's refusals mean to the app. */
export function refusal(error: unknown): Response {
  const [message, status] = REFUSALS[error instanceof Refused ? error.code : ''] ?? ['unavailable', 502];
  return reply({ error: message }, status);
}

/** The member's current record, as the server reads it. */
export async function currentRecord(memberId: string): Promise<Record<string, unknown> | null> {
  const columns = 'status,method,digilocker_session_id,date_of_birth,photo_path';
  const answer = await fetch(`${supabaseUrl}/rest/v1/kyc_record?member_id=eq.${memberId}&select=${columns}`, { headers: AS_SERVER });
  // A failed read is not "no record".
  if (!answer.ok) throw new Error(`The KYC record was not read (${answer.status})`);
  const rows: unknown = await answer.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export function field(body: unknown, name: string): string | null {
  const value: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, name) : null;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// KYC photo paths are built here from the member's own ids (<venue_id>/<member_id>/selfie.jpg), never
// taken from a request, so they need no encoding.

/** Stores the selfie as the member's KYC photo. */
export async function putPhoto(path: string, jpeg: Uint8Array<ArrayBuffer>): Promise<void> {
  const stored = await fetch(`${supabaseUrl}/storage/v1/object/kyc/${path}`, {
    method: 'POST',
    headers: { ...AS_SERVER, 'content-type': 'image/jpeg', 'x-upsert': 'true' },
    body: jpeg,
  });
  if (!stored.ok) throw new Error(`The KYC photo was not stored (${stored.status})`);
}

/** A short-lived link to the KYC photo, for the vendor to fetch. */
export async function photoUrl(path: string): Promise<string> {
  const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/kyc/${path}`, {
    method: 'POST',
    headers: { ...AS_SERVER, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: PHOTO_URL_SECONDS }),
  });
  const signedPath: unknown = signed.ok ? Reflect.get(await signed.json(), 'signedURL') : null;
  if (typeof signedPath !== 'string') throw new Error('The KYC photo could not be signed');
  return `${supabaseUrl}/storage/v1${signedPath}`;
}

/** Deletes a selfie that did not pass: only a passing one is kept. */
export async function removePhoto(path: string): Promise<void> {
  await fetch(`${supabaseUrl}/storage/v1/object/kyc/${path}`, { method: 'DELETE', headers: AS_SERVER });
}
