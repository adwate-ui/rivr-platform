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

/** alert.raised (#100): an alert and its kind; its details stay in the database, for the owner dashboard. */
export const alertRaisedSchema = z.object({
  alert_id: z.uuid(),
  kind: z.string().regex(/^[a-z_]+(\.[a-z_]+)*$/),
});

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

/** A Google review asked of a member after their third visit (#159): the venue's link, and no reward. */
export const reviewRequestedSchema = z.object({
  review_request_id: z.uuid(),
  member_id: z.uuid(),
  url: z.url({ protocol: /^https$/ }),
});
export type ReviewRequested = z.infer<typeof reviewRequestedSchema>;

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

/** call_time.completed (#56): the member's call time at their seat is complete. */
export const callTimeCompletedSchema = z.object({ member_id: z.uuid(), session_id: z.uuid() });

/** session.reminder (#56; decision 0053): the member has been seated as long as their own reminder. */
export const sessionReminderSchema = z.object({ member_id: z.uuid(), session_id: z.uuid(), hours: z.int().min(1).max(24) });

/** withdrawal.sent: the cage sent the member's withdrawal. */
export const withdrawalSentSchema = z.object({ member_id: z.uuid(), withdrawal_request_id: z.uuid(), amount_paise: z.int().min(1) });

/** tournament.starting (#139): the tournament's clock started, told to each member with a place in it. */
export const tournamentStartingSchema = z.object({ member_id: z.uuid(), tournament_id: z.uuid(), name: z.string().trim().min(1).max(80) });
