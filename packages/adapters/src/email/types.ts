import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** An email: to one to five addresses, its subject and its plain text. */
export interface EmailMessage {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
}

/** Sends email (#1066): the super admins' alerts. The vendor's message id comes back. */
export interface EmailAdapter {
  send(message: EmailMessage): Promise<Result<{ readonly messageId: string }, AdapterFailure>>;
}
