import { err, ok, promotionOfferedSchema, receiptReadySchema, reviewRequestedSchema, waitlistCalledSchema, type IndianMobile, type Result } from '@rivr/contracts';
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
export const WHATSAPP_EVENT_TYPES = ['waitlist.called', 'receipt.ready', 'promotion.offered', 'review.requested'] as const;

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
  if (delivery.eventType === 'promotion.offered') return offerMessage(delivery, findRecipient);
  if (delivery.eventType === 'review.requested') return reviewMessage(delivery, findRecipient);
  return rejected(`no WhatsApp message for ${delivery.eventType}`);
}

/**
 * The WhatsApp outbox consumer (#62, #86): the seat call when a member is called from the waitlist,
 * the receipt-ready notice, and a published promotion offered to a member who opted in to marketing. A messaging consumer, so a messaging stop holds every send; practice-venue
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
