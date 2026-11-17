import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { EmailAdapter, EmailMessage } from './types.ts';

/** The fake email adapter: it sends nothing and remembers every message. */
export type FakeEmail = EmailAdapter & FakeControls<EmailMessage, AdapterFailure>;

/** Email that sends nothing and remembers every message. */
export function createFakeEmail(): FakeEmail {
  const recorder = createRecorder<EmailMessage, AdapterFailure>();
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async send(message) {
      const failure = recorder.record(message);
      return failure ? err(failure) : ok({ messageId: `fake-email-${recorder.calls.length}` });
    },
  };
}
