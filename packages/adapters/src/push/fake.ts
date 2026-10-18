import { err, ok } from '@rivr/contracts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { PushAdapter, PushFailure, PushNotification } from './types.ts';

/** The fake push adapter with its call log and failure script. */
export type FakePush = PushAdapter & FakeControls<PushNotification, PushFailure>;

/** Push that delivers nothing and records every notification. */
export function createFakePush(): FakePush {
  const recorder = createRecorder<PushNotification, PushFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async send(notification) {
      const failure = recorder.record(notification);
      return failure ? err(failure) : ok({ id: `fake-push-${recorder.calls.length}` });
    },
  };
}
