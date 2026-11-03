/**
 * Food and drink (#123; decision 0261). Meera Iyer, this flow's own general manager (a super admin, who runs F&B and
 * sets Pema's PIN for the flow's tablet), seats Ishan Mehta, 30 by his KYC, at Table 3, seat 1. From his seat he
 * orders a masala chai and a beer in the player app, and Pema, dealing Table 3, orders him a lime soda on the tablet:
 * both paid to Glaza. With no cage agent running,
 * their KOTs wait at the console under KOTs to print until Meera hands them to the bar and marks them sent. She orders
 * a club sandwich for his seat as a comp, the tablet is revoked and he leaves early, so Table 3 is as it was. Sameer Rao, the
 * flow's steward in the Service role (#640), sees only food and drink: he accepts the app's order, sends it on its way and
 * delivers it, and the member follows it on Tonight's order tracker (decision 0320). On the menu, Meera sees each item
 * under its kind, and saves two from a CSV once it shows each line and the one it cannot read (decision 0440). The agent
 * printing KOTs, alcohol at 21 or over and one order a minute are proved in supabase/tests/171_fnb_orders.test.sql and
 * apps/cage-agent's tests.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';
import { dealerSignsIn, revoke, tabletAtTable3 } from '../support/tablet.ts';

/** The number in `Sent to the bar. Order 12.` or `Sent to the bar: KOT 12.` */
async function kotIn(page: Page, sent: RegExp) {
  const line = page.getByText(sent);
  await expect(line).toBeVisible();
  return /(?:KOT|Order) (\d+)/.exec((await line.textContent()) ?? '')?.[1] ?? '';
}

test.describe('F&B', () => {
  test('Tonight › Order, Order on its way, Order delivered: a seated member and the dealer order to his seat; the floor marks the KOTs sent, orders a comp and saves menu items from a CSV', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'seats a seeded member, pairs a tablet and places orders, so the local stack only');
    test.setTimeout(120_000);
    await signInToConsole(page, '9000000615');
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    await page.getByRole('radiogroup', { name: 'Seat', exact: true }).getByRole('radio', { name: '1', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mobile or member number' }).fill('9000000288');
    await page.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ishan Mehta leaves' })).toBeVisible();

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000288');
    // Order (brief 3.5): from the seat, the menu by category, Add turning into a count, then the send bar.
    await member.getByRole('button', { name: 'Order to my seat' }).click();
    await expect(member.getByRole('heading', { name: 'Order', level: 1, exact: true })).toBeVisible();
    await expect(member.getByText('Table 3, seat 1 · Pay on delivery')).toBeVisible();
    await member.getByRole('button', { name: 'Soft drinks', exact: true }).click();
    await member.getByRole('button', { name: 'Add Masala chai' }).click();
    await member.getByRole('button', { name: 'Bar', exact: true }).click();
    await member.getByRole('button', { name: 'Add Beer' }).click();
    await member.getByRole('button', { name: /^Send to the bar/ }).click();
    // Back on Tonight, a toast says so, and the tracker follows it to the seat: sent, until the service staff take it (#640).
    await expect(member.getByText('Order sent')).toBeVisible();
    await expect(member.getByText('Masala chai, Beer')).toBeVisible();
    const tracker = member.getByRole('list', { name: 'Order' });
    await expect(tracker.locator('[aria-current="step"]')).toHaveText('Sent');

    // The Service role (#640): the steward lands on food and drink, with nothing else, and serves the order.
    const steward = await browser.newPage();
    await signInToConsole(steward, '9000000790');
    await expect(steward.getByRole('heading', { name: 'To accept' })).toBeVisible();
    await expect(steward.getByRole('link', { name: 'Live floor' })).toHaveCount(0);
    const fromApp = /^KOT (\d+) /.exec((await steward.getByText(/^KOT \d+ · Table 3, seat 1 · Ishan Mehta \(\d+\)$/).last().textContent()) ?? '')?.[1] ?? '';
    await steward.getByRole('button', { name: `Accept KOT ${fromApp}` }).click();
    await member.reload();
    await expect(tracker.locator('[aria-current="step"]')).toHaveText('Preparing');
    await steward.getByRole('button', { name: `KOT ${fromApp} on its way` }).click();
    await member.reload();
    await expect(tracker.locator('[aria-current="step"]')).toHaveText('On its way');
    await steward.getByRole('button', { name: `Mark KOT ${fromApp} delivered` }).click();
    await expect(steward.getByText(/^Delivered in /).first()).toBeVisible();
    await member.reload();
    await expect(tracker.locator('[aria-current="step"]')).toHaveText('Delivered');
    await expect(member.getByRole('button', { name: 'Order again' })).toBeVisible();
    await steward.close();

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
    await expect(page.getByText('1 × Masala chai, 1 × Beer').first()).toBeVisible();
    await expect(page.getByText('1 × Fresh lime soda').first()).toBeVisible();
    await expect(page.getByText('Paid · Given to the bar by hand')).toHaveCount(2);

    await page.getByRole('radiogroup', { name: 'Seat', exact: true }).getByRole('radio', { name: 'Table 3, seat 1 · Ishan Mehta' }).click();
    await page.getByRole('button', { name: 'One more Club sandwich' }).click();
    await page.getByRole('switch', { name: 'Comp it: RIVR pays Glaza' }).click();
    await page.getByRole('button', { name: 'Send to the bar' }).click();
    const comp = await kotIn(page, /^Sent to the bar: KOT \d+\.$/);
    // The next order starts afresh, not comped and with no seat chosen (F2-20).
    await expect(page.getByRole('switch', { name: 'Comp it: RIVR pays Glaza' })).not.toBeChecked();
    await expect(page.getByRole('radiogroup', { name: 'Seat', exact: true }).getByRole('radio', { name: 'Table 3, seat 1 · Ishan Mehta' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: `Mark KOT ${comp} sent` }).click();
    await expect(page.getByText('Every KOT is at the bar.')).toBeVisible();
    await expect(page.getByText('Comp · Given to the bar by hand')).toBeVisible();

    // The menu (#799): each item under its kind, by its name alone; and from a CSV, every line shown before it is saved.
    for (const kind of ['Food', 'Soft drinks', 'Bar']) await expect(page.getByRole('heading', { name: kind, level: 3, exact: true })).toBeVisible();
    await expect(page.getByText('Masala chai · Soft drink')).toHaveCount(0);
    const picker = page.locator('input[type="file"][accept=".csv,text/csv"]');
    const csv = (text: string) => ({ name: 'menu.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
    await picker.setInputFiles(csv('name,type,price\nFilter coffee,soft drinks,80\nKulfi,dessert,150\n'));
    await expect(page.getByText('Line 3: use food, soft drinks or bar as the type.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save items' })).toHaveCount(0);
    await picker.setInputFiles(csv('name,type,price,on offer\nFilter coffee,soft drinks,80,yes\nGin and tonic,bar,450,no\n'));
    await expect(page.getByText('Filter coffee · Soft drinks · On offer')).toBeVisible();
    await expect(page.getByText('Gin and tonic · Bar · Off the menu')).toBeVisible();
    await page.getByRole('button', { name: 'Save items' }).click();
    await expect(page.getByText('2 items saved to the menu.')).toBeVisible();
    await expect(page.getByText('Gin and tonic', { exact: true })).toBeVisible();
    await expect(page.getByText(/₹/)).toHaveCount(0);

    await revoke(page, name);
    await page.getByRole('link', { name: 'Live floor' }).click();
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    // One Leave (decision 0299): he owes call time, so he is let go early with a reason, and his seat is freed with it.
    await page.getByRole('button', { name: 'Ishan Mehta leaves' }).click();
    await page.getByRole('textbox', { name: 'Why they leave early' }).fill('End of the F&B flow');
    await page.getByRole('button', { name: 'Let leave early' }).click();
    await expect(page.getByRole('button', { name: 'Ishan Mehta leaves' })).toHaveCount(0);
  });
});
