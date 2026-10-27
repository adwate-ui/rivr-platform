/**
 * CCTV references (#122; tech plan item 17; decision 0238). Tanvi Bhatt, an admin and this flow's own camera keeper,
 * puts a camera over Table 1 and one on the cage, logs an incident the Table 1 camera saw, and plays it back: the
 * link opens the recorder at the second the incident happened. Locally the venue has no recorder address, so the
 * link is the fake recorder's, which never resolves. Hands and cage transactions carrying their cameras are proved in
 * supabase/tests/141_cctv.test.sql, and the link's forms in packages/adapters. Local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

const CLUB = '00000000-0000-4000-8000-000000000001';

test.describe('CCTV', () => {
  test('CCTV: an admin adds cameras, logs an incident one saw, and plays it back at that second', async ({ page }) => {
    test.skip(isRemoteTarget(), 'retires its own cameras in the local database, so the local stack only');
    // An earlier run's cameras, so this run can put new ones over Table 1 and on the cage.
    sql(`update public.camera set is_active = false where venue_id = '${CLUB}' and name like 'E2E %'`);
    const summary = `E2E chips knocked over at Table 1, ${Date.now()}`;

    await signInToConsole(page, '9000000185');
    await page.getByRole('link', { name: 'Cameras', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Table 1');
    await page.getByRole('textbox', { name: 'Channel' }).fill('e2e:1');
    await page.getByRole('group', { name: 'Watches' }).getByRole('button', { name: 'Table 1', exact: true }).click();
    await page.getByRole('button', { name: 'Add the camera' }).click();
    await expect(page.getByText('E2E Table 1 added.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Cage');
    await page.getByRole('textbox', { name: 'Channel' }).fill('e2e:9');
    await page.getByRole('group', { name: 'Watches' }).getByRole('button', { name: 'The cage' }).click();
    await page.getByRole('button', { name: 'Add the camera' }).click();
    await expect(page.getByText('E2E Cage added.')).toBeVisible();
    const cameras = page.getByRole('table', { name: 'The venue\'s cameras' });
    // An earlier run's cameras stay, retired.
    await expect(cameras.getByRole('row', { name: /E2E Table 1.*In use/ })).toContainText('Table 1');
    await expect(cameras.getByRole('row', { name: /E2E Cage.*In use/ })).toContainText('The cage');

    await page.getByRole('link', { name: 'Incidents', exact: true }).click();
    await page.getByRole('textbox', { name: 'What happened' }).fill(summary);
    await page.getByRole('group', { name: 'Camera that saw it' }).getByRole('button', { name: 'E2E Table 1' }).click();
    await page.getByRole('button', { name: 'Log the incident' }).click();
    await expect(page.getByText('Incident logged.')).toBeVisible();

    const incident = page.getByText(summary).locator('..');
    await incident.getByRole('button', { name: 'Playback' }).click();
    const link = incident.getByRole('link', { name: 'Open E2E Table 1 at this moment' });
    await expect(link).toHaveAttribute('target', '_blank');
    // The second it happened, as the database keeps it.
    const at = sql(`select to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.incident where summary = '${summary}'`);
    await expect(link).toHaveAttribute('href', `https://cctv.invalid/playback?camera=e2e%3A1&at=${encodeURIComponent(at)}`);
  });
});
