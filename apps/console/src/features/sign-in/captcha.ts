/**
 * Cloudflare Turnstile's site key for the sign-in steps (#182), set by the deploy. Empty on a local
 * stack and until the owner adds one: no check is drawn and Auth asks for none.
 */
export const CAPTCHA_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
