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
  it('sends no code but to the login\'s own number: not for a phone change, nor to a login with no number', async () => {
    const whatsapp = createFakeWhatsApp();
    const smsOtp = createFakeSmsOtp();
    const refused = refusal(403, 'Your phone number is changed at the club. Please ask at the front desk.');
    const toAnother = { user: { id: 'u1', phone: '919000000201' }, sms: { otp: '482913', phone: '919800000999' } };
    const noNumber = { user: { id: 'u2', phone: '' }, sms: { otp: '482913', phone: '919800000999' } };

    expect(await handleSendSmsHook(toAnother, { whatsapp, smsOtp })).toEqual(refused);
    expect(await handleSendSmsHook(noNumber, { whatsapp, smsOtp })).toEqual(refused);
    expect([whatsapp.calls.length, smsOtp.calls.length]).toEqual([0, 0]);
  });

  it('still sends to a login whose number Auth gives with or without its plus', async () => {
    const whatsapp = createFakeWhatsApp();
    const plus = { user: { id: 'u1', phone: '+919000000201' }, sms: { otp: '482913', phone: '919000000201' } };

    expect(await handleSendSmsHook(plus, { whatsapp })).toEqual({ status: 200, body: {} });
    expect(whatsapp.calls.length).toBe(1);
  });

  it('answers 200 with an empty body once a channel has delivered the code', async () => {
    const whatsapp = createFakeWhatsApp();

    expect(await handleSendSmsHook(payload, { whatsapp })).toEqual({ status: 200, body: {} });
    expect(whatsapp.calls[0]?.params).toEqual(['482913']);
  });

  it('sends a second code within ten minutes by SMS first: the first may never have reached WhatsApp', async () => {
    const whatsapp = createFakeWhatsApp();
    const smsOtp = createFakeSmsOtp();
    const noted: string[] = [];
    const noteSend = async (to: string) => {
      noted.push(to);
      return noted.length > 1;
    };

    await handleSendSmsHook(payload, { whatsapp, smsOtp }, noteSend);
    expect([whatsapp.calls.length, smsOtp.calls.length]).toEqual([1, 0]);
    expect(await handleSendSmsHook(payload, { whatsapp, smsOtp }, noteSend)).toEqual({ status: 200, body: {} });
    expect([whatsapp.calls.length, smsOtp.calls.length]).toEqual([1, 1]);
    expect(smsOtp.calls[0]).toEqual({ to: '+919000000201', code: '482913' });
    expect(noted).toEqual(['+919000000201', '+919000000201']);
  });

  it('falls back to WhatsApp when the SMS for a second code fails, and to WhatsApp alone without SMS', async () => {
    const whatsapp = createFakeWhatsApp();
    const smsOtp = createFakeSmsOtp();
    smsOtp.failNext({ code: 'unavailable' });
    const again = async () => true;

    expect(await handleSendSmsHook(payload, { whatsapp, smsOtp }, again)).toEqual({ status: 200, body: {} });
    expect(await handleSendSmsHook(payload, { whatsapp }, again)).toEqual({ status: 200, body: {} });
    expect(whatsapp.calls).toHaveLength(2);
  });

  it('refuses a payload that is not a code for an Indian mobile', async () => {
    const notIndian = { user: { id: 'u1', phone: '14155550100' }, sms: { otp: '482913', phone: '14155550100' } };

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
