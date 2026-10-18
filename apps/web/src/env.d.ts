/** Set by astro.config.mjs from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  /** The player app's address, where the website hands visitors on. */
  readonly PUBLIC_PLAYER_URL: string;
}
