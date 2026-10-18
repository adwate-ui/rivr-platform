import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { WhatsAppAdapter, WhatsAppMessage } from './types.ts';

/** The fake WhatsApp adapter with its call log and failure script. */
export type FakeWhatsApp = WhatsAppAdapter & FakeControls<WhatsAppMessage, AdapterFailure>;

/** WhatsApp that sends nothing, records every message and, like Meta, refuses marketing without an opt-in. */
export function createFakeWhatsApp(options: { readonly now?: () => Date } = {}): FakeWhatsApp {
  const recorder = createRecorder<WhatsAppMessage, AdapterFailure>();
  const now = options.now ?? (() => new Date());
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    async sendTemplate(message) {
      const failure = recorder.record(message);
      if (failure) return err(failure);
      if (message.category === 'marketing' && message.optedInAt > now()) {
        return err({ code: 'rejected', reason: 'no opt-in recorded before sending' });
      }
      return ok({ messageId: `fake-whatsapp-${recorder.calls.length}` });
    },
  };
}
