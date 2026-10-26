/**
 * Tournament registration and the floor (#118, #120; decisions 0202 to 0204). Ira Menon, this flow's own
 * floor manager, makes a RIVR Sunday and starts its clock. Neha Bhalla, this flow's own member with the
 * seed's ₹1,00,000, registers from Home: the app asks before it pays ₹10,000 from her balance, then shows
 * her seat. Ira records her bust-out; Home offers Neha a re-entry, which seats her again. The console's
 * field counts two entries, one a re-entry. The tournament is taken off the calendar at the end, so no
 * later flow's Home finds it running. Cash at the cage, alternates, refunds and balancing are proved in
 * supabase/tests/105.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Today in IST, as a date field takes it. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** The floor makes a RIVR Sunday shown to members and starts its clock. */
async function makeAndStart(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  await floor.getByRole('group', { name: 'Template' }).getByRole('button', { name: 'RIVR Sunday', exact: true }).click();
  await floor.getByRole('textbox', { name: 'Name' }).fill(name);
  await floor.getByLabel('Day', { exact: true }).fill(today());
  await floor.getByRole('textbox', { name: 'Start time' }).fill('16:00');
  await floor.getByRole('button', { name: 'Make tournament' }).click();
  await expect(floor.getByText(`${name} is on the list.`)).toBeVisible();
  await floor.getByRole('button', { name: 'Start the clock' }).click();
  await expect(floor.getByRole('button', { name: 'Pause' })).toBeVisible();
}

/** Neha buys from Home: the app asks with the amount, then pays and shows her seat. */
async function buyFromHome(member: Page, offer: 'Register' | 'Re-enter') {
  await member.reload();
  await member.getByRole('button', { name: offer, exact: true }).click({ timeout: 15_000 });
  await expect(member.getByText('Pay ₹10,000 from your balance?')).toBeVisible();
  await member.getByRole('button', { name: 'Yes, pay' }).click({ timeout: 15_000 });
  await expect(member.getByText(/^You are at table \d+, seat \d+\.$/)).toBeVisible({ timeout: 10_000 });
}

/** Takes the flow's tournament off the calendar and the app: entries keep it, so it is not removed. */
async function takeOffCalendar(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  const open = floor.getByRole('button', { name: `Open ${name}` });
  if (await open.isEnabled()) await open.click();
  // The tournament's own switch comes first; the new-tournament form has one too.
  const shown = floor.getByRole('switch', { name: 'Shown to members' }).first();
  await shown.click();
  await expect(shown).not.toBeChecked();
}

test.describe('Tournament registration', () => {
  test('Tournament registration: a member registers from the app, busts, and re-enters', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'pays from a wallet and runs a tournament, so the local stack only');
    test.setTimeout(180_000);
    const name = `Flow entries ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000753');
    await makeAndStart(floor, name);
    try {
      const member = await browser.newPage();
      await signInToPlayer(member, '9000000752');
      await expect(member.getByText(`${name} · Level 1`)).toBeVisible({ timeout: 10_000 });
      await buyFromHome(member, 'Register');

      await floor.reload();
      await floor.getByRole('button', { name: 'Record Neha Bhalla’s bust-out' }).click({ timeout: 15_000 });
    await floor.getByRole('button', { name: 'Confirm bust' }).click({ timeout: 15_000 });
      await expect(floor.getByText('Out in 1')).toBeVisible();

      await buyFromHome(member, 'Re-enter');
      await floor.reload();
      const field = floor.getByRole('region', { name: `${name} · level 1` });
      await expect(field.getByRole('definition').nth(0)).toHaveText('2');
      await expect(field.getByRole('definition').nth(1)).toHaveText('1');
    } finally {
      await takeOffCalendar(floor, name);
    }
  });
});
