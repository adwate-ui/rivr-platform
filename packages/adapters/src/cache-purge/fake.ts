import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { CachePurgeAdapter } from './types.ts';

/** The fake cache purge with its call log and failure script. */
export type FakeCachePurge = CachePurgeAdapter & FakeControls<{ readonly urls: readonly string[] }, AdapterFailure>;

/** A cache purge that purges nothing and records the URLs. */
export function createFakeCachePurge(): FakeCachePurge {
  const recorder = createRecorder<{ readonly urls: readonly string[] }, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async purgeUrls({ urls }) {
      const failure = recorder.record({ urls });
      if (failure) return err(failure);
      return urls.length > 0 ? ok({ purgeId: `fake-purge-${recorder.calls.length}` }) : err({ code: 'rejected', reason: 'no URLs to purge' });
    },
  };
}
