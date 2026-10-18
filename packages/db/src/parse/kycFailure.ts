/** Why a KYC step did not go through, as a screen tells it. */
export type KycFailure = 'not_configured' | 'pan_rejected' | 'stopped' | 'too_many_attempts' | 'unavailable';

const KNOWN: readonly KycFailure[] = ['not_configured', 'pan_rejected', 'stopped', 'too_many_attempts'];

/**
 * Reads the kyc Edge Function's refusal from supabase-js's error, whose `context` is the HTTP
 * response: `{ "error": "not_configured" }` (503), `pan_rejected` (422), `stopped` (423, the KYC
 * kill switch), `too_many_attempts` (429). Anything else, a network failure included, is `unavailable`.
 */
export async function toKycFailure(error: unknown): Promise<KycFailure> {
  const context: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'context') : undefined;
  if (!(context instanceof Response)) return 'unavailable';
  const body: unknown = await context.json().catch(() => null);
  const code: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : undefined;
  return KNOWN.find((known) => known === code) ?? 'unavailable';
}
