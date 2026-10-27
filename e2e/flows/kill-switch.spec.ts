/**
 * Kill switch (#27; additions flow 15). Neha Kulkarni and Arvind Rao, this flow's own super admins
 * (Auth sends one code a minute to a number). Neha seats Kunal Mehra at Table 3 and pairs its tablet,
 * then freezes the venue with a reason, confirming it: the console, the tablet and Yash Gupta's app
 * (signed in for this flow alone) show the banner within seconds, the website's pages say the club is
 * paused (#278), and the tablet's buy-in for Kunal is refused. She asks to release it and cannot alone; Arvind releases it, and the banners go. Kunal leaves
 * and the tablet is revoked at the end; if the flow fails midway the freeze is still released, so later
 * flows find the club open. Every level and every alert are proved in supabase/tests/060_kill_switch.test.sql.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';
import { dealerSignsIn, revoke, tabletAtTable3 } from '../support/tablet.ts';

const MEMBER_BANNER = 'The club is paused. Staff will assist you.';
const STAFF_BANNER = 'Venue frozen. Money, seating and hand entries are refused until it is released.';
const VISITOR_BANNER = 'The club is paused just now. Please check back soon.';

/** Asks to release the freeze on one super admin's console, and releases it on the other's. */
async function release(first: Page, second: Page) {
  await first.getByRole('link', { name: 'Kill switch' }).click();
  await first.getByRole('button', { name: 'Release Venue freeze' }).click();
  await first.getByRole('textbox', { name: 'Why it is released' }).fill('Dispute settled');
  await first.getByRole('button', { name: 'Release', exact: true }).click();
  await expect(first.getByText('Asked. A second super admin releases the venue freeze.')).toBeVisible();
  await second.getByRole('link', { name: 'Kill switch' }).click();
  await expect(second.getByText('Neha Kulkarni asked to release it: Dispute settled. A second super admin releases it.')).toBeVisible();
  await second.getByRole('button', { name: 'Release Venue freeze' }).click();
  await second.getByRole('button', { name: 'Release', exact: true }).click();
  await expect(second.getByText('Released.')).toBeVisible();
}

/** After a failure: release the freeze if it is still engaged, so the flows after this one find the club open. */
async function releaseIfFrozen(browser: Browser, first: Page) {
  await first.getByRole('link', { name: 'Kill switch' }).click();
  if (await first.getByRole('button', { name: 'Release Venue freeze' }).count() === 0) return;
  const second = await browser.newPage();
  await signInToConsole(second, '9000000136');
  await release(first, second);
}

test.describe('Kill switch', () => {
  test('Kill switch: a super admin freezes the venue, every app shows the banner, and a second super admin releases it', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'freezes the venue, so the local stack only');
    test.setTimeout(120_000);
    const first = await browser.newPage();
    await signInToConsole(first, '9000000135');
    await first.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    await first.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '5', exact: true }).click();
    await first.getByRole('textbox', { name: 'Mobile number' }).fill('9000000216');
    await first.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(first.getByRole('button', { name: 'Move Kunal Mehra' })).toBeVisible();
    const { tablet, name } = await tabletAtTable3(browser, first);
    await dealerSignsIn(tablet);
    let frozen = false;
    try {
      await first.getByRole('link', { name: 'Kill switch' }).click();
      await expect(first.getByText('Nothing is engaged.')).toBeVisible();
      await first.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Venue freeze' }).click();
      await first.getByRole('textbox', { name: 'Why' }).fill('Dispute at Table 3');
      await first.getByRole('button', { name: 'Engage', exact: true }).click();
      await expect(first.getByText('Engage Venue freeze now?')).toBeVisible();
      await first.getByRole('button', { name: 'Engage Venue freeze' }).click();
      frozen = true;
      await expect(first.getByText('Engaged.')).toBeVisible();
      await expect(first.getByText(STAFF_BANNER)).toBeVisible({ timeout: 15_000 });

      await expect(tablet.getByText(STAFF_BANNER)).toBeVisible({ timeout: 15_000 });
      await tablet.getByRole('button', { name: 'Seat 5, Kunal Mehra' }).click();
      await tablet.getByRole('button', { name: 'Request buy-in' }).click();
      await expect(tablet.getByText(/^The venue is frozen\./)).toBeVisible();

      const member = await browser.newPage();
      await signInToPlayer(member, '9000000214');
      await expect(member.getByText(MEMBER_BANNER)).toBeVisible({ timeout: 15_000 });

      // The website (#278): the front page and link-in-bio say the club is paused, with no table running.
      const site = await browser.newPage();
      for (const path of ['', '/links']) {
        await site.goto(`${appUrl('web')}${path}`);
        await expect(site.getByText(VISITOR_BANNER)).toBeVisible();
        await expect(site.getByText(/^\d+ tables? running/)).toHaveCount(0);
      }

      const second = await browser.newPage();
      await signInToConsole(second, '9000000136');
      await release(first, second);
      frozen = false;
      await expect(second.getByText(STAFF_BANNER)).toHaveCount(0, { timeout: 15_000 });
      await expect(member.getByText(MEMBER_BANNER)).toHaveCount(0, { timeout: 15_000 });
      await expect(tablet.getByText(STAFF_BANNER)).toHaveCount(0, { timeout: 15_000 });
    } finally {
      if (frozen) await releaseIfFrozen(browser, first);
      await first.getByRole('link', { name: 'Live floor' }).click();
      await first.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
      await first.getByRole('button', { name: 'Kunal Mehra leaves' }).click();
      await revoke(first, name);
    }
  });
});
