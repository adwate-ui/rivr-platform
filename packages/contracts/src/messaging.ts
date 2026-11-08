import { z } from 'zod';

/**
 * The payloads of the events the WhatsApp consumer sends a message for (#62). They name the member,
 * never their number: the consumer looks the number up when it sends, so an outbox row holds no phone.
 */

/**
 * waitlist.called (#63): a seat is held for the member until `hold_until`. The phase-2 lock screen's seat.called (decision
 * 0323). `entry_id` is the member's place, which "I'm on my way" answers (decision 0321).
 */
export const waitlistCalledSchema = z.object({
  entry_id: z.uuid().optional(),
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

/** alert.raised (#100): an alert and its kind; its details stay in the database, for the console. */
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

/**
 * call_time.ending (decision 0320): the member's call time has 15 minutes or less to run (@rivr/domain
 * CALL_TIME_ENDING_SECONDS), sent once by the minute sweep, and again once time is added. It ends at `ends_at`.
 */
export const callTimeEndingSchema = z.object({
  member_id: z.uuid(),
  session_id: z.uuid(),
  table_name: z.string().trim().min(1).max(40),
  seat: z.int().min(1).max(10),
  ends_at: z.iso.datetime({ offset: true }),
});

/** call_time.updated (decision 0320): the floor added time; the call time is now `minutes` in all. */
export const callTimeUpdatedSchema = z.object({ member_id: z.uuid(), session_id: z.uuid(), minutes: z.int().min(1).max(1440) });

/** session.reminder (#56; decision 0053): the member has been seated as long as their own reminder. */
export const sessionReminderSchema = z.object({ member_id: z.uuid(), session_id: z.uuid(), hours: z.int().min(1).max(24) });

/** withdrawal.sent: the cage sent the member's withdrawal. */
export const withdrawalSentSchema = z.object({ member_id: z.uuid(), withdrawal_request_id: z.uuid(), amount_paise: z.int().min(1) });

/** tournament.starting (#139): the tournament's clock started, told to each member with a place in it. */
export const tournamentStartingSchema = z.object({ member_id: z.uuid(), tournament_id: z.uuid(), name: z.string().trim().min(1).max(80) });

/** bonus.credited (decision 0504): bonus chips added to the member's balance, with the promotion's name or another reason. */
export const bonusCreditedSchema = z.object({
  member_id: z.uuid(),
  bonus_grant_id: z.uuid(),
  amount_paise: z.int().min(1),
  reason: z.string().trim().min(3).max(200),
});

/** bonus.redeemed (decision 0504): bonus chips used for the member's buy-in as the floor seated them, at that table. */
export const bonusRedeemedSchema = z.object({
  member_id: z.uuid(),
  bonus_redemption_id: z.uuid(),
  amount_paise: z.int().min(5000).multipleOf(5000),
  table_id: z.uuid(),
  table_name: z.string().trim().min(1).max(40),
});

/**
 * The notices a member hears of by WhatsApp while away from the app (decision 0303): an identity check verified, waiting for
 * review or refused; a reward cancelled; a seat on the leaving list released.
 */
export const MEMBER_NOTICES = ['kyc_verified', 'kyc_in_review', 'kyc_refused', 'reward_cancelled', 'seat_released'] as const;

/**
 * A notice's word: one line of plain text, never a link nor WhatsApp's formatting marks, so nothing typed into the club's
 * records reads as something else from the club's number.
 */
const noticeWordSchema = z.string().trim().min(1).max(120)
  .regex(/^[^\r\n\t*~`]*$/)
  .refine((word) => !/https?:\/\/|www\./i.test(word));
export type MemberNotice = (typeof MEMBER_NOTICES)[number];

/** member.notice: the member, the notice and its words, in the template's order: a refusal's code; a reward's name; the table and seat released. */
export const memberNoticeSchema = z.object({
  member_id: z.uuid(),
  notice: z.enum(MEMBER_NOTICES),
  params: z.array(noticeWordSchema).max(2),
});
