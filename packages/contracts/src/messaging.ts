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

/**
 * The part of a link a WhatsApp template's button adds to its approved base address (a payment link,
 * a receipt): letters, digits, `-`, `_` and `/` only, so it can add no query, host or fragment.
 */
export const linkSuffixSchema = z.string().regex(/^[A-Za-z0-9_\-/]{1,200}$/);

/** receipt.ready: a receipt for an amount is ready at a link (the part after the template's base address). */
export const receiptReadySchema = z.object({
  member_id: z.uuid(),
  amount_paise: z.int().min(1),
  link: linkSuffixSchema,
});

/** A waitlist.called payload. */
export type WaitlistCalled = z.infer<typeof waitlistCalledSchema>;
/** A receipt.ready payload. */
export type ReceiptReady = z.infer<typeof receiptReadySchema>;

/** promotion.offered (#86): a published promotion's card, offered to one member who opted in to marketing. */
export const promotionOfferedSchema = z.object({
  promotion_id: z.uuid(),
  member_id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  detail: z.string().trim().min(1).max(200).nullable(),
  runs: z.string().trim().min(1).max(120).nullable(),
});

/** A promotion.offered payload. */
export type PromotionOffered = z.infer<typeof promotionOfferedSchema>;
