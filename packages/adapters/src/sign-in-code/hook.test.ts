import { describe, expect, it, vi } from 'vitest';
import { createFakeSmsOtp } from '../sms-otp/index.ts';
import { createFakeVerifyNow } from '../verify-now/index.ts';
import { createFakeWhatsApp } from '../whatsapp/index.ts';
import { handleSendSmsHook, relaySmsHook } from './index.ts';

const payload = { user: { id: 'u1', phone: '919000000201' }, sms: { otp: '482913', phone: '919000000201' } };

// Auth reads an error only from an HTTP 200 reply, and passes its http_code and message to the app. A code not sent is
// 424, never a 5xx: Supabase's gateway repeats a request Auth answers with a 5xx, CAPTCHA token and all (decision 0683).
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

  it('sends no ten-digit code by WhatsApp or SMS: Auth\'s length was left at VerifyNow\'s (decision 0679)', async () => {
    const whatsapp = createFakeWhatsApp();
    const tenDigits = { ...payload, sms: { ...payload.sms, otp: '1357924680' } };

    expect(await handleSendSmsHook(tenDigits, { whatsapp })).toEqual(refusal(424, 'Sign-in codes cannot be sent yet. (Auth code length)'));
    expect(whatsapp.calls).toEqual([]);
  });

  it('tells the app codes cannot be sent when no channel is configured', async () => {
    expect(await handleSendSmsHook(payload, {})).toEqual(refusal(424, 'Sign-in codes cannot be sent yet. (send: not configured)'));
  });

  it('tells the app to wait when the channels are rate-limited', async () => {
    const smsOtp = createFakeSmsOtp();
    smsOtp.failNext({ code: 'rate_limited' });

    expect(await handleSendSmsHook(payload, { smsOtp })).toEqual(refusal(429, 'Too many codes were sent. Wait a minute and try again.'));
  });

  it('lets the app ask for the code when WhatsApp is still sending as Auth\'s time runs out', async () => {
    vi.useFakeTimers();
    try {
      const slowWhatsApp = { sendTemplate: () => new Promise<never>(() => undefined) };
      const kept: Promise<unknown>[] = [];
      const replying = handleSendSmsHook(payload, { whatsapp: slowWhatsApp }, undefined, (send) => kept.push(send));
      await vi.advanceTimersByTimeAsync(5_000);

      expect(await replying).toEqual({ status: 200, body: {} });
      expect(kept).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells the app the code was not sent when every channel failed, and Auth\'s log which step and why', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'rejected', reason: 'WhatsApp error 132001' });

    expect(await handleSendSmsHook(payload, { whatsapp })).toEqual(refusal(424, 'The code could not be sent. Try again. (send: WhatsApp error 132001)'));
  });

  it('masks any long run of digits in the reason: the message reaches the caller as well as Auth\'s log', async () => {
    const whatsapp = createFakeWhatsApp();
    whatsapp.failNext({ code: 'rejected', reason: 'bridge busy for 919000000201' });

    expect(await handleSendSmsHook(payload, { whatsapp })).toEqual(refusal(424, 'The code could not be sent. Try again. (send: bridge busy for [digits])'));
  });
});

describe('relaySmsHook, while VerifyNow sends the codes', () => {
  /** Auth's code while VerifyNow sends the codes: ten digits (`sms_otp_length`, decision 0679). */
  const relayed = { ...payload, sms: { ...payload.sms, otp: '1357924680' } };

  /** Records what the hook keeps; `isKept` is what the database answers. */
  function keeper(isKept = true) {
    const kept: { to: string; code: string; verificationId: string | null }[] = [];
    const keep = async (to: string, code: string, verificationId: string | null) => {
      kept.push({ to, code, verificationId });
      return isKept;
    };
    return { keep, kept };
  }

  it('has VerifyNow text the number its own code, and keeps Auth\'s with VerifyNow\'s check', async () => {
    const verifyNow = createFakeVerifyNow();
    const { keep, kept } = keeper();

    expect(await relaySmsHook(relayed, verifyNow, keep)).toEqual({ status: 200, body: {} });
    expect(verifyNow.calls).toEqual([{ to: '+919000000201' }]);
    expect(kept).toEqual([{ to: '+919000000201', code: '1357924680', verificationId: 'fake-1' }]);
  });

  it('keeps Auth\'s new code with VerifyNow\'s last check when VerifyNow will not text the number again yet', async () => {
    const stillStands = { send: async () => ({ ok: true as const, value: { verificationId: null } }), check: createFakeVerifyNow().check };
    const { keep, kept } = keeper();

    expect(await relaySmsHook(relayed, stillStands, keep)).toEqual({ status: 200, body: {} });
    expect(kept[0]?.verificationId).toBeNull();
    // That check accepted, spent or never kept: nothing can be sent until VerifyNow's minute passes.
    expect(await relaySmsHook(relayed, stillStands, keeper(false).keep))
      .toEqual(refusal(429, 'Too many codes were sent. Wait a minute and try again.'));
  });

  it('gives keeping the code what is left of Auth\'s time once VerifyNow has sent', async () => {
    const deadlines: number[] = [];
    const before = Date.now();
    await relaySmsHook(relayed, createFakeVerifyNow(), async (_to, _code, _id, deadline) => deadlines.push(deadline) > 0);

    expect(deadlines[0]).toBeGreaterThanOrEqual(before + 4_500);
    expect(deadlines[0]).toBeLessThanOrEqual(Date.now() + 4_500);
  });

  it('relays only a ten-digit Auth code: a shorter one means sign-in is down until Auth\'s length is set (decision 0679)', async () => {
    const verifyNow = createFakeVerifyNow();
    const { keep, kept } = keeper();

    expect(await relaySmsHook(payload, verifyNow, keep)).toEqual(refusal(424, 'Sign-in codes cannot be sent yet. (Auth code length)'));
    expect([verifyNow.calls.length, kept.length]).toEqual([0, 0]);
  });

  it('tells the app the code was not sent when VerifyNow fails or the code cannot be kept, and to wait at VerifyNow\'s limit', async () => {
    const verifyNow = createFakeVerifyNow();
    verifyNow.failNext({ code: 'unavailable', reason: 'VerifyNow did not answer' });
    verifyNow.failNext({ code: 'rate_limited' });
    const { keep, kept } = keeper();

    expect(await relaySmsHook(relayed, verifyNow, keep)).toEqual(refusal(424, 'The code could not be sent. Try again. (send: VerifyNow did not answer)'));
    expect(await relaySmsHook(relayed, verifyNow, keep)).toEqual(refusal(429, 'Too many codes were sent. Wait a minute and try again.'));
    expect(kept).toEqual([]);
    // VerifyNow has texted the member, but the code they type cannot be checked: Auth's log tells the two apart.
    expect(await relaySmsHook(relayed, verifyNow, keeper(false).keep)).toEqual(refusal(424, 'The code could not be sent. Try again. (keep: unavailable)'));
  });

  it('sends nothing for a phone change or a number that is not an Indian mobile', async () => {
    const verifyNow = createFakeVerifyNow();
    const toAnother = { user: { id: 'u1', phone: '919000000201' }, sms: { otp: '482913', phone: '919800000999' } };
    const notIndian = { user: { id: 'u1', phone: '14155550100' }, sms: { otp: '482913', phone: '14155550100' } };

    expect((await relaySmsHook(toAnother, verifyNow, keeper().keep)).body).toMatchObject({ error: { http_code: 403 } });
    expect((await relaySmsHook(notIndian, verifyNow, keeper().keep)).body).toMatchObject({ error: { http_code: 400 } });
    expect(verifyNow.calls).toEqual([]);
  });
});
