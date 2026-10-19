/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Cloudflare Turnstile's site key, where sign-in asks for a CAPTCHA (#182). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}
