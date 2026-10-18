import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { CctvAdapter } from './types.ts';

/** The fake recorder with its call log and failure script. */
export type FakeCctv = CctvAdapter & FakeControls<{ readonly cameraId: string; readonly at: Date }, AdapterFailure>;

/** A recorder whose links point at a `.invalid` domain, which never resolves. */
export function createFakeCctv(): FakeCctv {
  const recorder = createRecorder<{ readonly cameraId: string; readonly at: Date }, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async playbackLink({ cameraId, at }) {
      const failure = recorder.record({ cameraId, at });
      if (failure) return err(failure);
      const query = new URLSearchParams({ camera: cameraId, at: at.toISOString() });
      return ok({ url: `https://cctv.invalid/playback?${query.toString()}` });
    },
  };
}
