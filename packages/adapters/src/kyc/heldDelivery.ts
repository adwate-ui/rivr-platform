import { panSchema } from '@rivr/contracts';
import type { DigiLockerRecord } from './types.ts';

// What the kyc function's complete step does with a member's DigiLocker session (decision 0676): Zoop delivers the record to
// a webhook, which the database holds (kyc_digilocker_delivery) until the member is back for it.

/** A session as the database holds it: when it started, the record that came, or why none did. */
export interface HeldDelivery {
  readonly startedAt: number;
  readonly record: DigiLockerRecord | null;
  readonly refusal: string | null;
}

// Zoop's session lasts 30 minutes: 35 minutes after the hand-off, a delivery that has not come never will.
export const DELIVERY_WAIT_MS = 35 * 60 * 1000;

function text(row: object, name: string): string | null {
  const value: unknown = Reflect.get(row, name);
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A fetched delivery as the record the check keeps; the database holds only complete ones. */
function recordOf(row: object): DigiLockerRecord | null {
  const [name, maskedAadhaar, photoUrl, vendorReference] = ['name', 'masked_aadhaar', 'photo', 'vendor_reference'].map((field) => text(row, field));
  if (text(row, 'outcome') !== 'fetched' || !name || !maskedAadhaar || !photoUrl || !vendorReference) return null;
  const pan = panSchema.safeParse(text(row, 'pan'));
  return {
    name, dateOfBirth: text(row, 'date_of_birth'), maskedAadhaar, aadhaarReference: null, pan: pan.success ? pan.data : null,
    address: text(row, 'address') ?? '', photoUrl, vendorReference,
  };
}

/** kyc_digilocker_delivery's answer as a held session; null when the member has none (a vendor that hands it over when asked). */
export function heldDelivery(row: unknown): HeldDelivery | null {
  if (typeof row !== 'object' || row === null) return null;
  const refusal = text(row, 'outcome') === 'refused' ? text(row, 'refusal') ?? 'rejected' : null;
  return { startedAt: Date.parse(text(row, 'started_at') ?? ''), record: recordOf(row), refusal };
}

/** The complete step's next move: take the record, keep the refusal, give up, or ask the vendor where the session stands. */
export type DeliveryStep =
  | { readonly kind: 'record'; readonly record: DigiLockerRecord }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'expired' }
  | { readonly kind: 'ask' };

/**
 * What to do with the member's session at `now`. Nothing came within Zoop's half hour: none will. With no session held, a
 * vendor that hands its record over when asked (the fake) is asked; for one that delivers by webhook, the session is gone
 * (two hours on, or dropped while KYC sign-up was stopped), so nothing is coming and the vendor is not asked.
 */
export function deliveryStep(held: HeldDelivery | null, now: number, deliversByWebhook: boolean): DeliveryStep {
  if (held === null) return deliversByWebhook ? { kind: 'expired' } : { kind: 'ask' };
  if (held.record !== null) return { kind: 'record', record: held.record };
  if (held.refusal !== null) return { kind: 'refused', reason: held.refusal };
  return now - held.startedAt <= DELIVERY_WAIT_MS ? { kind: 'ask' } : { kind: 'expired' };
}
