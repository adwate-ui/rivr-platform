import { err, ok, type Pan, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { FaceMatch, KycAdapter, PanVerification } from './types.ts';
import { envelopeSchema, faceMatchSchema, panDemographicSchema, panLiteSchema } from './zoopReplies.ts';

/** How to reach Zoop.one, RIVR's KYC vendor (decision 0671). */
export interface ZoopOptions {
  readonly appId: string;
  readonly apiKey: string;
  /** `test` with the Test App's key (local and staging), `live` with the production app's. */
  readonly environment: 'test' | 'live';
  /**
   * Whether the PAN's name is the name given: `namesMatch` from `@rivr/domain/identity`. It is passed in because this
   * package does not import the domain package; every Edge Function that imports adapters would need it mapped.
   */
  readonly namesMatch: (documentName: string, givenName: string) => boolean;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** How long to wait for Zoop before giving up as unavailable; 15 seconds by default. */
  readonly timeoutMs?: number;
}

// The test host is the one RIVR has called; the live host is as Zoop's documentation names it, not yet called.
const BASE_URL = { test: 'https://test.zoop.one', live: 'https://live.zoop.one' } as const;
const UNAVAILABLE: AdapterFailure = { code: 'unavailable' };
// A 100 or 101 Zoop billed but RIVR cannot read: a refusal, so the paid call is not given back (#791).
const UNREADABLE: AdapterFailure = { code: 'rejected', reason: 'Zoop unreadable' };

// Zoop asks for the member's consent in words of 20 characters or more. RIVR records it before any call reaches the
// vendor (give_consent 'kyc_verification').
const CONSENT_TEXT = 'The member consented to this identity check.';

// Zoop's codes for its own or its source's trouble (source error, timed out, down, internal, unknown), as its 2022
// documentation lists them: worth asking again.
const RETRY_LATER = new Set(['99', '108', '109', '110', '111']);

// An image to send: 5 MB at most (a selfie is 2 MB), fetched within 15 seconds, never through a redirect.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Zoop's DigiLocker is not on RIVR's account yet (15 Nov 2026) and its replies are not public, so the hand-off stays
// closed, as it is without keys, until it is built from Zoop's real replies: no member is checked against a guess.
const NOT_ON_THE_ACCOUNT = err({ code: 'not_configured' } as const);

/** An answer Zoop gave: 100 (found, or a match) or 101 (no record, or no match), its id for the call, and the result. */
interface ZoopAnswer {
  readonly code: '100' | '101';
  readonly requestId: string;
  readonly result: unknown;
}

type ZoopCall = (path: string, data: Readonly<Record<string, string>>) => Promise<Result<ZoopAnswer, AdapterFailure>>;

/** A refusal as a failure. The reason names Zoop's code only: its messages can repeat what was sent. */
function zoopFailure(status: number, code: string | undefined): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500 || (code !== undefined && RETRY_LATER.has(code))) return UNAVAILABLE;
  return { code: 'rejected', reason: `Zoop ${code !== undefined && /^\d{1,4}$/.test(code) ? code : `HTTP ${status}`}` };
}

/** Zoop's reply as an answer, or why it is none: any code but 100 and 101 is a failure. */
async function answerOf(response: Response, taskId: string): Promise<Result<ZoopAnswer, AdapterFailure>> {
  const reply = envelopeSchema.safeParse(await response.json().catch(() => undefined));
  if (!reply.success) return err(response.ok ? UNAVAILABLE : zoopFailure(response.status, undefined));
  const code = reply.data.response_code;
  if (!response.ok || (code !== '100' && code !== '101')) return err(zoopFailure(response.status, code));
  // Every reply seen carried Zoop's request_id; without one, the reference is RIVR's own task id.
  return ok({ code, requestId: reply.data.request_id ?? taskId, result: reply.data.result });
}

/** Calls one of Zoop's products, with the member's consent and a fresh task id. */
function createZoopCall(options: ZoopOptions): ZoopCall {
  const doFetch = options.fetch ?? globalThis.fetch;
  return async (path, data) => {
    const taskId = crypto.randomUUID();
    try {
      const response = await doFetch(`${BASE_URL[options.environment]}${path}`, {
        method: 'POST',
        headers: { 'app-id': options.appId, 'api-key': options.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, data: { ...data, consent: 'Y', consent_text: CONSENT_TEXT } }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      });
      return await answerOf(response, taskId);
    } catch {
      return err(UNAVAILABLE);
    }
  };
}

/** Whether an image may be fetched: https, a `data:` URL, or http on this machine only (the local stack's storage). */
function isImageAddress(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' || protocol === 'data:' || (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

/** An image as Zoop takes it, base64 without a `data:` prefix: a stored selfie's signed link, or a `data:` URL. */
async function base64At(url: string, doFetch: typeof globalThis.fetch): Promise<string | null> {
  if (!isImageAddress(url)) return null;
  try {
    const response = await doFetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return null;
    let text = '';
    for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return btoa(text);
  } catch {
    return null;
  }
}

/** The PAN holder's name by Pan Lite, or null when Zoop has no such PAN (101) or it is not valid. */
async function panHolder(call: ZoopCall, pan: Pan): Promise<Result<{ readonly name: string | null; readonly vendorReference: string }, AdapterFailure>> {
  const lite = await call('/api/v1/in/identity/pan/lite', { customer_pan_number: pan });
  if (!lite.ok) return lite;
  const vendorReference = lite.value.requestId;
  if (lite.value.code === '101') return ok({ name: null, vendorReference });
  const holder = panLiteSchema.safeParse(lite.value.result);
  if (!holder.success) return err(UNREADABLE);
  const isValid = holder.data.pan_status.trim().toUpperCase() === 'VALID';
  return ok({ name: isValid ? holder.data.user_full_name : null, vendorReference });
}

/** Whether the PAN's date of birth is the one given, by Pan Demographic; Zoop's 101 (no record for the pair) is no. */
async function panDateOfBirthMatches(call: ZoopCall, pan: Pan, dateOfBirth: string): Promise<Result<boolean, AdapterFailure>> {
  // Zoop writes a date of birth day first: 1995-02-02 is 02-02-1995.
  const reply = await call('/api/v1/in/identity/pan/demographic', { customer_pan_number: pan, customer_dob: dateOfBirth.split('-').reverse().join('-') });
  if (!reply.ok) return reply;
  if (reply.value.code === '101') return ok(false);
  const read = panDemographicSchema.safeParse(reply.value.result);
  return read.success ? ok(read.data.is_dob_match) : err(UNREADABLE);
}

/**
 * The date of birth's failure, once Pan Lite has answered and been paid for: never given back as the vendor's trouble
 * (#791), or each try would pay for Pan Lite again with none of the member's five a day spent.
 */
function afterPanLite(failure: AdapterFailure): AdapterFailure {
  return failure.code === 'rejected' ? failure : { code: 'rejected', reason: `Zoop date of birth ${failure.code}` };
}

/**
 * The PAN check: Pan Lite for whether it is valid and whose it is, then Pan Demographic for the date of birth. A name
 * that differs settles the check, so its date of birth is not asked (each call is paid for) and reads as not matching.
 */
async function verifyPan(
  call: ZoopCall,
  namesMatch: ZoopOptions['namesMatch'],
  { pan, name, dateOfBirth }: { readonly pan: Pan; readonly name: string; readonly dateOfBirth: string },
): Promise<Result<PanVerification, AdapterFailure>> {
  const holder = await panHolder(call, pan);
  if (!holder.ok) return holder;
  const { vendorReference } = holder.value;
  if (holder.value.name === null) return ok({ isValid: false, nameMatches: false, dateOfBirthMatches: false, vendorReference });
  if (!namesMatch(holder.value.name, name)) return ok({ isValid: true, nameMatches: false, dateOfBirthMatches: false, vendorReference });
  const dateOfBirthMatches = await panDateOfBirthMatches(call, pan, dateOfBirth);
  if (!dateOfBirthMatches.ok) return err(afterPanLite(dateOfBirthMatches.error));
  return ok({ isValid: true, nameMatches: true, dateOfBirthMatches: dateOfBirthMatches.value, vendorReference });
}

/** The selfie against the reference photo. Zoop answers 101 when they are not the same person, or either shows no face. */
async function matchFace(
  call: ZoopCall,
  doFetch: typeof globalThis.fetch,
  { selfieUrl, referenceUrl }: { readonly selfieUrl: string; readonly referenceUrl: string },
): Promise<Result<FaceMatch, AdapterFailure>> {
  const [selfie, reference] = await Promise.all([base64At(selfieUrl, doFetch), base64At(referenceUrl, doFetch)]);
  if (selfie === null || reference === null) return err(UNAVAILABLE);
  const reply = await call('/api/v1/in/ml/face/match', { card_image: reference, user_image: selfie });
  if (!reply.ok) return reply;
  const vendorReference = reply.value.requestId;
  if (reply.value.code === '101') return ok({ isMatch: false, score: 0, vendorReference });
  // Zoop decides the match: its own threshold sends 101 below it. Only a score of 100 has been seen (15 Nov 2026), so
  // what scores a 100 can carry is not known; a threshold of RIVR's own would belong in @rivr/domain.
  const match = faceMatchSchema.safeParse(reply.value.result);
  return match.success ? ok({ isMatch: true, score: Math.round(match.data.face_match_score), vendorReference }) : err(UNREADABLE);
}

/**
 * KYC on Zoop.one (decision 0671): the PAN check and the face match. No liveness (the owner, 15 Nov 2026: the selfie
 * stays in the app, with no vendor page) and, until Zoop adds it to the account, no DigiLocker.
 */
export function createZoopKyc(options: ZoopOptions): KycAdapter {
  const call = createZoopCall(options);
  const doFetch = options.fetch ?? globalThis.fetch;
  return {
    startDigiLocker: async () => NOT_ON_THE_ACCOUNT,
    pullDigiLocker: async () => NOT_ON_THE_ACCOUNT,
    verifyPan: (input) => verifyPan(call, options.namesMatch, input),
    matchFace: (input) => matchFace(call, doFetch, input),
  };
}
