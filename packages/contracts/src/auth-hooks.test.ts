import { describe, expect, it } from 'vitest';
import { PHONE_CHANGE, sendSmsHookSchema } from './auth-hooks.ts';

// What Supabase Auth posts to the Send SMS hook: the user, and in `sms` the code it generated and
// the number it is checking (Supabase Auth v2.197, internal/api/phone.go).
const payload = {
  user: { id: '00000000-0000-4000-8000-000000000201', aud: 'authenticated', phone: '919000000201', app_metadata: {} },
  sms: { otp: '482913', phone: '919000000201' },
};

describe('the Send SMS hook payload', () => {
  it('gives the number being checked in E.164 form and the six-digit code', () => {
    expect(sendSmsHookSchema.parse(payload)).toEqual({ to: '+919000000201', code: '482913' });
  });

  it('refuses any code but one to the login\'s own number: a phone change, or a login with no number', () => {
    const toAnother = { user: { ...payload.user, phone: '919811111111' }, sms: { otp: '482913', phone: '919822222222' } };
    const noNumber = { user: { ...payload.user, phone: '' }, sms: { otp: '482913', phone: '919822222222' } };
    const noUser = { sms: { otp: '482913', phone: '919822222222' } };
    for (const phoneChange of [toAnother, noNumber, noUser]) {
      const parsed = sendSmsHookSchema.safeParse(phoneChange);
      expect(parsed.success ? null : parsed.error.issues[0]?.message).toBe(PHONE_CHANGE);
    }
  });

  it('refuses a number that is not an Indian mobile', () => {
    expect(sendSmsHookSchema.safeParse({ ...payload, sms: { ...payload.sms, phone: '14155550100' } }).success).toBe(false);
  });

  it('refuses a code that is not six digits', () => {
    expect(sendSmsHookSchema.safeParse({ ...payload, sms: { ...payload.sms, otp: '4829' } }).success).toBe(false);
  });

  it('refuses a payload that does not say which number to send to', () => {
    expect(sendSmsHookSchema.safeParse({ ...payload, sms: { otp: '482913' } }).success).toBe(false);
  });

  it('sends no code for a device\'s own login, so its number never moves to a phone (#41)', () => {
    const deviceChange = {
      user: { ...payload.user, phone: '999123456789012', app_metadata: { provider: 'phone', device_id: '00000000-0000-4000-8000-00000000d001' } },
      sms: { otp: '482913', phone: '919822222222' },
    };
    expect(sendSmsHookSchema.safeParse(deviceChange).success).toBe(false);
  });
});
