import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import { toClickConversion } from './click-conversion.ts';
import type { GoogleAdsClickConversion, GoogleAdsConversionsAdapter } from './types.ts';

/** The fake Google Ads import. Its call log holds the hashed conversions Google would receive. */
export type FakeGoogleAds = GoogleAdsConversionsAdapter & FakeControls<GoogleAdsClickConversion, AdapterFailure>;

/** A Google Ads import that uploads nothing and keeps the hashed conversions. */
export function createFakeGoogleAds(): FakeGoogleAds {
  const recorder = createRecorder<GoogleAdsClickConversion, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async upload(conversion) {
      const failure = recorder.record(await toClickConversion(conversion));
      return failure ? err(failure) : ok({ accepted: 1 });
    },
  };
}
