/**
 * Staff (#28; scope-v1 module 10: "a cashier cannot open admin screens"). This flow has its own floor manager,
 * Ayesha Thomas (an admin), and its own cashier, Manoj Pillai: Auth sends one code a minute to a number.
 * - Ayesha opens Staff, adds a host whose job title is Floor supervisor (the title is apart from the role),
 *   changes the title, and turns them off. She can't change her own role.
 * - Manoj has no Staff screen in his rail, and typing an admin screen's address shows a refusal, not the screen.
 * SOPs and their onboarding checklists are hidden with the rest of Team (#626).
 */
import { expect, test } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const REFUSED = 'Your role does not include this screen. Ask an admin if you need it.';

test.describe('Staff', () => {
  test('Staff: an admin adds a host with a job title apart from the role, changes it, turns them off; a cashier is kept out of admin screens', async ({ browser }) => {
    test.setTimeout(120_000);
    const run = String(Date.now() % 100_000).padStart(5, '0');
    const name = `Test Host ${run}`;
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000150');
    await admin.getByRole('link', { name: 'Staff', exact: true }).click();
    await expect(admin.getByRole('heading', { name: 'Staff', level: 1 })).toBeVisible();
    await expect(admin.getByText('Ayesha Thomas · You', { exact: true })).toBeVisible();
    await expect(admin.getByRole('switch', { name: 'Active: Ayesha Thomas' })).toBeDisabled();
    await expect(admin.getByRole('group', { name: 'Role for Ayesha Thomas' }).getByRole('button', { name: 'Host' })).toBeDisabled();

    await admin.getByRole('textbox', { name: 'Full name' }).fill(name);
    await admin.getByRole('textbox', { name: 'Job title', exact: true }).fill('Floor supervisor');
    await admin.getByRole('group', { name: 'Role', exact: true }).getByRole('button', { name: 'Host' }).click();
    // An admin can't give the cage's role: it isn't offered.
    await expect(admin.getByRole('group', { name: 'Role', exact: true }).getByRole('button', { name: 'Cashier' })).toHaveCount(0);
    // Every run adds a new number: a number is on the list once.
    await admin.getByRole('textbox', { name: 'Mobile number' }).fill(`98765${run}`);
    await admin.getByRole('button', { name: 'Add staff member' }).click();
    await expect(admin.getByText(`${name} is added.`)).toBeVisible();
    await expect(admin.getByText(name, { exact: true })).toBeVisible();


    const title = admin.getByRole('textbox', { name: `Job title for ${name}` });
    await expect(title).toHaveValue('Floor supervisor');
    await title.fill('Host');
    await admin.getByRole('button', { name: `Save job title for ${name}` }).click();
    await expect(admin.getByText('Job title saved.')).toBeVisible();
    const active = admin.getByRole('switch', { name: `Active: ${name}` });
    await expect(active).toHaveAttribute('aria-checked', 'true');
    await active.click();
    await expect(active).toHaveAttribute('aria-checked', 'false');
    await admin.reload();
    await expect(admin.getByRole('textbox', { name: `Job title for ${name}` })).toHaveValue('Host');
    await expect(admin.getByRole('switch', { name: `Active: ${name}` })).toHaveAttribute('aria-checked', 'false');

    const cashier = await browser.newPage();
    await signInToConsole(cashier, '9000000151');
    await expect(cashier.getByRole('link', { name: 'Live floor', exact: true })).toBeVisible();
    await expect(cashier.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
    // Old addresses lead to their merged screen (#606), which refuses a cashier just the same.
    for (const screen of ['/staff', '/kill-switch', '/rake', '/dealer-pins', '/tablets']) {
      await cashier.goto(`${appUrl('console')}${screen}`);
      await expect(cashier.getByText(REFUSED)).toBeVisible();
    }
    await expect(cashier.getByRole('button', { name: /Engage/ })).toHaveCount(0);

  });
});
