import { err, ok } from '@rivr/contracts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { LiveStatusAdapter, LiveStatusFailure, LiveStatusShow, PhoneAlert, PhoneAlertFailure } from './types.ts';

/** The fake live status with its call log and failure script. */
export type FakeLiveStatus = LiveStatusAdapter & FakeControls<LiveStatusShow, LiveStatusFailure> & {
  /** Every alert received, oldest first. */
  readonly alerts: readonly PhoneAlert[];
  /** Makes the next alert fail with `failure`. */
  failNextAlert(failure: PhoneAlertFailure): void;
};

/** A live status that reaches no phone and records every status. */
export function createFakeLiveStatus(): FakeLiveStatus {
  const recorder = createRecorder<LiveStatusShow, LiveStatusFailure>();
  const alerts = createRecorder<PhoneAlert, PhoneAlertFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async show(input) {
      const failure = recorder.record(input);
      return failure ? err(failure) : ok({ id: `fake-live-status-${recorder.calls.length}` });
    },
    alerts: alerts.calls,
    failNextAlert: (failure) => alerts.failNext(failure),
    async alert(input) {
      const failure = alerts.record(input);
      return failure ? err(failure) : ok({ id: `fake-alert-${alerts.calls.length}` });
    },
  };
}
