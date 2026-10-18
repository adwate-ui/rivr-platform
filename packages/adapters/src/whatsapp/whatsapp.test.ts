import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeWhatsApp, type WhatsAppMessage } from './index.ts';

const to = indianMobileSchema.parse('+919000000001');

describe('fake WhatsApp', () => {
  it('sends a utility template without an opt-in', async () => {
    const whatsapp = createFakeWhatsApp();
    const seatReady: WhatsAppMessage = {
      category: 'utility',
      to,
      template: 'seat_ready',
      language: 'en',
      params: ['Table 3', '6'],
    };

    expect(await whatsapp.sendTemplate(seatReady)).toEqual({ ok: true, value: { messageId: 'fake-whatsapp-1' } });
    expect(whatsapp.calls).toEqual([seatReady]);
  });

  it('sends a marketing template only with the opt-in the type demands', async () => {
    const whatsapp = createFakeWhatsApp({ now: () => new Date('2026-11-17T00:00:00Z') });
    const optedInAt = new Date('2026-11-01T10:00:00Z');

    const sent = await whatsapp.sendTemplate({ category: 'marketing', to, template: 'promo', language: 'hi', params: [], optedInAt });

    expect(sent.ok).toBe(true);
    // @ts-expect-error A marketing message without an opt-in does not compile.
    const withoutOptIn: WhatsAppMessage = { category: 'marketing', to, template: 'promo', language: 'en', params: [] };
    expect(withoutOptIn.category).toBe('marketing');
  });

  it('refuses a marketing message whose opt-in is dated in the future', async () => {
    const whatsapp = createFakeWhatsApp({ now: () => new Date('2026-11-17T00:00:00Z') });
    const optedInAt = new Date('2026-11-18T00:00:00Z');

    expect(await whatsapp.sendTemplate({ category: 'marketing', to, template: 'promo', language: 'en', params: [], optedInAt })).toEqual({
      ok: false,
      error: { code: 'rejected', reason: 'no opt-in recorded before sending' },
    });
  });

  it('fails the next send when a test scripts it', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'unavailable' });

    const sent = await whatsapp.sendTemplate({ category: 'utility', to, template: 'x', language: 'en', params: [] });

    expect(sent).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
