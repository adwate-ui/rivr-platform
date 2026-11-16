import { err, ok, type IndianMobile } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { VerifyNowAdapter } from './types.ts';

/** A number the fake was asked to text a code. */
export interface VerifyNowCall {
  readonly to: IndianMobile;
}

/** The fake VerifyNow, which also lets a test read the code it "texted". */
export type FakeVerifyNow = VerifyNowAdapter &
  FakeControls<VerifyNowCall, AdapterFailure> & {
    /** The code texted under `verificationId`, until it is accepted. */
    codeOf(verificationId: string): string | undefined;
  };

/** VerifyNow that texts nothing: each send makes a code of its own, which a check then accepts once. */
export function createFakeVerifyNow(): FakeVerifyNow {
  const recorder = createRecorder<VerifyNowCall, AdapterFailure>();
  const codes = new Map<string, string>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async send({ to }) {
      const failure = recorder.record({ to });
      if (failure) return err(failure);
      const verificationId = `fake-${String(recorder.calls.length)}`;
      codes.set(verificationId, String(482_900 + recorder.calls.length));
      return ok({ verificationId });
    },
    async check({ verificationId, code }) {
      const sent = codes.get(verificationId);
      if (sent === undefined) return err('expired');
      if (sent !== code) return err('wrong_code');
      codes.delete(verificationId);
      return ok(null);
    },
    codeOf: (verificationId) => codes.get(verificationId),
  };
}
