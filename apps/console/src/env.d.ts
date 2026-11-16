/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** The website's address, for the website editor's preview (#129); none in a deploy that does not name it. */
  readonly VITE_WEB_URL?: string;
  /** Cloudflare Turnstile's site key, where sign-in asks for a CAPTCHA (#182). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** The console app's Sentry address, where errors are reported (decision 0673); a build that does not name it sends nothing. */
  readonly VITE_SENTRY_DSN_CONSOLE?: string;
  /** Which deploy a report is from, `staging` or `production`. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The build's version, the commit or the release tag, sent with each error. */
  readonly VITE_APP_VERSION?: string;
}
