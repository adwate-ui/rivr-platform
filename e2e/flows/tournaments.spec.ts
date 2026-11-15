/**
 * Tournaments, interest only (redesign RD-26, issue 969). Leela Pillai, this flow's own admin, opens Tournaments under
 * Marketing and creates one for the day after tomorrow in the panel, with a name of the run's own, a start and a game, and
 * nowhere for money. Ajay Dhillon, this flow's own member, sees it under Tournaments on Home and taps Notify me. Leela
 * opens its record, finds him among those who asked, and sends the notification, once: the list says 1 notified. On the
 * Past list she types Diwali Deepstack's entries, and he finds it in his Sessions, as he asked about it (seed). Last, she
 * cancels her tournament and it leaves his Home. The rules, and the notice written for each member who hears of
 * tournaments, are proved in supabase/tests/460_tournaments.test.sql; the words of the push and the WhatsApp message in
 * packages/adapters/src/messages.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { openFromRail } from '../support/console.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** The IST day two days from now, as a date field takes it: `2026-11-05`. */
const dayAfterTomorrow = () => new Date(Date.now() + 2 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

test.describe('Tournaments', () => {
  test('Tournament interest: the club creates a tournament, a member asks to be notified, the club notifies once, and a past one keeps its entries', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'creates and cancels a tournament in the local database, so the local stack only');
    test.setTimeout(120_000);
    const run = String(Date.now() % 100_000).padStart(5, '0');
    const name = `Flow Cup ${run}`;
    const entries = String(40 + (Date.now() % 50));

    const leela = await browser.newPage();
    await signInToConsole(leela, '9000000116');
    await openFromRail(leela, 'Tournaments');
    await expect(leela.getByRole('heading', { name: 'Tournaments', level: 1 })).toBeVisible();
    await leela.getByRole('button', { name: 'New tournament' }).click();
    const form = leela.getByRole('dialog', { name: 'New tournament' });
    await expect(form.getByLabel(/buy-in|prize|guarantee|stake|fee/i)).toHaveCount(0);
    await form.getByRole('textbox', { name: 'Name' }).fill(name);
    await form.getByLabel('Day', { exact: true }).fill(dayAfterTomorrow());
    await form.getByRole('textbox', { name: 'Start time' }).fill('16:00');
    await form.getByRole('radio', { name: 'Pot-Limit Omaha' }).click();
    await form.getByRole('button', { name: 'Create' }).click();
    await expect(leela.getByText(`${name} created`)).toBeVisible();
    const row = leela.getByRole('row').filter({ has: leela.getByRole('button', { name, exact: true }) });
    await expect(row).toContainText('Pot-Limit Omaha');
    await expect(row).toContainText('Not yet');

    const ajay = await browser.newPage();
    await signInToPlayer(ajay, '9000000408');
    await expect(ajay.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
    await expect(ajay.getByText(name, { exact: true })).toBeVisible();
    // No money on the tournament; the only ₹ on Home is each table's minimum buy-in (owner, 8 Nov). Nothing to register for.
    await expect(ajay.getByText(/₹/).filter({ hasNotText: /^Min buy-in ₹/ })).toHaveCount(0);
    await expect(ajay.getByText(/regist/i)).toHaveCount(0);
    await ajay.getByRole('button', { name: `Notify me: ${name}` }).click();
    await expect(ajay.getByRole('button', { name: `Notifying you: ${name}` })).toHaveText('Notifying you');

    // The record shows who asked; Notify sends once, and the list then says how many were notified.
    await leela.reload();
    await row.getByRole('button', { name, exact: true }).click();
    const record = leela.getByRole('dialog', { name });
    await expect(record.getByText(/^Ajay Dhillon · No\. /)).toBeVisible();
    await record.getByRole('button', { name: 'Notify 1' }).click();
    await expect(leela.getByText(`1 notified: ${name}`)).toBeVisible();
    await expect(record.getByRole('button', { name: /^Notify/ })).toHaveCount(0);
    await record.getByRole('button', { name: 'Close' }).click();
    await expect(row).not.toContainText('Not yet');


    // A past tournament keeps its entries, typed; and it is in the Sessions of a member who asked about it.
    await leela.getByRole('main').getByRole('link', { name: /^Past/ }).click();
    const past = leela.getByRole('row').filter({ has: leela.getByRole('button', { name: 'Diwali Deepstack', exact: true }) });
    await past.getByRole('button', { name: 'Diwali Deepstack', exact: true }).click();
    const pastRecord = leela.getByRole('dialog', { name: 'Diwali Deepstack' });
    await expect(pastRecord.getByRole('button', { name: /^Notify|Cancel tournament/ })).toHaveCount(0);
    await pastRecord.getByRole('textbox', { name: 'Entries' }).fill(entries);
    await pastRecord.getByRole('button', { name: 'Save' }).click();
    await expect(leela.getByText('Entries saved')).toBeVisible();
    await expect(past).toContainText(entries);

    await ajay.getByRole('link', { name: 'Sessions' }).click();
    const session = ajay.getByRole('button', { name: /Diwali Deepstack/ });
    await expect(session).toContainText(`Tournament · ${entries} entries`);
    await session.click();
    await expect(ajay.getByRole('heading', { name: 'Diwali Deepstack', level: 1 })).toBeVisible();
    await expect(ajay.getByText('Started')).toBeVisible();
    await expect(ajay.getByText(/₹/)).toHaveCount(0);

    // Cancelled, it leaves the list and the member's Home.
    await leela.getByRole('main').getByRole('link', { name: /^Upcoming/ }).click();
    await row.getByRole('button', { name, exact: true }).click();
    await record.getByRole('button', { name: 'Cancel tournament' }).click();
    await record.getByRole('button', { name: 'Yes, cancel it' }).click();
    await expect(leela.getByText(`${name} cancelled`)).toBeVisible();
    await expect(row).toHaveCount(0);
    await ajay.getByRole('link', { name: 'Home' }).click();
    await expect(ajay.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
    await expect(ajay.getByText(name, { exact: true })).toHaveCount(0);
  });
});
