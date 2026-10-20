/**
 * Paper fallback (#52; scope-v1 module 11, "Acceptance test"): the outage drill, short, in the practice
 * venue (docs/runbooks/paper-fallback.md). Gautam Sood, this flow's own duty manager, freezes the
 * practice venue, as an outage would stop it: seating is refused, so the room writes the floor sheet
 * and the cage paper log. Priya Nath, the second super admin, releases it. Then the paper goes back:
 * each player on the floor sheet is seated and each numbered slip entered at the cage, and the chips in
 * play rise by the log's total, so no buy-in is lost. Whatever happens, the freeze is released and the
 * players leave, so a run after this one finds the practice venue as it was. Each person is the flow's
 * own: Auth sends one code a minute to a number.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const STAFF_BANNER = 'Venue frozen. Money, seating and hand entries are refused until it is released.';

/** The paper written while the venue was frozen: the floor sheet and the cage paper log, one numbered slip a buy-in. */
const SLIPS = [
  { slip: 1, name: 'Kabir Sethi', mobile: '9000000270', seat: '2', rupees: 5000 },
  { slip: 2, name: 'Naina Kapoor', mobile: '9000000271', seat: '4', rupees: 5000 },
] as const;

/** Signs a duty manager in and turns the console to the practice venue. */
async function inPractice(page: Page, number: string) {
  await signInToConsole(page, number);
  await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();
  const rail = page.getByRole('complementary');
  await rail.getByRole('switch', { name: 'Practice venue' }).click();
  await expect(rail.getByText('RIVR Practice')).toBeVisible();
}

/** Opens Table 1 on the live floor. */
async function table1(page: Page) {
  await page.getByRole('link', { name: 'Live floor' }).click();
  await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 1', exact: true }).click();
}

/** At Table 1, picks a seat and asks to seat the member with this mobile number. */
async function seat(page: Page, mobile: string, seatNumber: string) {
  await table1(page);
  await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: seatNumber, exact: true }).click();
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(mobile);
  await page.getByRole('button', { name: 'Seat', exact: true }).click();
}

/** The practice venue's chips in play on Treasury, in rupees. */
async function chipsInPlay(page: Page): Promise<number> {
  await page.getByRole('link', { name: 'Treasury' }).click();
  const label = page.getByText('Chips in play', { exact: true });
  await expect(label).toBeVisible();
  const figure = (await label.locator('xpath=..').innerText()).replace('Chips in play', '');
  return (/[−-]/.test(figure) ? -1 : 1) * Number(figure.replace(/[^\d]/g, ''));
}

const ASKED = /^Gautam Sood asked to release it: Drill over: back on the system\./;

/** The lead asks to release the freeze. */
async function askToRelease(lead: Page) {
  await lead.getByRole('link', { name: 'Kill switch' }).click();
  await lead.getByRole('button', { name: 'Release Venue freeze' }).click();
  await lead.getByRole('textbox', { name: 'Why it is released' }).fill('Drill over: back on the system');
  await lead.getByRole('button', { name: 'Release', exact: true }).click();
  await expect(lead.getByText('Asked. A second super admin releases the venue freeze.')).toBeVisible();
}

/** The second super admin releases the freeze the lead asked to release. */
async function secondReleases(second: Page) {
  await second.getByRole('link', { name: 'Kill switch' }).click();
  await expect(second.getByText(ASKED)).toBeVisible();
  await second.getByRole('button', { name: 'Release Venue freeze' }).click();
  await second.getByRole('button', { name: 'Release', exact: true }).click();
  await expect(second.getByText('Released.')).toBeVisible();
}

/** Whatever happened: the freeze released if the screen shows it still on, and the drill's players gone from Table 1. */
async function tidyUp(lead: Page, second: Page) {
  await second.getByRole('link', { name: 'Kill switch' }).click();
  const stillFrozen = second.getByRole('button', { name: 'Release Venue freeze' });
  await expect(stillFrozen.or(second.getByText('Nothing is engaged.'))).toBeVisible();
  if (await stillFrozen.count() > 0) {
    if (await second.getByText(ASKED).count() === 0) await askToRelease(lead);
    await secondReleases(second);
  }
  await table1(lead);
  await expect(lead.getByRole('heading', { name: 'Table 1', level: 2 })).toBeVisible();
  for (const { name } of SLIPS) {
    const leaves = lead.getByRole('button', { name: `${name} leaves` });
    if (await leaves.count() > 0) await leaves.click();
    await expect(lead.getByRole('button', { name: `Move ${name}` })).toHaveCount(0);
  }
}

test.describe('Paper fallback', () => {
  test('Paper fallback: the practice venue runs on paper while frozen, and every buy-in on paper goes back into the system', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'freezes the practice venue and seats players, so the local stack only');
    test.setTimeout(150_000);
    const lead = await browser.newPage();
    await inPractice(lead, '9000000175');
    const second = await browser.newPage();
    await inPractice(second, '9000000176');
    try {
      const before = await chipsInPlay(lead);
      await lead.getByRole('link', { name: 'Kill switch' }).click();
      await lead.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Venue freeze' }).click();
      await lead.getByRole('textbox', { name: 'Why' }).fill('Paper fallback drill: app down');
      await lead.getByRole('button', { name: 'Engage', exact: true }).click();
      await lead.getByRole('button', { name: 'Engage Venue freeze' }).click();
      await expect(lead.getByText('Engaged.')).toBeVisible();
      await expect(lead.getByText(STAFF_BANNER)).toBeVisible({ timeout: 15_000 });

      // The outage: the system refuses the seat, so the floor sheet and the cage paper log take it (SLIPS).
      await seat(lead, SLIPS[0].mobile, SLIPS[0].seat);
      await expect(lead.getByText('The venue is frozen. Seating changes again once it is released.')).toBeVisible();

      await askToRelease(lead);
      await secondReleases(second);
      await expect(second.getByText(STAFF_BANNER)).toHaveCount(0, { timeout: 15_000 });

      // Back in the system: the floor sheet first, then every slip in number order, each confirmed.
      for (const slip of SLIPS) {
        await seat(lead, slip.mobile, slip.seat);
        await expect(lead.getByRole('button', { name: `Move ${slip.name}` })).toBeVisible();
      }
      for (const slip of SLIPS) {
        await lead.getByRole('link', { name: 'Cage' }).click();
        await lead.getByRole('textbox', { name: 'Search members' }).fill(slip.name);
        await lead.getByRole('button', { name: slip.name }).click();
        await expect(lead.getByText(new RegExp(`KYC verified · Table 1, seat ${slip.seat}$`))).toBeVisible();
        await lead.getByRole('textbox', { name: 'Amount', exact: true }).fill(String(slip.rupees));
        await lead.getByRole('button', { name: 'Issue chips' }).click();
        await expect(lead.getByText(`₹${slip.rupees.toLocaleString('en-IN')} of chips issued.`)).toBeVisible();
      }
      // The check: no hand is logged here, so the chips in play rose by exactly the paper log's total.
      expect(await chipsInPlay(lead) - before).toBe(SLIPS.reduce((total, slip) => total + slip.rupees, 0));
    } finally {
      await tidyUp(lead, second);
    }
  });
});
