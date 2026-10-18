import { err, ok, panSchema, type MemberId, type Pan } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { DigiLockerRecord, KycAdapter } from './types.ts';

/** A call the fake KYC adapter received. */
export type KycCall =
  | { readonly method: 'startDigiLocker'; readonly memberId: MemberId }
  | { readonly method: 'pullDigiLocker'; readonly sessionId: string }
  | { readonly method: 'verifyPan'; readonly pan: Pan }
  | { readonly method: 'checkLiveness' }
  | { readonly method: 'matchFace' };

/** How the fake answers; everything passes by default. */
export interface FakeKycOptions {
  readonly record?: Partial<DigiLockerRecord>;
  readonly isPanValid?: boolean;
  readonly liveness?: { readonly isLive: boolean; readonly score: number };
  readonly faceMatch?: { readonly isMatch: boolean; readonly score: number };
}

/** The fake KYC adapter with its call log and failure script. */
export type FakeKyc = KycAdapter & FakeControls<KycCall, AdapterFailure>;

// A fictional adult. Only the masked Aadhaar exists, as in production.
const FICTIONAL_RECORD: DigiLockerRecord = {
  name: 'Test Member',
  dateOfBirth: '1990-01-01',
  maskedAadhaar: 'XXXX XXXX 0000',
  pan: panSchema.parse('ABCPE1234F'),
  address: 'Sector 65, Gurugram, Haryana',
  photoUrl: 'https://kyc.invalid/photo.jpg',
  vendorReference: 'fake-digilocker',
};

// The fake's sessions carry their own mark, so a pull in a later request (a new Edge Function
// invocation, with no memory of the start) still recognises them.
const FAKE_SESSION = 'fake-digilocker-';

/** KYC that passes everyone unless told otherwise. For tests, Storybook and the practice venue. */
export function createFakeKyc(options: FakeKycOptions = {}): FakeKyc {
  const recorder = createRecorder<KycCall, AdapterFailure>();
  const record = { ...FICTIONAL_RECORD, ...options.record };
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async startDigiLocker({ memberId, returnUrl }) {
      const failure = recorder.record({ method: 'startDigiLocker', memberId });
      if (failure) return err(failure);
      // The fake consents at once: the member goes straight back to the app, never to a pretend DigiLocker page.
      return ok({ sessionId: `${FAKE_SESSION}${memberId}`, redirectUrl: returnUrl });
    },
    async pullDigiLocker({ sessionId }) {
      const failure = recorder.record({ method: 'pullDigiLocker', sessionId });
      if (failure) return err(failure);
      return sessionId.startsWith(FAKE_SESSION) ? ok(record) : err({ code: 'rejected', reason: 'unknown DigiLocker session' });
    },
    async verifyPan({ pan }) {
      const failure = recorder.record({ method: 'verifyPan', pan });
      const isValid = options.isPanValid ?? true;
      return failure ? err(failure) : ok({ isValid, nameMatches: isValid, vendorReference: 'fake-pan' });
    },
    async checkLiveness() {
      const failure = recorder.record({ method: 'checkLiveness' });
      const liveness = options.liveness ?? { isLive: true, score: 98 };
      return failure ? err(failure) : ok({ ...liveness, vendorReference: 'fake-liveness' });
    },
    async matchFace() {
      const failure = recorder.record({ method: 'matchFace' });
      const faceMatch = options.faceMatch ?? { isMatch: true, score: 97 };
      return failure ? err(failure) : ok({ ...faceMatch, vendorReference: 'fake-face-match' });
    },
  };
}
