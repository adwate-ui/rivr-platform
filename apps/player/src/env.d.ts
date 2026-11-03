/// <reference types="vite-plugin-pwa/client" />

/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** The website's address, for the terms and privacy links on sign-in (#775); none in a build that does not name it. */
  readonly VITE_WEB_URL?: string;
  /** Cloudflare Turnstile's site key, where sign-in asks for a CAPTCHA (#182). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
