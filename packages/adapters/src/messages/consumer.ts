import {
  err, memberNoticeSchema, ok, promotionOfferedSchema, receiptReadySchema, reviewRequestedSchema, waitlistCalledSchema, type IndianMobile, type Result,
} from '@rivr/contracts';
import { formatMoney, formatTime } from '@rivr/i18n';
import type { ClaimedDelivery, Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { WhatsAppAdapter, WhatsAppMessage } from '../whatsapp/types.ts';

/** Who a message goes to: the member's number, and when they opted in to marketing, if they did. */
export interface MessageRecipient {
  readonly phone: IndianMobile;
  readonly marketingOptedInAt: Date | null;
}

/**
 * Finds a member of the event's venue when a message is sent; null for one who is not there (or a
 * practice member). For a promotion offer, the promotion: null too once it no longer runs, the member's
 * tier lost promotions.feed or marketing sends are switched off.
 */
export type FindRecipient = (venueId: string, memberId: string, offeredPromotionId?: string) => Promise<MessageRecipient | null>;

/** The events the WhatsApp consumer sends a message for. */
export const WHATSAPP_EVENT_TYPES = ['waitlist.called', 'receipt.ready', 'promotion.offered', 'review.requested', 'member.notice'] as const;

const rejected = (reason: string) => err<AdapterFailure>({ code: 'rejected', reason });

/** Nothing to send, and nothing wrong: a seat call whose hold ran out before it was claimed. */
const HANDLED = null;

/**
 * A published promotion offered to one member (#86): its card in the marketing template, only while the
 * promotion runs and the member's marketing opt-in stands. Otherwise nothing to send, and nothing wrong.
 */
async function offerMessage(delivery: ClaimedDelivery, findRecipient: FindRecipient): Promise<Result<WhatsAppMessage | null, AdapterFailure>> {
  const offer = promotionOfferedSchema.safeParse(delivery.payload);
  if (!offer.success) return rejected('promotion.offered payload is not an offer');
  const recipient = await findRecipient(delivery.venueId, offer.data.member_id, offer.data.promotion_id);
  if (!recipient || recipient.marketingOptedInAt === null) return ok(HANDLED);
  const card = [offer.data.title, offer.data.detail, offer.data.runs].filter((part) => part !== null).join(' · ');
  return ok({ category: 'marketing', optedInAt: recipient.marketingOptedInAt, to: recipient.phone, template: 'promotion', params: [`${card}.`] });
}

/**
 * A Google review asked after a member's third visit (#159): a marketing message, so only while their marketing opt-in
 * stands; otherwise nothing to send, and nothing wrong.
 */
async function reviewMessage(delivery: ClaimedDelivery, findRecipient: FindRecipient): Promise<Result<WhatsAppMessage | null, AdapterFailure>> {
  const review = reviewRequestedSchema.safeParse(delivery.payload);
  if (!review.success) return rejected('review.requested payload is not a review request');
  const recipient = await findRecipient(delivery.venueId, review.data.member_id);
  if (!recipient || recipient.marketingOptedInAt === null) return ok(HANDLED);
  return ok({ category: 'marketing', optedInAt: recipient.marketingOptedInAt, to: recipient.phone, template: 'review_request', params: [review.data.url] });
}

/** A notice older than this, or of no known time, is not sent: the member has long since seen it in the app (decision 0303). */
const NOTICE_FRESH_MS = 6 * 60 * 60 * 1000;

/** A refusal's code in the member's words, before the template's "Bring your Aadhaar and PAN"; an unknown code, the plainest. */
const REFUSED_BECAUSE: Readonly<Record<string, string>> = {
  duplicate_face: 'these details are on another membership',
  duplicate_pan: 'these details are on another membership',
  duplicate_aadhaar: 'these details are on another membership',
  staff_rejected: 'your details did not match',
};
const REFUSED_OTHERWISE = 'your details could not be confirmed';

/**
 * What a member hears of while away from the app (decision 0303): a utility message in the notice's own template, the
 * refusal's code put in words. A refusal for age has its own text, which sends no one to the desk. A notice claimed long
 * after it happened, as when WhatsApp is switched on, is not sent.
 */
async function noticeMessage(delivery: ClaimedDelivery, findRecipient: FindRecipient, now: Date): Promise<Result<WhatsAppMessage | null, AdapterFailure>> {
  const notice = memberNoticeSchema.safeParse(delivery.payload);
  if (!notice.success) return rejected('member.notice payload is not a notice');
  const age = delivery.occurredAt === undefined ? Number.NaN : now.getTime() - delivery.occurredAt.getTime();
  if (!(age <= NOTICE_FRESH_MS)) return ok(HANDLED);
  const recipient = await findRecipient(delivery.venueId, notice.data.member_id);
  if (!recipient) return rejected('the member is no longer there');
  const { notice: template, params } = notice.data;
  if (template === 'kyc_refused' && params[0] === 'under_18') return ok({ category: 'utility', to: recipient.phone, template: 'kyc_under_age', params: [] });
  const words = template === 'kyc_refused' ? [REFUSED_BECAUSE[params[0] ?? ''] ?? REFUSED_OTHERWISE] : params;
  return ok({ category: 'utility', to: recipient.phone, template, params: words });
}

type MessageBuilder = (delivery: ClaimedDelivery, findRecipient: FindRecipient, now: Date) => Promise<Result<WhatsAppMessage | null, AdapterFailure>>;

/** The events whose message is built by a function of its own. */
const BUILDERS: Readonly<Record<string, MessageBuilder>> = {
  'promotion.offered': (delivery, findRecipient) => offerMessage(delivery, findRecipient),
  'review.requested': (delivery, findRecipient) => reviewMessage(delivery, findRecipient),
  'member.notice': noticeMessage,
};

/**
 * The template message for a delivery, null when it needs none, or why it cannot be sent. Neither the
 * number nor the payload is ever logged.
 */
async function messageFor(delivery: ClaimedDelivery, findRecipient: FindRecipient, now: Date): Promise<Result<WhatsAppMessage | null, AdapterFailure>> {
  if (delivery.eventType === 'waitlist.called') {
    const called = waitlistCalledSchema.safeParse(delivery.payload);
    if (!called.success) return rejected('waitlist.called payload is not a seat call');
    // A call claimed after its hold ran out would send the member to a seat that is gone: handled, unsent.
    if (new Date(called.data.hold_until) <= now) return ok(HANDLED);
    const recipient = await findRecipient(delivery.venueId, called.data.member_id);
    if (!recipient) return rejected('the member is no longer there');
    const { table_name: table, seat, hold_until: holdUntil } = called.data;
    return { ok: true, value: { category: 'utility', to: recipient.phone, template: 'seat_ready', params: [table, String(seat), formatTime(new Date(holdUntil))] } };
  }
  if (delivery.eventType === 'receipt.ready') {
    const receipt = receiptReadySchema.safeParse(delivery.payload);
    if (!receipt.success) return rejected('receipt.ready payload is not a receipt');
    const recipient = await findRecipient(delivery.venueId, receipt.data.member_id);
    if (!recipient) return rejected('the member is no longer there');
    const amount = formatMoney(BigInt(receipt.data.amount_paise));
    return { ok: true, value: { category: 'utility', to: recipient.phone, template: 'receipt_ready', params: [amount], urlButton: receipt.data.link } };
  }
  const build = BUILDERS[delivery.eventType];
  if (build !== undefined) return build(delivery, findRecipient, now);
  return rejected(`no WhatsApp message for ${delivery.eventType}`);
}

/**
 * The WhatsApp outbox consumer (#62, #86): the seat call when a member is called from the waitlist,
 * the receipt-ready notice, a published promotion offered to a member who opted in to marketing, and what a member hears of
 * while away from the app (decision 0303). A messaging consumer, so a messaging stop holds every send; practice-venue
 * events never reach it. Utility messages need no opt-in; a marketing message needs the member's
 * opt-in, which the message type itself requires.
 */
export function createWhatsAppConsumer({ whatsapp, findRecipient, now = () => new Date() }: {
  whatsapp: WhatsAppAdapter;
  findRecipient: FindRecipient;
  /** For tests; the clock by default. */
  now?: () => Date;
}): Consumer {
  return {
    name: 'whatsapp',
    eventTypes: WHATSAPP_EVENT_TYPES,
    isMessaging: true,
    async deliver(delivery) {
      const message = await messageFor(delivery, findRecipient, now());
      if (!message.ok) return message;
      return message.value === HANDLED ? ok(HANDLED) : whatsapp.sendTemplate(message.value);
    },
  };
}
