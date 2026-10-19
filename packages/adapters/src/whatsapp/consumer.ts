import { err, receiptReadySchema, waitlistCalledSchema, type IndianMobile, type Result } from '@rivr/contracts';
import { formatMoney, formatTime } from '@rivr/i18n';
import type { ClaimedDelivery, Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { WhatsAppAdapter, WhatsAppMessage } from './types.ts';

/** Who a message goes to: the member's number, and when they opted in to marketing, if they did. */
export interface MessageRecipient {
  readonly phone: IndianMobile;
  readonly marketingOptedInAt: Date | null;
}

/** Finds a member's number when a message is sent; null for a member who is no longer there. */
export type FindRecipient = (memberId: string) => Promise<MessageRecipient | null>;

/** The events the WhatsApp consumer sends a message for. */
export const WHATSAPP_EVENT_TYPES = ['waitlist.called', 'receipt.ready'] as const;

const rejected = (reason: string) => err<AdapterFailure>({ code: 'rejected', reason });

/** The template message for a delivery, or why there is none. Neither the number nor the payload is ever logged. */
async function messageFor(delivery: ClaimedDelivery, findRecipient: FindRecipient, now: Date): Promise<Result<WhatsAppMessage, AdapterFailure>> {
  if (delivery.eventType === 'waitlist.called') {
    const called = waitlistCalledSchema.safeParse(delivery.payload);
    if (!called.success) return rejected('waitlist.called payload is not a seat call');
    // A call claimed after its hold ran out would send the member to a seat that is gone.
    if (new Date(called.data.hold_until) <= now) return rejected('the hold has expired');
    const recipient = await findRecipient(called.data.member_id);
    if (!recipient) return rejected('the member is no longer there');
    const { table_name: table, seat, hold_until: holdUntil } = called.data;
    return { ok: true, value: { category: 'utility', to: recipient.phone, template: 'seat_ready', params: [table, String(seat), formatTime(new Date(holdUntil))] } };
  }
  if (delivery.eventType === 'receipt.ready') {
    const receipt = receiptReadySchema.safeParse(delivery.payload);
    if (!receipt.success) return rejected('receipt.ready payload is not a receipt');
    const recipient = await findRecipient(receipt.data.member_id);
    if (!recipient) return rejected('the member is no longer there');
    const amount = formatMoney(BigInt(receipt.data.amount_paise));
    return { ok: true, value: { category: 'utility', to: recipient.phone, template: 'receipt_ready', params: [amount], urlButton: receipt.data.link } };
  }
  return rejected(`no WhatsApp message for ${delivery.eventType}`);
}

/**
 * The WhatsApp outbox consumer (#62): the seat call when a member is called from the waitlist, and
 * the receipt-ready notice. A messaging consumer, so a messaging stop holds every send; practice-venue
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
      return message.ok ? whatsapp.sendTemplate(message.value) : message;
    },
  };
}
