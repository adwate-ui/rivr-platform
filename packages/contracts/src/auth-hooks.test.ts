import { describe, expect, it } from 'vitest';
import { sendSmsHookSchema } from './auth-hooks.ts';

// What Supabase Auth posts to the Send SMS hook: the whole user, and the code it generated.
const payload = {
  user: { id: '00000000-0000-4000-8000-000000000201', aud: 'authenticated', phone: '919000000201', app_metadata: {} },
  sms: { otp: '482913' },
};

describe('the Send SMS hook payload', () => {
  it('gives the phone in E.164 form, the six-digit code and English by default', () => {
    expect(sendSmsHookSchema.parse(payload)).toEqual({ to: '+919000000201', code: '482913', language: 'en' });
  });

  it('gives Hindi when the sign-up asked for it, and English for anything else', () => {
    const inHindi = { ...payload, user: { ...payload.user, user_metadata: { language: 'hi' } } };
    const inKlingon = { ...payload, user: { ...payload.user, user_metadata: { language: 'tlh' } } };
    expect(sendSmsHookSchema.parse(inHindi).language).toBe('hi');
    expect(sendSmsHookSchema.parse(inKlingon).language).toBe('en');
  });

  it('refuses a phone that is not an Indian mobile', () => {
    expect(sendSmsHookSchema.safeParse({ ...payload, user: { ...payload.user, phone: '14155550100' } }).success).toBe(false);
  });

  it('refuses a code that is not six digits', () => {
    expect(sendSmsHookSchema.safeParse({ ...payload, sms: { otp: '4829' } }).success).toBe(false);
  });

  it('refuses a payload without a user phone', () => {
    expect(sendSmsHookSchema.safeParse({ user: { id: 'x' }, sms: payload.sms }).success).toBe(false);
  });
});
