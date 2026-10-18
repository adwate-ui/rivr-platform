import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeSmsOtp } from './index.ts';

const phone = indianMobileSchema.parse('+919000000001');

describe('fake SMS OTP', () => {
  it('records each code so a test can sign in with the latest one', async () => {
    const sms = createFakeSmsOtp();

    expect(await sms.sendOtp({ to: phone, code: '482913' })).toEqual({ ok: true, value: { messageId: 'fake-sms-1' } });
    await sms.sendOtp({ to: phone, code: '105377' });

    expect(sms.lastCodeFor(phone)).toBe('105377');
    expect(sms.lastCodeFor(indianMobileSchema.parse('+919000000002'))).toBeUndefined();
  });

  it('fails the next send when a test scripts it', async () => {
    const sms = createFakeSmsOtp();
    sms.failNext({ code: 'rate_limited' });

    expect(await sms.sendOtp({ to: phone, code: '482913' })).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(sms.calls).toHaveLength(1);
  });
});
