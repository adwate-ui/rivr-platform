/** Set by astro.config.mjs from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  /** The player app's address, where the website hands visitors on. */
  readonly PUBLIC_PLAYER_URL: string;
  /** The website's Sentry address, where errors in its pages are reported (decision 0673); a build that does not name it sends nothing. */
  readonly PUBLIC_SENTRY_DSN_WEB?: string;
  /** Which deploy a report is from, `staging` or `production`. */
  readonly PUBLIC_SENTRY_ENVIRONMENT?: string;
  /** The build's version, the commit or the release tag, sent with each error. */
  readonly PUBLIC_APP_VERSION?: string;
}
