import { err, ok, panSchema, type Pan, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { xmlElement } from './digiLockerXml.ts';
import type { DigiLockerDelivery, DigiLockerRecord, DigiLockerSession, KycAdapter } from './types.ts';
import { BASE_URL, UNAVAILABLE, zoopFailure, type ZoopOptions } from './zoopHost.ts';
import { digiLockerDeliverySchema, digiLockerFetchSchema, digiLockerInitSchema, envelopeSchema, sessionIdSchema } from './zoopReplies.ts';

// Zoop's DigiLocker (decision 0676), as its documentation and a test-host run (16 Nov 2026) have it. The member consents
// on Zoop's gateway; Zoop then sends the documents to RIVR's webhook (kyc-digilocker) and the member back to the app.

// The Aadhaar, and the PAN when DigiLocker holds it: a PAN check covers one it does not.
const DOCUMENTS = ['ADHAR', 'PANCR'];
// Shown to the member on Zoop's page.
const PURPOSE = 'Identity check for RIVR club membership';
// The last four digits behind DigiLocker's mask: `xxxxxxxx1234`.
const MASKED_UID = /^[xX*]{8}(\d{4})$/;
// The Aadhaar photo, a base64 JPEG: about 5 KB on 16 Nov 2026, 300 KB at most.
const JPEG_BASE64 = /^\/9j\/[A-Za-z0-9+/]+={0,2}$/;
const MAX_PHOTO_CHARS = 300_000;
// The address in the order a letter carries it; the care-of name is not part of it.
const ADDRESS_PARTS = ['house', 'street', 'lm', 'loc', 'vtc', 'po', 'subdist', 'dist', 'state', 'pc'];

const UNREADABLE: AdapterFailure = { code: 'rejected', reason: 'Zoop unreadable' };

interface Reply {
  readonly status: number;
  readonly ok: boolean;
  readonly body: unknown;
}

/** Calls Zoop with RIVR's keys; null when it cannot be reached in time. */
async function send(options: ZoopOptions, path: string, init: { method: 'GET' } | { method: 'POST'; body: string }): Promise<Reply | null> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const headers = { 'app-id': options.appId, 'api-key': options.apiKey, ...(init.method === 'POST' ? { 'content-type': 'application/json' } : {}) };
  try {
    const response = await doFetch(`${BASE_URL[options.environment]}${path}`, { ...init, headers, signal: AbortSignal.timeout(options.timeoutMs ?? 15_000) });
    return { status: response.status, ok: response.ok, body: await response.json().catch(() => undefined) };
  } catch {
    return null;
  }
}

/** A reply that is not the answer asked for, by Zoop's code; one that is not Zoop's envelope at all is an outage if it said 200. */
function failureOf(reply: Reply): AdapterFailure {
  const envelope = envelopeSchema.safeParse(reply.body);
  if (!envelope.success) return reply.ok ? UNAVAILABLE : zoopFailure(reply.status, undefined);
  return zoopFailure(reply.status, envelope.data.response_code);
}

/**
 * A refusal kept by Zoop's word for it (its reason code, or the session's status) when that is a word or a code of four
 * digits at most: never a longer number, which could be one of the member's.
 */
function refusalOf(code: string | null | undefined): AdapterFailure {
  const isPlain = typeof code === 'string' && /^([A-Za-z_]{1,24}|\d{1,4})$/.test(code);
  return { code: 'rejected', reason: `Zoop ${isPlain ? code : 'refused'}` };
}

/** The hand-off: the member goes to Zoop's gateway and comes back to `returnUrl`; the documents go to `deliveryUrl`. */
async function startDigiLocker(
  options: ZoopOptions,
  { returnUrl, deliveryUrl }: { readonly returnUrl: string; readonly deliveryUrl: string },
): Promise<Result<DigiLockerSession, AdapterFailure>> {
  const reply = await send(options, '/identity/digilocker/v1/init', {
    method: 'POST',
    // Back by a plain GET: the player app is static pages, which take no POST (Zoop's default is a form posted back).
    body: JSON.stringify({ docs: DOCUMENTS, purpose: PURPOSE, response_url: deliveryUrl, redirect_url: returnUrl, mode: 'REDIRECT', redirect_method: 'GET' }),
  });
  if (reply === null) return err(UNAVAILABLE);
  const session = digiLockerInitSchema.safeParse(reply.body);
  if (!reply.ok || !session.success) return err(failureOf(reply));
  const gateway = new URL(session.data.sdk_url);
  gateway.searchParams.set('mode', 'REDIRECT');
  return ok({ sessionId: session.data.request_id, redirectUrl: gateway.href, deliveryKey: session.data.webhook_security_key });
}

/** Where the session stands once the member is back. It never carries the documents: those come to the webhook. */
async function sessionStatus(options: ZoopOptions, { sessionId }: { readonly sessionId: string }): Promise<Result<'waiting', AdapterFailure>> {
  if (!sessionIdSchema.safeParse(sessionId).success) return err({ code: 'rejected', reason: 'Zoop unknown session' });
  const reply = await send(options, `/identity/digilocker/v1/fetch/${sessionId}`, { method: 'GET' });
  if (reply === null) return err(UNAVAILABLE);
  const status = digiLockerFetchSchema.safeParse(reply.body);
  if (!reply.ok || !status.success) return err(failureOf(reply));
  const state = status.data.transaction_status.trim().toUpperCase();
  // Not submitted yet, or submitted with the webhook on its way.
  return state === 'INITIATED' || state === 'SUCCESS' ? ok('waiting') : err(refusalOf(state));
}

/** DigiLocker's `dd-mm-yyyy` as an ISO date; null for anything else, such as a year of birth alone. */
function isoDate(value: string | undefined): string | null {
  const parts = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value?.trim() ?? '');
  if (parts === null) return null;
  const iso = `${parts[3] ?? ''}-${parts[2] ?? ''}-${parts[1] ?? ''}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

/** The PAN in DigiLocker's PAN Verification Record, or null when it sent none that reads. */
function panIn(xml: string | null): Pan | null {
  if (xml === null) return null;
  const number = xmlElement(xml, 'PAN')?.attributes.get('num') ?? xmlElement(xml, 'Certificate')?.attributes.get('number') ?? '';
  const pan = panSchema.safeParse(number.trim().toUpperCase());
  return pan.success ? pan.data : null;
}

const NO_ATTRIBUTES: ReadonlyMap<string, string> = new Map();

/** What the Aadhaar says of the person (`KycRes/UidData`): the last four digits, `Poi`'s name and date of birth, the photo. */
function personIn(aadhaarXml: string) {
  const lastFour = MASKED_UID.exec(xmlElement(aadhaarXml, 'UidData')?.attributes.get('uid') ?? '')?.[1] ?? null;
  const poi = xmlElement(aadhaarXml, 'Poi')?.attributes ?? NO_ATTRIBUTES;
  const photo = (xmlElement(aadhaarXml, 'Pht')?.text ?? '').replace(/\s+/g, '');
  return { lastFour, name: (poi.get('name') ?? '').replace(/\s+/g, ' ').trim(), dob: poi.get('dob'), photo };
}

/** `Poa` as one line. The town often comes three times (village, sub-district, district): once is enough. */
function addressIn(aadhaarXml: string): string {
  const poa = xmlElement(aadhaarXml, 'Poa')?.attributes ?? NO_ATTRIBUTES;
  const parts = ADDRESS_PARTS.map((part) => poa.get(part)?.trim() ?? '').filter((part) => part !== '');
  return parts.filter((part, at) => parts.indexOf(part) === at).join(', ');
}

/**
 * The member's record from DigiLocker's Aadhaar XML, and the PAN when it came too. The Aadhaar gives no stable reference
 * (its `tkn` came empty), so duplicates go by name, date of birth and the last four digits (decision 0197).
 */
function aadhaarRecord(aadhaarXml: string, panXml: string | null, sessionId: string): Result<DigiLockerRecord, AdapterFailure> {
  const { lastFour, name, dob, photo } = personIn(aadhaarXml);
  const isPhoto = photo.length <= MAX_PHOTO_CHARS && JPEG_BASE64.test(photo);
  if (lastFour === null || name === '' || !isPhoto) return err({ code: 'rejected', reason: 'Zoop unreadable Aadhaar' });
  return ok({
    name,
    dateOfBirth: isoDate(dob),
    maskedAadhaar: `XXXX XXXX ${lastFour}`,
    aadhaarReference: null,
    pan: panIn(panXml),
    address: addressIn(aadhaarXml),
    photoUrl: `data:image/jpeg;base64,${photo}`,
    vendorReference: sessionId,
  });
}

/**
 * Zoop's webhook as a delivery: the record when the Aadhaar came, else why not (the member refused, or shared no Aadhaar).
 * A body that names no session is no delivery at all.
 */
function readDelivery(body: unknown): Result<DigiLockerDelivery, AdapterFailure> {
  const delivery = digiLockerDeliverySchema.safeParse(body);
  if (!delivery.success) return err(UNREADABLE);
  const { request_id: sessionId, success, response_code: code, metadata, result } = delivery.data;
  const fetched = (doctype: string) => result?.find((document) => document.doctype === doctype && document.status === 'FETCHED')?.data_xml ?? null;
  const aadhaar = fetched('ADHAR');
  if (!success) return ok({ sessionId, outcome: err(refusalOf(metadata?.reason_code ?? code)) });
  if (aadhaar === null) return ok({ sessionId, outcome: err({ code: 'rejected', reason: 'Zoop no Aadhaar' }) });
  return ok({ sessionId, outcome: aadhaarRecord(aadhaar, fetched('PANCR'), sessionId) });
}

/** Zoop's DigiLocker: the hand-off, where a session stands, and the webhook's delivery. */
export function createZoopDigiLocker(options: ZoopOptions): Required<Pick<KycAdapter, 'startDigiLocker' | 'pullDigiLocker' | 'readDigiLockerDelivery'>> {
  return {
    startDigiLocker: (input) => startDigiLocker(options, input),
    pullDigiLocker: (input) => sessionStatus(options, input),
    readDigiLockerDelivery: readDelivery,
  };
}
