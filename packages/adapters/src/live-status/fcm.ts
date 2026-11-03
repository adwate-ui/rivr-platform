import { err, ok, type Result } from '@rivr/contracts';
import { z } from 'zod';
import { signJwt } from '../shared/jwt.ts';
import type { LiveStatus, LiveStatusAdapter, LiveStatusFailure } from './types.ts';

/** The club's Firebase project and the service account that sends for it (decision 0361), from its JSON key. */
export interface FcmOngoingOptions {
  /** The service account JSON's `project_id`. */
  readonly projectId: string;
  /** Its `client_email`. */
  readonly clientEmail: string;
  /** Its `private_key` (PKCS#8 PEM). */
  readonly privateKey: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** For tests; the clock by default. */
  readonly now?: () => Date;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const accessReplySchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });
const sentReplySchema = z.object({ name: z.string() });
const errorReplySchema = z.object({
  error: z.object({ status: z.string().optional(), details: z.array(z.object({ errorCode: z.string().optional() }).loose()).optional() }),
});

/**
 * The data message the app's own Firebase service turns into the ongoing notification (android/, LiveStatusNotification):
 * every value a string, times in milliseconds since 1970, an empty string for none.
 */
function dataOf(status: LiveStatus | null): Record<string, string> {
  if (status === null) return { kind: 'rivr_live_status', state: 'ended' };
  return {
    kind: 'rivr_live_status',
    state: status.kind,
    meta: status.meta,
    label: status.label,
    value: status.value ?? '',
    startsAt: status.countdown === null ? '' : String(status.countdown.startsAt.getTime()),
    endsAt: status.countdown === null ? '' : String(status.countdown.endsAt.getTime()),
    actionTitle: status.action?.title ?? '',
    actionUrl: status.action?.url ?? '',
    alert: status.alert === null ? '' : '1',
  };
}

/** Firebase's error status and codes in a refusal (`NOT_FOUND`, `UNREGISTERED`), as far as it can be read. */
function codesOf(reply: unknown): { status: string; codes: readonly string[] } {
  const error = errorReplySchema.safeParse(reply).data?.error;
  const details = (error?.details ?? []).flatMap((detail) => (detail.errorCode === undefined ? [] : [detail.errorCode]));
  return { status: error?.status ?? '', codes: error?.status === undefined ? details : [error.status, ...details] };
}

/** Why Firebase refused: a phone it no longer knows (or another project's) is gone; a bad message is not worth trying again. */
function failureOf(status: number, reply: unknown): LiveStatusFailure {
  const refusal = codesOf(reply);
  if (status === 404 || refusal.codes.some((code) => code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH')) return { code: 'device_gone' };
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 400 && status < 500 && status !== 401) return { code: 'rejected', reason: `Firebase answered ${status} ${refusal.status}`.trim() };
  return { code: 'unavailable' };
}

/** Google's access token for the service account (OAuth 2.0 for service accounts), kept until shortly before it runs out. */
function createAccessToken({ clientEmail, privateKey, fetch }: { clientEmail: string; privateKey: string; fetch: typeof globalThis.fetch }) {
  let kept: { readonly token: string; readonly until: number } | null = null;
  return {
    async at(now: Date): Promise<Result<string, LiveStatusFailure>> {
      if (kept !== null && now.getTime() < kept.until) return ok(kept.token);
      const iat = Math.floor(now.getTime() / 1000);
      const assertion = await signJwt({
        algorithm: 'RS256', privateKey, claims: { iss: clientEmail, scope: MESSAGING_SCOPE, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 },
      });
      const answer = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        signal: AbortSignal.timeout(5_000),
      });
      if (answer.status === 400 || answer.status === 401) return err({ code: 'rejected', reason: 'Google refused the service account' });
      const reply = accessReplySchema.safeParse(await answer.json().catch(() => null));
      if (!answer.ok || !reply.success) return err({ code: 'unavailable' });
      kept = { token: reply.data.access_token, until: now.getTime() + (reply.data.expires_in - 60) * 1000 };
      return ok(kept.token);
    },
    drop() {
      kept = null;
    },
  };
}

/**
 * An Android phone's ongoing notification through Firebase Cloud Messaging (HTTP v1, decision 0323): a high-priority data
 * message the app's own service turns into the notification, counting down with a chronometer, or removes. Only the
 * latest waits for a phone that is offline (one collapse key).
 */
export function createFcmOngoing({ projectId, clientEmail, privateKey, fetch = globalThis.fetch, now = () => new Date() }: FcmOngoingOptions): LiveStatusAdapter {
  const access = createAccessToken({ clientEmail, privateKey, fetch });

  async function send(token: string, status: LiveStatus | null): Promise<Result<{ id: string }, LiveStatusFailure>> {
    const bearer = await access.at(now());
    if (!bearer.ok) return bearer;
    const answer = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer.value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token, data: dataOf(status), android: { priority: 'HIGH', ttl: '3600s', collapse_key: 'live_status' } } }),
      signal: AbortSignal.timeout(5_000),
    });
    const reply: unknown = await answer.json().catch(() => null);
    if (answer.ok) return ok({ id: sentReplySchema.safeParse(reply).data?.name ?? '' });
    // A token Google no longer takes: ask for another next time.
    if (answer.status === 401) access.drop();
    return err(failureOf(answer.status, reply));
  }

  return {
    async show({ device, status }) {
      if (device.platform !== 'android') return err({ code: 'rejected', reason: 'Firebase sends to an Android phone only' });
      try {
        return await send(device.token, status);
      } catch {
        return err({ code: 'unavailable' });
      }
    },
  };
}
