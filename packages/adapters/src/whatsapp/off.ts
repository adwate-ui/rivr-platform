import { ok } from '@rivr/contracts';
import type { WhatsAppAdapter } from './types.ts';

/**
 * WhatsApp switched off: every message is taken and none is sent. The consumers send through it where `WHATSAPP_OFF=true`, as
 * on production (the owner, 19 Nov 2026: no WhatsApp there), so nothing waits in the outbox and no consumer looks silent.
 */
export const whatsAppOff: WhatsAppAdapter = {
  async sendTemplate() {
    return ok({ messageId: 'whatsapp-off' });
  },
};
