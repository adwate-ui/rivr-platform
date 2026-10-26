/**
 * Design flow 18 (#149; decisions 0205, 0206): a tournament with re-entry and bounty. Rhea Kapoor, this
 * flow's own floor manager, makes a Bounty Thursday (₹5,000 with a ₹500 fee and ₹1,000 on each head) in a
 * room of one table, starts its clock and sets the payouts at 50, 30 and 20%. Tara Malhotra and Dev Khanna,
 * this flow's own members with the seed's ₹1,00,000 each, register from Home. Dev knocks Tara out and is
 * paid her bounty; Tara re-enters from Home and Dev knocks her out again. Rhea finishes: the
 * ₹10,500 prize pool pays Dev first with his own bounty, and Tara's two runs second and third. Overlay,
 * deals, TDS withheld and League points are proved in supabase/tests/126.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Today in IST, as a date field takes it. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** The floor makes a Bounty Thursday shown to members, in a room of one table, and starts its clock. */
async function makeAndStart(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  await floor.getByRole('group', { name: 'Template' }).getByRole('button', { name: 'Bounty Thursday', exact: true }).click();
  await floor.getByRole('textbox', { name: 'Name' }).fill(name);
  await floor.getByLabel('Day', { exact: true }).fill(today());
  await floor.getByRole('textbox', { name: 'Start time' }).fill('20:00');
  await floor.getByRole('button', { name: 'Make tournament' }).click();
  await expect(floor.getByText(`${name} is on the list.`)).toBeVisible();
  await floor.getByRole('textbox', { name: 'Tables' }).fill('1');
  await floor.getByRole('button', { name: 'Save room' }).click();
  await floor.getByRole('button', { name: 'Start the clock' }).click();
  await expect(floor.getByRole('button', { name: 'Pause' })).toBeVisible();
}

/** A member buys from Home: the app asks with the amount, then pays and shows their seat. */
async function buyFromHome(member: Page, offer: 'Register' | 'Re-enter') {
  await member.reload();
  await member.getByRole('button', { name: offer, exact: true }).click({ timeout: 15_000 });
  await expect(member.getByText('Pay ₹5,000 from your balance?')).toBeVisible();
  await member.getByRole('button', { name: 'Yes, pay' }).click({ timeout: 15_000 });
  await expect(member.getByText(/^You are at table 1, seat \d+\.$/)).toBeVisible({ timeout: 10_000 });
}

/** Dev knocks Tara out: the floor names him, and he is paid her bounty. */
async function devKnocksOutTara(floor: Page, place: string) {
  await floor.reload();
  await floor.getByRole('button', { name: 'Record Tara Malhotra’s bust-out' }).click({ timeout: 15_000 });
  await floor.getByRole('group', { name: 'Knocked out by' }).getByRole('button', { name: 'Dev Khanna' }).click();
  await floor.getByRole('button', { name: 'Confirm bust' }).click();
  await expect(floor.getByText(`Out in ${place}`)).toBeVisible();
}

/** Takes the flow's tournament off the calendar and the app, even after a failure: entries keep it, so it is not removed. */
async function takeOffCalendar(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  const open = floor.getByRole('button', { name: `Open ${name}` });
  if (await open.isEnabled()) await open.click();
  const shown = floor.getByRole('switch', { name: 'Shown to members' }).first();
  await shown.click();
  await expect(shown).not.toBeChecked();
}

test.describe('Tournament with re-entry and bounty', () => {
  test('Tournament with re-entry and bounty: register two, bust one, re-enter, pay a bounty, finish, pay out', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'pays from wallets and runs a tournament, so the local stack only');
    test.setTimeout(240_000);
    const name = `Flow bounty ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000754');
    await makeAndStart(floor, name);
    try {
      // The payouts are set before anyone is out in the money; after that they stay as they are.
      for (const { place, share } of [{ place: 1, share: '50' }, { place: 2, share: '30' }, { place: 3, share: '20' }]) {
        await floor.getByRole('textbox', { name: `Place ${String(place)} (%)` }).fill(share);
      }
      await floor.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(floor.getByText('Payouts saved.')).toBeVisible();
      const tara = await browser.newPage();
      await signInToPlayer(tara, '9000000755');
      await buyFromHome(tara, 'Register');
      const dev = await browser.newPage();
      await signInToPlayer(dev, '9000000756');
      await buyFromHome(dev, 'Register');

      await devKnocksOutTara(floor, '2');
      const paid = floor.getByRole('table', { name: 'Paid' });
      await expect(paid.getByRole('row', { name: /^Bounty Dev Khanna ₹0 ₹1,000/ })).toBeVisible();
      await buyFromHome(tara, 'Re-enter');
      await devKnocksOutTara(floor, '2');

      await floor.getByRole('button', { name: 'Finish and pay out' }).click();
      await floor.getByRole('button', { name: 'Confirm: pay out now' }).click();
      await expect(floor.getByText('Finished and paid out.')).toBeVisible();
      await expect(paid.getByRole('row', { name: /^1 Dev Khanna ₹5,250 ₹1,000/ })).toBeVisible();
      await expect(paid.getByRole('row', { name: /^2 Tara Malhotra · entry 2 ₹3,150 ₹0/ })).toBeVisible();
      await expect(paid.getByRole('row', { name: /^3 Tara Malhotra ₹2,100 ₹0/ })).toBeVisible();
    } finally {
      await takeOffCalendar(floor, name);
    }
  });
});
