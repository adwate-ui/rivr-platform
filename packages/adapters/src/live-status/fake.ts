import { err, ok } from '@rivr/contracts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { LiveStatusAdapter, LiveStatusFailure, LiveStatusShow } from './types.ts';

/** The fake live status with its call log and failure script. */
export type FakeLiveStatus = LiveStatusAdapter & FakeControls<LiveStatusShow, LiveStatusFailure>;

/** A live status that reaches no phone and records every status. */
export function createFakeLiveStatus(): FakeLiveStatus {
  const recorder = createRecorder<LiveStatusShow, LiveStatusFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async show(input) {
      const failure = recorder.record(input);
      return failure ? err(failure) : ok({ id: `fake-live-status-${recorder.calls.length}` });
    },
  };
}
