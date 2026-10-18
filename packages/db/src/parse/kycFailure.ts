/** Why a KYC step did not go through, as a screen tells it. */
export type KycFailure = 'not_configured' | 'not_live' | 'pan_rejected' | 'stopped' | 'too_many_attempts' | 'unavailable';

const KNOWN: readonly KycFailure[] = ['not_configured', 'not_live', 'pan_rejected', 'stopped', 'too_many_attempts'];

/**
 * The code a KYC Edge Function refused with, from supabase-js's error, whose `context` is the HTTP
 * response with a body like `{ "error": "stopped" }`; null for anything else, a network failure included.
 */
export async function functionErrorCode(error: unknown): Promise<string | null> {
  const context: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'context') : undefined;
  if (!(context instanceof Response)) return null;
  const body: unknown = await context.json().catch(() => null);
  const code: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : undefined;
  return typeof code === 'string' ? code : null;
}

/**
 * The kyc Edge Function's refusal: `not_configured` (503), `not_live` (422, a selfie that failed
 * liveness), `pan_rejected` (422), `stopped` (423, the KYC kill switch), `too_many_attempts` (429).
 * Anything else, a network failure included, is `unavailable`.
 */
export async function toKycFailure(error: unknown): Promise<KycFailure> {
  const code = await functionErrorCode(error);
  return KNOWN.find((known) => known === code) ?? 'unavailable';
}
