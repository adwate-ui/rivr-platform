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

const IS_RUNNING = `venue_id = '${CLUB}' and status in ('scheduled', 'live', 'paused') and reward ->> 'kind' = 'high_hand'`;

/** Ends any high hand a cut-off run left running at the club: one runs in a venue, so the next could not start. */
export function endHighHands(): void {
  const ended = sql(`update public.promotion_version set status = 'ended' where ${IS_RUNNING} returning promotion_id`).split('\n').filter((id) => id.length === 36);
  for (const id of ended) sql(`select private.sync_promotion('${id}')`);
}

// A royal flush 25,000, a straight flush 10,000, four of a kind 5,000; both rules, four or more dealt in.
const REWARD = JSON.stringify({
  kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
  hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'four_of_a_kind', chips: 5_000 }],
});

/**
 * A high hand live at the club since yesterday, on the app and the TVs, with 2,00,000 a month, put straight into the
 * tables: for the flows that log and pay a hit, as the High hand promotion flow proves the builder and the approval.
 */
export function liveHighHand(name: string): void {
  endHighHands();
  const id = sql(`insert into public.promotion (venue_id, name) values ('${CLUB}', '${name}') returning id`).split('\n')[0] ?? '';
  sql(`insert into public.promotion_version (venue_id, promotion_id, version, status, name, detail, reward, eligibility, schedule, limits, channels)
       values ('${CLUB}', '${id}', 1, 'live', '${name}', 'Up to 25,000 Bonus a hand', '${REWARD}', '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
               jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'timezone', 'Asia/Kolkata',
                                  'startsOn', (private.club_day_of(now()) - 1)::text),
               '{"perMember": "none", "budgetChips": 200000, "budgetPeriod": "month"}', '{"playerApp": true, "tv": true, "website": false, "whatsapp": false}')`);
  sql(`select private.sync_promotion('${id}')`);
}

/** A member's seat ended, if a cut-off run left them seated: the hits logged against it stay. */
export function endSeatOf(memberId: string): void {
  sql(`update public.seat_session set ended_at = now(), end_reason = 'cash_out' where member_id = '${memberId}' and ended_at is null`);
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
