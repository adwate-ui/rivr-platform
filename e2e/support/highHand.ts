/**
 * What the high hand flows share (redesign RD-23 to RD-25): this worktree's local database, the one high hand a venue
 * runs at a time, and the screenshots kept in the design folder.
 */
import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';

export const CLUB = '00000000-0000-4000-8000-000000000001';
const SHOTS = 'docs/design/redesign-2026-11-15/built/high-hand';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
export function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Ends any high hand a cut-off run left running at the club: one runs in a venue, so the next could not start. */
export function endHighHands(): void {
  sql(`with ended as (
         update public.promotion_version set status = 'ended'
         where venue_id = '${CLUB}' and status in ('scheduled', 'live', 'paused') and reward ->> 'kind' = 'high_hand'
         returning promotion_id)
       select private.sync_promotion(promotion_id) from ended`);
}

/**
 * Keeps a screenshot of a built screen in the design folder, to set beside the prototype's. Only when run by hand:
 *   HIGH_HAND_SHOTS=1 pnpm e2e --grep "High hand"
 */
export async function shoot(page: Page, name: string) {
  if (process.env.HIGH_HAND_SHOTS !== '1') return;
  // A panel or a toast is still sliding in.
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}
