import { doorCheckInSchema } from '@rivr/contracts';
import { isMemberQuery } from '@rivr/db';

/** What the door's one field holds: a mobile number, a name or member number to find, or nothing usable. */
export type DoorQuery =
  | { readonly kind: 'phone'; readonly phone: string }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'none' };

/** Reads the field as the front desk filled it. */
export function doorQuery(text: string): DoorQuery {
  const typed = text.trim();
  const mobile = doorCheckInSchema.safeParse({ phone: typed });
  if (mobile.success) return { kind: 'phone', phone: mobile.data.phone };
  return typed !== '' && isMemberQuery(typed) ? { kind: 'search', query: typed } : { kind: 'none' };
}
