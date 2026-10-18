/// <reference types="vite-plugin-pwa/client" />

/** Set by vite.config.ts from the local stack, or by CI and deploys. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}
