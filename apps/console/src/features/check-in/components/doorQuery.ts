import { doorCheckInSchema } from '@rivr/contracts';
import { isMemberQuery } from '@rivr/db';

/** What the door's one field holds: a card's code from the scanner, a mobile number, a name or member number to find, or nothing usable. */
export type DoorQuery =
  | { readonly kind: 'card'; readonly code: string }
  | { readonly kind: 'phone'; readonly phone: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'none' };

// A membership card's QR (#71; owner, 8 Nov): RIVR, the member's number, the start of the code's window and its signature.
const CARD_CODE = /^RIVR-\d{1,12}-\d{1,12}-[0-9a-f]{24}$/i;

/** Reads the field as the door's scanner or the front desk filled it. */
export function doorQuery(text: string): DoorQuery {
  const typed = text.trim();
  if (CARD_CODE.test(typed)) return { kind: 'card', code: typed };
  const mobile = doorCheckInSchema.safeParse({ phone: typed });
  if (mobile.success) return { kind: 'phone', phone: mobile.data.phone };
  return typed !== '' && isMemberQuery(typed) ? { kind: 'search', query: typed } : { kind: 'none' };
}
