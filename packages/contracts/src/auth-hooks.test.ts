import { describe, expect, it } from 'vitest';
import { sendSmsHookSchema } from './auth-hooks.ts';

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

  it('sends a phone change to the new number, never the old one', () => {
    const phoneChange = {
      user: { ...payload.user, phone: '919811111111', new_phone: '919822222222' },
      sms: { otp: '482913', phone: '919822222222' },
    };
    expect(sendSmsHookSchema.parse(phoneChange).to).toBe('+919822222222');
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
});
