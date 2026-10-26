/**
 * The door kiosk and feedback (#331, #160; decisions 0164 and 0165), signed in once on the console as a
 * floor manager (Rahul Verma, this flow's own sign-in: Auth sends one code a minute to a number):
 * - he adds a door kiosk on the Tablets screen and reads out its code; the tablet pairs with it and
 *   shows the card scanner, not hand entry;
 * - Vidya Chadha, from the seed's hundred more members whom no other flow signs in as, opens her card;
 *   the kiosk's card scanner reads it: she is welcomed in, and the next scan says goodbye;
 * - her Home then asks how her visit was; she gives it a 2 with a note, and is told the General Manager
 *   will look into it;
 * - Rahul, an admin, sees the ticket on Feedback and resolves it with what was done.
 * The kiosk is revoked at the end. In and out with no time played, Vidya's visit earns nothing. A scan
 * within ten minutes of a visit closing says goodbye, so a rerun waits ten minutes or a fresh seed.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** What the QR on the member's card holds now. */
async function doorCode(member: Page): Promise<string> {
  await member.getByRole('link', { name: 'Profile' }).click();
  await member.getByRole('button', { name: 'Show card' }).click();
  const qr = member.getByRole('img', { name: 'Your door code' });
  await expect(qr).toBeVisible();
  return (await qr.getAttribute('data-value')) ?? '';
}

/** The kiosk's card scanner types the code and presses Enter, as a scanner plugged into it does. */
async function scan(kiosk: Page, code: string) {
  const scanner = kiosk.getByRole('textbox', { name: 'Card scanner' });
  await scanner.fill(code);
  await scanner.press('Enter');
}

test.describe('Door kiosk', () => {
  test('Door kiosk: a member scans in and out at the door, then rates her visit, and the General Manager resolves it', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and opens and closes a visit, so the local stack only');
    test.setTimeout(120_000);
    const name = `Door ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000142');
    await floor.getByRole('link', { name: 'Tablets' }).click();
    await floor.getByRole('textbox', { name: 'Tablet name' }).fill(name);
    await floor.getByRole('switch', { name: 'Door kiosk' }).click();
    await floor.getByRole('button', { name: 'Add and pair' }).click();
    const codeLine = floor.getByText(/^Pairing code \d{6}/);
    await expect(codeLine).toBeVisible();
    const code = (await codeLine.textContent())?.match(/\d{6}/)?.[0] ?? '';

    const kiosk = await browser.newPage();
    await kiosk.setViewportSize(VIEWPORT.tablet);
    await kiosk.goto(appUrl('tablet'));
    await kiosk.getByRole('textbox', { name: 'Pairing code' }).fill(code);
    await kiosk.getByRole('button', { name: 'Pair' }).click();
    await expect(kiosk.getByRole('heading', { name: 'Hold your RIVR card up to the camera' })).toBeVisible();
    await expect(kiosk.getByRole('heading', { name: 'Hand entry' })).toHaveCount(0);

    // In, then out: the same card, scanned twice.
    const member = await (await browser.newContext()).newPage();
    await signInToPlayer(member, '9000000401');
    await scan(kiosk, await doorCode(member));
    await expect(kiosk.getByText('Welcome, Vidya.', { exact: true })).toBeVisible();
    await scan(kiosk, await doorCode(member));
    await expect(kiosk.getByText('Goodbye, Vidya.', { exact: true })).toBeVisible();

    // Home asks how it was; a 2 with a note is a ticket for the General Manager.
    await member.getByRole('link', { name: 'Home' }).click();
    await expect(member.getByRole('heading', { name: /^How was \w+day\?$/ })).toBeVisible();
    await member.getByRole('group', { name: 'Your rating, 1 to 5' }).getByRole('button', { name: '2', exact: true }).click();
    await member.getByRole('textbox', { name: 'Anything to add (optional)' }).fill('The door queue was slow.');
    await member.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(member.getByText('Thank you. The General Manager will look into it and may call you.')).toBeVisible();

    await floor.getByRole('link', { name: 'Feedback' }).click();
    await expect(floor.getByText('The door queue was slow.')).toBeVisible();
    await floor.getByRole('textbox', { name: 'What was done' }).first().fill('Second host on the door from Friday.');
    await floor.getByRole('button', { name: 'Resolve Vidya Chadha’s ticket' }).first().click();
    await expect(floor.getByText(/^Resolved by Rahul Verma on .*: Second host on the door from Friday\.$/)).toBeVisible();

    await floor.getByRole('link', { name: 'Tablets' }).click();
    await floor.getByRole('button', { name: `Revoke ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is revoked' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Revoke the tablet' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
