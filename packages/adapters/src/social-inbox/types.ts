import type { InboxChannel, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A message someone sent RIVR on a social channel. */
export interface InboxMessage {
  readonly id: string;
  readonly channel: InboxChannel;
  readonly threadId: string;
  /** The sender's public handle on the channel. */
  readonly fromHandle: string;
  readonly text: string;
  readonly receivedAt: Date;
}

/** The social inbox: Instagram, Facebook and WhatsApp messages, answered from the console. */
export interface SocialInboxAdapter {
  /** Messages on one channel received at or after `since`; the caller drops ids it already holds. */
  listMessages(input: {
    readonly channel: InboxChannel;
    readonly since: Date;
  }): Promise<Result<readonly InboxMessage[], AdapterFailure>>;
  /** Replies in a thread. */
  reply(input: {
    readonly channel: InboxChannel;
    readonly threadId: string;
    readonly text: string;
  }): Promise<Result<{ readonly messageId: string }, AdapterFailure>>;
}
