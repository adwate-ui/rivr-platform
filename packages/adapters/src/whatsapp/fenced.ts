import { err } from '@rivr/contracts';
import type { WhatsAppAdapter } from './types.ts';

/** Digits only, so `+91 98…`, `9198…` and `+9198…` name the same number. */
const digitsOf = (number: string) => number.replace(/\D/g, '');

/**
 * Staging's fence (decision 0297): with an allowlist (numbers separated by commas, `+91…` or `91…`), a message to any
 * other number is refused unsent, so the seed's made-up members never reach a stranger's phone. With none, as in
 * production, every message goes.
 */
export function fencedWhatsApp(whatsapp: WhatsAppAdapter, allowlist: string): WhatsAppAdapter {
  const allowed = allowlist.split(',').map(digitsOf).filter((number) => number !== '');
  if (allowed.length === 0) return whatsapp;
  return {
    sendTemplate: (message) =>
      allowed.includes(digitsOf(message.to)) ? whatsapp.sendTemplate(message) : Promise.resolve(err({ code: 'rejected', reason: 'not on the allowlist' })),
  };
}
