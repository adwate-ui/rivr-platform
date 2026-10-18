import { describe, expect, it } from 'vitest';
import { createFakeSmsOtp } from '../sms-otp/index.ts';
import { createFakeWhatsApp } from '../whatsapp/index.ts';
import { handleSendSmsHook } from './index.ts';

const payload = { user: { id: 'u1', phone: '919000000201' }, sms: { otp: '482913', phone: '919000000201' } };

// Auth reads an error only from an HTTP 200 reply, and passes its http_code and message to the app.
function refusal(httpCode: number, message: string) {
  return { status: 200, body: { error: { http_code: httpCode, message } } };
}

describe('handleSendSmsHook', () => {
  it('answers 200 with an empty body once a channel has delivered the code', async () => {
    const whatsapp = createFakeWhatsApp();

    expect(await handleSendSmsHook(payload, { whatsapp })).toEqual({ status: 200, body: {} });
    expect(whatsapp.calls[0]?.params).toEqual(['482913']);
  });

  it('refuses a payload that is not a code for an Indian mobile', async () => {
    const notIndian = { user: { id: 'u1' }, sms: { otp: '482913', phone: '14155550100' } };

    expect(await handleSendSmsHook(notIndian, { whatsapp: createFakeWhatsApp() })).toEqual(
      refusal(400, 'The hook payload is not a sign-in code for an Indian mobile.'),
    );
  });

  it('tells the app codes cannot be sent when no channel is configured', async () => {
    expect(await handleSendSmsHook(payload, {})).toEqual(refusal(503, 'Sign-in codes cannot be sent yet.'));
  });

  it('tells the app to wait when the channels are rate-limited', async () => {
    const smsOtp = createFakeSmsOtp();
    smsOtp.failNext({ code: 'rate_limited' });

    expect(await handleSendSmsHook(payload, { smsOtp })).toEqual(refusal(429, 'Too many codes were sent. Wait a minute and try again.'));
  });

  it('tells the app the code was not sent when every channel failed', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'rejected', reason: 'WhatsApp error 132001' });

    expect(await handleSendSmsHook(payload, { whatsapp })).toEqual(refusal(502, 'The code could not be sent. Try again.'));
  });
});
