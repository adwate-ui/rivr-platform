import { describe, expect, it } from 'vitest';
import { createFakeSmsOtp } from '../sms-otp/index.ts';
import { createFakeWhatsApp } from '../whatsapp/index.ts';
import { handleSendSmsHook } from './index.ts';

const payload = { user: { id: 'u1', phone: '919000000201' }, sms: { otp: '482913' } };

describe('handleSendSmsHook', () => {
  it('answers 200 once a channel has delivered the code', async () => {
    const whatsapp = createFakeWhatsApp();

    expect(await handleSendSmsHook(payload, { whatsapp })).toEqual({ status: 200, body: {} });
    expect(whatsapp.calls[0]?.params).toEqual(['482913']);
  });

  it('answers 400 to a payload that is not a code for an Indian mobile', async () => {
    const result = await handleSendSmsHook({ user: { phone: '14155550100' }, sms: { otp: '482913' } }, { whatsapp: createFakeWhatsApp() });

    expect(result.status).toBe(400);
  });

  it('answers 503 when no channel is configured, so Auth tells the app the code was not sent', async () => {
    expect(await handleSendSmsHook(payload, {})).toEqual({
      status: 503,
      body: { error: { http_code: 503, message: 'Sign-in codes cannot be sent yet.' } },
    });
  });

  it('answers 429 when the channels are rate-limited', async () => {
    const smsOtp = createFakeSmsOtp();
    smsOtp.failNext({ code: 'rate_limited' });

    expect((await handleSendSmsHook(payload, { smsOtp })).status).toBe(429);
  });

  it('answers 502 when every channel failed', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'rejected', reason: 'WhatsApp error 132001' });

    const result = await handleSendSmsHook(payload, { whatsapp });

    expect(result).toEqual({ status: 502, body: { error: { http_code: 502, message: 'The code could not be sent. Try again.' } } });
  });
});
