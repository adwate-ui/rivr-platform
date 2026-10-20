/**
 * Tiers (#32; additions "Tier-gated features", flow 21). Rohini Das, this flow's own super admin, opens
 * Players → Tiers and takes Learn from the Member tier, locked, from now. Aarav Joshi, a Member, sees his
 * Learn tab lock within seconds, without a reload, and the lock names the tiers that have it; Kiara Shah,
 * a black card, keeps Learn. The preview shows Learn locked for Member. Rohini gives Learn back to Aarav
 * alone by override, and it opens for him. Before and after (even after a failure), the flow puts back
 * the seed's state: no override for Aarav, and Learn on for Member.
 * That the calls behind Learn are refused is proved in supabase/tests/078_tier_matrix.test.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Sets Learn library for the Member tier on the Tiers screen, and saves it from now. */
async function setMemberLearn(admin: Page, choice: 'On' | 'Locked') {
  await admin.getByRole('link', { name: 'Tiers', exact: true }).click();
  const cell = admin.getByRole('group', { name: 'Learn library for Member' });
  if ((await cell.getByRole('button', { name: choice }).getAttribute('aria-pressed')) === 'true') return;
  await cell.getByRole('button', { name: choice }).click();
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await expect(admin.getByText('Saved. Members\' apps change within seconds.')).toBeVisible();
}

/** Opens a member's record. */
async function openRecord(admin: Page, name: string) {
  await admin.getByRole('link', { name: 'Members' }).click();
  await admin.getByRole('searchbox', { name: 'Find a member' }).fill(name.split(' ')[0] ?? name);
  await admin.getByRole('button', { name: `Open ${name}` }).click();
  await expect(admin.getByRole('heading', { name: 'Feature overrides' })).toBeVisible();
}

/** Lifts Aarav's override of Learn library, if he has one: a run stopped part-way may have left it. */
async function liftOverride(admin: Page) {
  await openRecord(admin, 'Aarav Joshi');
  const lift = admin.getByRole('button', { name: 'Lift the override of Learn library' });
  if (await lift.count() === 0) return;
  await lift.click();
  await admin.getByRole('textbox', { name: 'Why it is lifted' }).fill('End of the test run');
  await admin.getByRole('button', { name: 'Lift', exact: true }).click();
  await expect(admin.getByText('Override lifted.')).toBeVisible();
}

/** The seed's state, whatever an earlier run stopped part-way left: Member has Learn, Aarav no override. */
async function baseline(admin: Page) {
  await liftOverride(admin);
  await setMemberLearn(admin, 'On');
}

test.describe('Tiers', () => {
  test('Tiers: Learn taken from Member locks a Member\'s tab within seconds, a black card keeps it, and an override gives it back to one member', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'changes the tier matrix, so the local stack only');
    test.setTimeout(150_000);
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000152');
    await baseline(admin);
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000250');
    const black = await browser.newPage();
    await signInToPlayer(black, '9000000251');
    const learn = (page: Page) => page.getByRole('link', { name: 'Learn' });
    await expect(learn(member)).not.toHaveAttribute('aria-describedby');

    try {
      await setMemberLearn(admin, 'Locked');
      // Within seconds and without a reload: the change reaches his app through Realtime.
      await expect(learn(member)).toHaveAccessibleDescription(/Black card/, { timeout: 10_000 });
      await expect(learn(black)).not.toHaveAttribute('aria-describedby');
      await admin.getByRole('group', { name: 'Tier to preview' }).getByRole('button', { name: 'Member', exact: true }).click();
      await expect(admin.getByText(/^Locked: .*Learn library/)).toBeVisible();

      await openRecord(admin, 'Aarav Joshi');
      await admin.getByRole('group', { name: 'Feature' }).getByRole('button', { name: 'Learn library' }).click();
      await admin.getByRole('group', { name: 'Override' }).getByRole('button', { name: 'Grant' }).click();
      await admin.getByRole('textbox', { name: 'Why the override' }).fill('Coaching for the league');
      await admin.getByRole('button', { name: 'Save override' }).click();
      await expect(admin.getByText('Override saved.')).toBeVisible();
      await expect(learn(member)).not.toHaveAttribute('aria-describedby', { timeout: 10_000 });
    } finally {
      // The seed's state again whatever happened above, so later flows and runs find it.
      await baseline(admin);
    }
    await expect(learn(member)).not.toHaveAttribute('aria-describedby', { timeout: 10_000 });
  });
});
