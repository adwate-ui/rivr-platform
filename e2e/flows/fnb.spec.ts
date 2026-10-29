/**
 * Food and drink (#123; decision 0261). Meera Iyer, this flow's own general manager (a super admin, who runs F&B and
 * sets Pema's PIN for the flow's tablet), seats Ishan Mehta, 30 by his KYC, at Table 3, seat 1. From his seat he
 * orders a masala chai and a beer in the player app, and Pema, dealing Table 3, orders him a lime soda on the tablet:
 * both paid to Glaza. With no cage agent running,
 * their KOTs wait at the console under KOTs to print until Meera hands them to the bar and marks them sent. She orders
 * a club sandwich for his seat as a comp, the tablet is revoked and he leaves early, so Table 3 is as it was. The agent
 * printing KOTs, alcohol at 21 or over and one order a minute are proved in supabase/tests/171_fnb_orders.test.sql and
 * apps/cage-agent's tests.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';
import { dealerSignsIn, revoke, tabletAtTable3 } from '../support/tablet.ts';

/** The number in `Sent to the bar: KOT 12…`. */
async function kotIn(page: Page, sent: RegExp) {
  const line = page.getByText(sent);
  await expect(line).toBeVisible();
  return /KOT (\d+)/.exec((await line.textContent()) ?? '')?.[1] ?? '';
}

test.describe('F&B', () => {
  test('a seated member and the dealer order to his seat; the floor marks the KOTs sent and orders a comp', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'seats a seeded member, pairs a tablet and places orders, so the local stack only');
    test.setTimeout(90_000);
    await signInToConsole(page, '9000000615');
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000288');
    await page.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Move Ishan Mehta' })).toBeVisible();

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000288');
    await member.getByRole('button', { name: 'Order food and drink' }).click();
    await member.getByRole('button', { name: 'One more Masala chai' }).click();
    await member.getByRole('button', { name: 'One more Beer' }).click();
    await member.getByRole('button', { name: 'Send to the bar' }).click();
    const fromApp = await kotIn(member, /^Sent to the bar: KOT \d+, to Table 3, seat 1\.$/);
    // The Menu tab (#635) follows it to the seat: placed, until the service staff take it (their screen is #640).
    await member.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Menu' }).click();
    await expect(member.getByRole('heading', { name: 'Your orders tonight' })).toBeVisible();
    const order = member.getByText(`KOT ${fromApp} · 1 × Masala chai, 1 × Beer`);
    await expect(order).toBeVisible();
    await expect(order.locator('xpath=..').getByText('Placed', { exact: true })).toBeVisible();

    const { tablet, name } = await tabletAtTable3(browser, page);
    await dealerSignsIn(tablet);
    await tablet.getByRole('button', { name: 'Seat 1, Ishan Mehta' }).click();
    await tablet.getByRole('button', { name: 'Food and drink' }).click();
    await expect(tablet.getByRole('heading', { name: 'Food and drink for seat 1' })).toBeVisible();
    await tablet.getByRole('button', { name: 'One more Fresh lime soda' }).click();
    await tablet.getByRole('button', { name: 'Send to the bar' }).click();
    const fromTablet = await kotIn(tablet, /^Sent to the bar: KOT \d+\.$/);

    await page.getByRole('link', { name: 'Food and drink' }).click();
    await expect(page.getByRole('heading', { name: 'KOTs to print' })).toBeVisible();
    for (const kot of [fromApp, fromTablet]) {
      await expect(page.getByText(new RegExp(`^KOT ${kot} · Table 3, seat 1 · Ishan Mehta \\(\\d+\\)$`)).first()).toBeVisible();
      await page.getByRole('button', { name: `Mark KOT ${kot} sent` }).click();
    }
    await expect(page.getByText('Every KOT is at the bar.')).toBeVisible();
    await expect(page.getByText('1 × Masala chai, 1 × Beer')).toBeVisible();
    await expect(page.getByText('1 × Fresh lime soda')).toBeVisible();
    await expect(page.getByText('Paid · Given to the bar by hand')).toHaveCount(2);

    await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: 'Table 3, seat 1 · Ishan Mehta' }).click();
    await page.getByRole('button', { name: 'One more Club sandwich' }).click();
    await page.getByRole('switch', { name: 'Comp it: RIVR pays Glaza' }).click();
    await page.getByRole('button', { name: 'Send to the bar' }).click();
    const comp = await kotIn(page, /^Sent to the bar: KOT \d+\.$/);
    await page.getByRole('button', { name: `Mark KOT ${comp} sent` }).click();
    await expect(page.getByText('Every KOT is at the bar.')).toBeVisible();
    await expect(page.getByText('Comp · Given to the bar by hand')).toBeVisible();

    await revoke(page, name);
    await page.getByRole('link', { name: 'Live floor' }).click();
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    await page.getByRole('button', { name: 'Ishan Mehta leaves' }).click();
    await page.getByRole('button', { name: 'Let Ishan Mehta leave early' }).click();
    await page.getByRole('textbox', { name: 'Why they leave early' }).fill('End of the F&B flow');
    await page.getByRole('button', { name: 'Let leave early' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Move Ishan Mehta' })).toHaveCount(0);
  });
});
