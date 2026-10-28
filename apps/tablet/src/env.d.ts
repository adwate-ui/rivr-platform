/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** The hosted bundle a release APK opens (RIVR_SHELL_URL), for the offline start page; empty elsewhere. */
  readonly VITE_SHELL_URL: string;
}
