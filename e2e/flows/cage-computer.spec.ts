/**
 * Cage computer (#384; scope-v1 module 10; decision 0110). Leela Rao, this flow's own duty manager, adds
 * the office computer as an admin console and enrols it with its code, then adds the cage's computer as
 * the cage; on that computer Omar Siddiqui, its second, enrols it with its code. Leela gives the club its
 * cage and admin networks (the local stack's private ranges), and from then on both are enforced. At the
 * enrolled cage Omar seats Naveen Iyer and issues ₹5,000 of chips; the same session, its token taken
 * away, is refused: the cage says why and cannot find him. Leela clears the networks at the end, so the
 * flows after this one run unenforced. A refused buy-in, an address outside the networks, a revoked
 * computer, wrong codes, networks that would shut the console out and the practice venue are in
 * supabase/tests/085_cage_computers.test.sql; the idle lock in useIdleLock.test.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

// Wherever the local stack's gateway sees the browser from.
const NETWORKS = '127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16';

/** Adds a computer on Computers and gives back its six-digit code. */
async function addComputer(page: Page, name: string, as: 'Add as the cage' | 'Add as an admin console'): Promise<string> {
  await page.getByRole('textbox', { name: 'Computer name' }).fill(name);
  await page.getByRole('button', { name: as }).click();
  const shown = page.getByText(new RegExp(`^Code \\d{6} for ${name}, until`));
  await expect(shown).toBeVisible();
  return /Code (\d{6})/.exec((await shown.textContent()) ?? '')?.[1] ?? '';
}

async function enrol(page: Page, code: string, enrolledAs: string) {
  await page.getByRole('link', { name: 'Computers' }).click();
  await page.getByRole('textbox', { name: 'Enrolment code' }).fill(code);
  await page.getByRole('button', { name: 'Enrol this computer' }).click();
  await expect(page.getByText(enrolledAs)).toBeVisible();
}

async function setNetworks(page: Page, networks: string) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Club details' }).click();
  await page.getByRole('textbox', { name: 'Cage and admin networks' }).fill(networks);
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('Configuration saved.')).toBeVisible();
}

test.describe('Cage computer', () => {
  test('Cage computer: an enrolled cage takes a buy-in, and the same session without its token is refused', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'enrols computers and sets the club\'s networks, so the local stack only');
    test.setTimeout(120_000);
    const office = await browser.newPage();
    const cage = await browser.newPage();
    await signInToConsole(office, '9000000159');
    await office.getByRole('link', { name: 'Computers' }).click();
    await expect(office.getByText(/^Not enforced yet/)).toBeVisible();
    await enrol(office, await addComputer(office, 'Office', 'Add as an admin console'), 'Enrolled as an admin console: Office.');
    const cageCode = await addComputer(office, 'Cage 1', 'Add as the cage');
    await signInToConsole(cage, '9000000160');
    await enrol(cage, cageCode, 'Enrolled as the cage: Cage 1.');
    try {
      await setNetworks(office, NETWORKS);

      await cage.getByRole('link', { name: 'Live floor' }).click();
      await cage.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 1', exact: true }).click();
      await cage.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '8', exact: true }).click();
      await cage.getByRole('textbox', { name: 'Mobile number' }).fill('9000000254');
      await cage.getByRole('button', { name: 'Seat', exact: true }).click();
      await expect(cage.getByRole('button', { name: 'Move Naveen Iyer' })).toBeVisible();
      await cage.getByRole('link', { name: 'Cage' }).click();
      await cage.getByRole('textbox', { name: 'Search members' }).fill('Naveen');
      await cage.getByRole('button', { name: 'Naveen Iyer' }).click();
      await cage.getByRole('textbox', { name: 'Amount', exact: true }).fill('5000');
      await cage.getByRole('button', { name: 'Issue chips' }).click();
      await expect(cage.getByText('₹5,000 of chips issued.')).toBeVisible();

      // The same session, the token gone: the cage says why, and is refused from its first call, so it
      // cannot even find him (a refused buy-in itself is in pgTAP 085).
      await cage.evaluate(() => globalThis.localStorage.removeItem('rivr-computer'));
      await cage.reload();
      await expect(cage.getByText(/^This computer is not enrolled as the cage/)).toBeVisible();
      await cage.getByRole('textbox', { name: 'Search members' }).fill('Naveen');
      await expect(cage.getByText('No member matches.')).toBeVisible();
    } finally {
      await setNetworks(office, '');
    }
  });
});
