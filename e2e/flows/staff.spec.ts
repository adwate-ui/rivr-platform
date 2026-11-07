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
import { openConsole } from '../support/console.ts';

const REFUSED = 'Not in your role. Ask an admin.';

test.describe('Staff', () => {
  test('Staff: an admin adds a host with a job title apart from the role, changes it, turns them off; a cashier is kept out of admin screens', async ({ browser }) => {
    test.setTimeout(120_000);
    const run = String(Date.now() % 100_000).padStart(5, '0');
    const name = `Test Host ${run}`;
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000150');
    await openConsole(admin, '/staff');
    await expect(admin.getByRole('heading', { name: 'Staff', level: 1 })).toBeVisible();
    // The staff are a table (C-03): a name opens the person beside it, and their changes open in place on Change (A-17).
    await admin.getByRole('button', { name: 'Ayesha Thomas · You', exact: true }).click();
    await admin.getByRole('button', { name: 'Change Ayesha Thomas' }).click();
    await expect(admin.getByRole('switch', { name: 'Active: Ayesha Thomas' })).toBeDisabled();
    // Her own role is a super admin's to give (B3), so it shows no choices; her job title stays hers to change.
    await expect(admin.getByRole('radiogroup', { name: 'Role for Ayesha Thomas' })).toHaveCount(0);
    await expect(admin.getByRole('textbox', { name: 'Job title for Ayesha Thomas' })).toBeEnabled();

    await admin.getByRole('button', { name: 'Add staff', exact: true }).click();
    await admin.getByRole('textbox', { name: 'Full name' }).fill(name);
    await admin.getByRole('textbox', { name: 'Job title', exact: true }).fill('Floor supervisor');
    await admin.getByRole('radiogroup', { name: 'Role', exact: true }).getByRole('radio', { name: 'Host' }).click();
    // An admin can't give the cage's role: it isn't offered.
    await expect(admin.getByRole('radiogroup', { name: 'Role', exact: true }).getByRole('radio', { name: 'Cashier' })).toHaveCount(0);
    // Every run adds a new number: a number is on the list once.
    await admin.getByRole('textbox', { name: 'Mobile number' }).fill(`98765${run}`);
    await admin.getByRole('button', { name: 'Add staff member' }).click();
    await expect(admin.getByText(`${name} is added.`)).toBeVisible();
    await admin.getByRole('searchbox', { name: 'Find staff' }).fill(run);
    await admin.getByRole('button', { name, exact: true }).click();
    await admin.getByRole('button', { name: `Change ${name}` }).click();
    const title = admin.getByRole('textbox', { name: `Job title for ${name}` });
    await expect(title).toHaveValue('Floor supervisor');
    await title.fill('Host');
    await admin.getByRole('button', { name: `Save job title for ${name}` }).click();
    await expect(admin.getByText('Job title saved.')).toBeVisible();
    const active = admin.getByRole('switch', { name: `Active: ${name}` });
    await expect(active).toHaveAttribute('aria-checked', 'true');
    await active.click();
    await expect(active).toHaveAttribute('aria-checked', 'false');
    // Asked before it is saved (F1-09).
    await admin.getByRole('button', { name: 'Yes, turn it off' }).click();
    await expect(admin.getByText(`Turn off ${name}'s login?`)).toHaveCount(0);
    await admin.reload();
    // A reload closes the row. Turned off, they are under Removed (owner, 8 Nov); found again, the name, then Change,
    // open it on what was saved.
    await admin.getByRole('link', { name: 'Removed staff' }).click();
    await admin.getByRole('searchbox', { name: 'Find staff' }).fill(run);
    await admin.getByRole('button', { name, exact: true }).click();
    await admin.getByRole('button', { name: `Change ${name}` }).click();
    await expect(admin.getByRole('textbox', { name: `Job title for ${name}` })).toHaveValue('Host');
    await expect(admin.getByRole('switch', { name: `Active: ${name}` })).toHaveAttribute('aria-checked', 'false');

    const cashier = await browser.newPage();
    await signInToConsole(cashier, '9000000151');
    await expect(cashier.getByRole('link', { name: 'Live floor', exact: true })).toBeVisible();
    await expect(cashier.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
    // Old addresses lead to their merged screen (#606), which refuses a cashier just the same; so does Tables setup (#644).
    for (const screen of ['/staff', '/kill-switch', '/rake', '/dealer-pins', '/tables']) {
      await cashier.goto(`${appUrl('console')}${screen}`);
      await expect(cashier.getByText(REFUSED)).toBeVisible();
    }
    await expect(cashier.getByRole('button', { name: /Engage/ })).toHaveCount(0);

  });
});
