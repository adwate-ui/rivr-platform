import type { IndianMobile, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

interface TemplateMessage {
  readonly to: IndianMobile;
  /** The approved template's name, `seat_ready`. Every template is in English (decision 0027). */
  readonly template: string;
  readonly params: readonly string[];
}

/**
 * A template message. Utility and authentication messages (seat ready, withdrawal sent, sign-in
 * code) need no opt-in; marketing needs the time the member opted in, so it cannot be sent without one.
 */
export type WhatsAppMessage =
  | (TemplateMessage & { readonly category: 'utility' | 'authentication' })
  | (TemplateMessage & { readonly category: 'marketing'; readonly optedInAt: Date });

/** Sends WhatsApp template messages. */
export interface WhatsAppAdapter {
  /** Sends one template message. */
  sendTemplate(message: WhatsAppMessage): Promise<Result<{ readonly messageId: string }, AdapterFailure>>;
}
