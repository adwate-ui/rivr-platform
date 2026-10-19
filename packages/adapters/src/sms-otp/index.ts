export type { SmsOtpAdapter } from './types.ts';
export { createFakeSmsOtp, type FakeSmsOtp, type SmsOtpCall } from './fake.ts';
export { createMsg91SmsOtp, MSG91_OTP_URL, type Msg91Options } from './live.ts';
