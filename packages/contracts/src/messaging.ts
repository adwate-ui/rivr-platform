import { z } from 'zod';

/**
 * The payloads of the events the WhatsApp consumer sends a message for (#62). They name the member,
 * never their number: the consumer looks the number up when it sends, so an outbox row holds no phone.
 */

/** waitlist.called (#63): a seat is held for the member until `hold_until`. */
export const waitlistCalledSchema = z.object({
  member_id: z.uuid(),
  table_name: z.string().trim().min(1).max(40),
  seat: z.int().min(1).max(10),
  hold_until: z.iso.datetime({ offset: true }),
});

/** receipt.ready: a receipt for an amount is ready at a link (the part after the template's base address). */
export const receiptReadySchema = z.object({
  member_id: z.uuid(),
  amount_paise: z.int().min(1),
  link: z.string().regex(/^[A-Za-z0-9_\-/]{1,200}$/),
});

/** A waitlist.called payload. */
export type WaitlistCalled = z.infer<typeof waitlistCalledSchema>;
/** A receipt.ready payload. */
export type ReceiptReady = z.infer<typeof receiptReadySchema>;
