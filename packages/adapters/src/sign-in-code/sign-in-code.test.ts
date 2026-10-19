import { indianMobileSchema } from '@rivr/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSmsOtp, type FakeSmsOtp } from '../sms-otp/index.ts';
import { createFakeWhatsApp, type FakeWhatsApp } from '../whatsapp/index.ts';
import { SIGN_IN_CODE_TEMPLATE, sendSignInCode } from './index.ts';

const to = indianMobileSchema.parse('+919000000201');
const code = '482913';
let whatsapp: FakeWhatsApp;
let smsOtp: FakeSmsOtp;

beforeEach(() => {
  whatsapp = createFakeWhatsApp();
  smsOtp = createFakeSmsOtp();
});

describe('sendSignInCode', () => {
  it('sends the WhatsApp authentication template with the code, and no SMS', async () => {
    expect(await sendSignInCode({ whatsapp, smsOtp }, { to, code })).toEqual({ ok: true, value: { channel: 'whatsapp', messageId: 'fake-whatsapp-1' } });
    expect(whatsapp.calls).toEqual([{ category: 'authentication', to, template: SIGN_IN_CODE_TEMPLATE, params: [code] }]);
    expect(smsOtp.calls).toEqual([]);
  });

  it('falls back to SMS when WhatsApp cannot deliver', async () => {
    whatsapp.failNext({ code: 'unavailable' });

    expect(await sendSignInCode({ whatsapp, smsOtp }, { to, code })).toEqual({ ok: true, value: { channel: 'sms', messageId: 'fake-sms-1' } });
    expect(smsOtp.lastCodeFor(to)).toBe(code);
  });

  it('uses SMS alone when WhatsApp is not configured', async () => {
    expect(await sendSignInCode({ smsOtp }, { to, code })).toEqual({ ok: true, value: { channel: 'sms', messageId: 'fake-sms-1' } });
  });

  it('reports the last failure when neither channel delivers', async () => {
    whatsapp.failNext({ code: 'unavailable' });
    smsOtp.failNext({ code: 'rate_limited' });

    expect(await sendSignInCode({ whatsapp, smsOtp }, { to, code })).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });

  it('fails closed with no channel configured, so a code is never "sent" by nobody', async () => {
    expect(await sendSignInCode({}, { to, code })).toEqual({ ok: false, error: { code: 'not_configured' } });
  });

  describe('within Auth\'s 5 seconds', () => {
    // Channels that never answer, as a vendor having an outage.
    const hangingWhatsApp = { sendTemplate: () => new Promise<never>(() => undefined) };
    const hangingSms = { sendOtp: () => new Promise<never>(() => undefined) };

    // On a fake clock, so the deadline is kept by the timers the send sets and not by how busy the
    // machine running the tests is (#304).
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Sends, lets `ms` of fake time pass, and says what came back and how long after the start it did. */
    async function sendOver(ms: number, channels: Parameters<typeof sendSignInCode>[0], preferSms = false) {
      const started = Date.now();
      let endedAfter = Number.POSITIVE_INFINITY;
      const sending = sendSignInCode(channels, { to, code, preferSms, deadline: started + 1_300 }).then((sent) => {
        endedAfter = Date.now() - started;
        return sent;
      });
      await vi.advanceTimersByTimeAsync(ms);
      return { sent: await sending, endedAfter };
    }

    it('gives up on a silent WhatsApp in time for SMS to go out before the deadline', async () => {
      const { sent, endedAfter } = await sendOver(1_300, { whatsapp: hangingWhatsApp, smsOtp });
      expect(sent).toEqual({ ok: true, value: { channel: 'sms', messageId: 'fake-sms-1' } });
      expect(endedAfter).toBeLessThan(1_300);
    });

    it('fails as unavailable, never late, when every channel is silent', async () => {
      const { sent, endedAfter } = await sendOver(1_400, { whatsapp: hangingWhatsApp, smsOtp: hangingSms }, true);
      expect(sent).toEqual({ ok: false, error: { code: 'unavailable' } });
      expect(endedAfter).toBeLessThan(1_400);
    });

    it('tries no channel once the deadline has passed', async () => {
      expect(await sendSignInCode({ whatsapp, smsOtp }, { to, code, deadline: Date.now() - 1 })).toEqual({ ok: false, error: { code: 'unavailable' } });
      expect(whatsapp.calls).toEqual([]);
    });
  });
});
