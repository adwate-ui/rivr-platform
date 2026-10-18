export type RivrApp = 'player' | 'console' | 'tablet' | 'display' | 'driver' | 'web';

/** Absolute path of the current worktree's root. */
export function worktreeRoot(): string;
/** Path of a dev-dependency CLI installed in this worktree. */
export function localBinary(name: string, root?: string): string;
/** The worktree folder name, used as the Supabase project_id. */
export function worktreeName(root?: string): string;
/** The first three digits of every local port in this worktree. */
export function portBlock(root?: string): number;
/** The port an app serves on in this worktree. */
export function appPort(app: RivrApp, root?: string): number;
/** Points an app at the local stack unless `<prefix>SUPABASE_URL` is already set. */
export function defaultToLocalSupabase(prefix: 'VITE_' | 'PUBLIC_', root?: string): void;
/** The local Supabase stack's API URL and publishable key; never the service-role key. */
export function localSupabaseEnv(root?: string): { url: string; publishableKey: string };
