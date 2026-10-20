/**
 * TV pairing (#49), end to end, signed in once on the console as a floor supervisor (Naveen Rao,
 * this flow's own sign-in: Auth sends one code a minute to a number):
 * - a TV that is not paired shows a six-digit code; a code no TV shows is refused on the console;
 * - he types the TV's code in with a name and the tournament clock (a mode still to be built, so the
 *   TV shows its name and its name only), and the TV shows it;
 * - he puts promotions on it, which the TV shows without a reload, and again within five seconds of one;
 * - once unpaired, the TV shows a new code.
 * The waitlist and jackpot boards themselves are the "TV boards" flow.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('TV pairing', () => {
  test('TV pairing: a TV shows a code, the console pairs it with a mode and changes it; unpaired, it shows a new code', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, so the local stack only');
    test.setTimeout(90_000);
    // Five digits always, so no earlier run's TV name is a prefix of this one.
    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const tv = await browser.newPage();
    await tv.setViewportSize(VIEWPORT.display);
    await tv.goto(appUrl('display'));
    await expect(tv.getByRole('heading', { name: 'Screen pairing' })).toBeVisible();
    const shown = tv.getByRole('heading', { level: 2, name: /^\d{6}$/ });
    await expect(shown).toBeVisible();
    const code = (await shown.textContent()) ?? '';

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000117');
    await floor.getByRole('link', { name: 'TVs' }).click();
    await expect(floor.getByText('A TV paired here joins RIVR Gurugram.')).toBeVisible();
    await floor.getByRole('textbox', { name: 'Code on the TV' }).fill(String((Number(code) + 1) % 1_000_000).padStart(6, '0'));
    await floor.getByRole('textbox', { name: 'TV name' }).fill(name);
    await floor.getByRole('button', { name: 'Pair the TV' }).click();
    await expect(floor.getByText('No TV is showing that code. Check the code on the TV and type it again.')).toBeVisible();
    await floor.getByRole('textbox', { name: 'Code on the TV' }).fill(code);
    await floor.getByRole('group', { name: 'What it shows' }).getByRole('button', { name: 'Tournament clock', exact: true }).click();
    await floor.getByRole('button', { name: 'Pair the TV' }).click();
    await expect(floor.getByText(`${name} is paired. It shows its mode within a few seconds.`)).toBeVisible();

    // The TV asks every three seconds whether its code was typed in.
    await expect(tv.getByRole('heading', { name: 'Tournament clock' })).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByText(name, { exact: true })).toBeVisible();
    // The console's list asks again every ten seconds, so the TV shows as paired on its own.
    const modes = floor.getByRole('group', { name: `What ${name} shows`, exact: true });
    // The row is the chips' group's grandparent: this TV's, not another left by an earlier run.
    await expect(modes.locator('xpath=../..').getByText('Paired', { exact: true })).toBeVisible({ timeout: 15_000 });

    await modes.getByRole('button', { name: 'Promotions', exact: true }).click();
    await expect(modes.getByRole('button', { name: 'Promotions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // Promotions shows a live promotion's slide, or that none is running (#86).
    const promotions = tv.getByText('Promotion', { exact: true }).or(tv.getByText('No promotions running.', { exact: true }));
    await expect(promotions).toBeVisible({ timeout: 15_000 });
    await tv.reload();
    await expect(promotions).toBeVisible({ timeout: 5_000 });

    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
    await expect(tv.getByRole('heading', { name: 'Screen pairing' })).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByRole('heading', { level: 2, name: /^\d{6}$/ })).toBeVisible();
  });
});
