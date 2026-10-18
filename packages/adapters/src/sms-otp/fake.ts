import { err, ok, type IndianMobile } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { SmsOtpAdapter } from './types.ts';

/** A code the fake was asked to send. */
export interface SmsOtpCall {
  readonly to: IndianMobile;
  readonly code: string;
}

/** The fake SMS adapter, which also lets a test read the code a number was sent. */
export type FakeSmsOtp = SmsOtpAdapter &
  FakeControls<SmsOtpCall, AdapterFailure> & {
    /** The last code sent to `to`, for a test to sign in with. */
    lastCodeFor(to: IndianMobile): string | undefined;
  };

/** SMS that sends nothing and remembers every code. */
export function createFakeSmsOtp(): FakeSmsOtp {
  const recorder = createRecorder<SmsOtpCall, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async sendOtp({ to, code }) {
      const failure = recorder.record({ to, code });
      return failure ? err(failure) : ok({ messageId: `fake-sms-${recorder.calls.length}` });
    },
    lastCodeFor: (to) => recorder.calls.findLast((call) => call.to === to)?.code,
  };
}
