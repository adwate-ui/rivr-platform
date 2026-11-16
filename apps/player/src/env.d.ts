/// <reference types="vite-plugin-pwa/client" />

/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  /** The hosted app the store app's offline page opens (vite.offline.config.ts). */
  readonly VITE_SHELL_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** The website's address, for the terms and privacy links on sign-in (#775); none in a build that does not name it. */
  readonly VITE_WEB_URL?: string;
  /** Cloudflare Turnstile's site key, where sign-in asks for a CAPTCHA (#182). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /**
   * The player's Sentry address, where errors are reported (#928, decisions 0604 and 0672); a build that does not name it
   * loads and sends nothing. Named for the app, as one build command builds every app with one set of variables.
   */
  readonly VITE_SENTRY_DSN_PLAYER?: string;
  /** Which deploy the report is from, `staging` or `production`; Sentry's default (`production`) when not named. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The build's version, such as the release tag, sent with each error; none in a build that does not name it. */
  readonly VITE_APP_VERSION?: string;
}
