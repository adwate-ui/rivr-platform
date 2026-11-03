import { doorCheckInSchema } from '@rivr/contracts';
import { isMemberQuery } from '@rivr/db';

/** What the door's one field holds: a card's code from the scanner, a mobile number, a name or member number to find, or nothing usable. */
export type DoorQuery =
  | { readonly kind: 'card'; readonly code: string }
  | { readonly kind: 'phone'; readonly phone: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'none' };

// A membership card's QR reads as the card's id, a dot, the start of the code's window, a dot and its signature (#71).
const CARD_CODE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\d+\.\S+$/i;

/** Reads the field as the door's scanner or the front desk filled it. */
export function doorQuery(text: string): DoorQuery {
  const typed = text.trim();
  if (CARD_CODE.test(typed)) return { kind: 'card', code: typed };
  const mobile = doorCheckInSchema.safeParse({ phone: typed });
  if (mobile.success) return { kind: 'phone', phone: mobile.data.phone };
  return typed !== '' && isMemberQuery(typed) ? { kind: 'search', query: typed } : { kind: 'none' };
}
