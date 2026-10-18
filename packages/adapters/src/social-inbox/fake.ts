import { err, ok, type InboxChannel } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import { createRecorder, type FakeControls } from '../shared/recorder.ts';
import type { InboxMessage, SocialInboxAdapter } from './types.ts';

/** A call the fake inbox received. */
export type SocialInboxCall =
  | { readonly method: 'listMessages'; readonly channel: InboxChannel; readonly since: Date }
  | { readonly method: 'reply'; readonly channel: InboxChannel; readonly threadId: string; readonly text: string };

/** The fake inbox, which a test fills with `receive`. */
export type FakeSocialInbox = SocialInboxAdapter &
  FakeControls<SocialInboxCall, AdapterFailure> & {
    /** Delivers a message as if someone had just sent it. */
    receive(message: InboxMessage): void;
  };

/** An inbox that holds only the messages a test delivers. */
export function createFakeSocialInbox(): FakeSocialInbox {
  const recorder = createRecorder<SocialInboxCall, AdapterFailure>();
  const messages: InboxMessage[] = [];
  return {
    calls: recorder.calls,
    failNext: (failure) => recorder.failNext(failure),
    receive: (message) => void messages.push(message),
    async listMessages({ channel, since }) {
      const failure = recorder.record({ method: 'listMessages', channel, since });
      if (failure) return err(failure);
      return ok(messages.filter((message) => message.channel === channel && message.receivedAt >= since));
    },
    async reply({ channel, threadId, text }) {
      const failure = recorder.record({ method: 'reply', channel, threadId, text });
      const replies = recorder.calls.filter((call) => call.method === 'reply').length;
      return failure ? err(failure) : ok({ messageId: `fake-reply-${replies}` });
    },
  };
}
