import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** Cloudflare cache purge, so a published website edit is live within seconds. */
export interface CachePurgeAdapter {
  /** Purges these URLs from the edge cache. */
  purgeUrls(input: { readonly urls: readonly string[] }): Promise<Result<{ readonly purgeId: string }, AdapterFailure>>;
}
