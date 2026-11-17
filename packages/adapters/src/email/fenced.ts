import { err } from '@rivr/contracts';
import type { EmailAdapter } from './types.ts';

/**
 * Staging's fence (#1066), as WhatsApp's (decision 0297): with an allowlist (addresses separated by commas), mail goes only
 * to the listed addresses among those it is for, and is refused unsent when none is listed. With none, as in production,
 * every message goes.
 */
export function fencedEmail(email: EmailAdapter, allowlist: string): EmailAdapter {
  const allowed = allowlist.split(',').map((one) => one.trim().toLowerCase()).filter((one) => one !== '');
  if (allowed.length === 0) return email;
  return {
    send: (message) => {
      const to = message.to.filter((one) => allowed.includes(one.toLowerCase()));
      return to.length === 0 ? Promise.resolve(err({ code: 'rejected', reason: 'not on the allowlist' })) : email.send({ ...message, to });
    },
  };
}
