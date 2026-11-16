/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** The hosted bundle a release APK opens (RIVR_SHELL_URL), for the offline start page; empty elsewhere. */
  readonly VITE_SHELL_URL: string;
  /** The tablet app's Sentry address, where errors are reported (decision 0673); a build that does not name it sends nothing. */
  readonly VITE_SENTRY_DSN_TABLET?: string;
  /** Which deploy a report is from, `staging` or `production`. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The build's version, the commit or the release tag, sent with each error. */
  readonly VITE_APP_VERSION?: string;
}
