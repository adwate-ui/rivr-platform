import { indianMobileSchema } from '@rivr/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
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
});
