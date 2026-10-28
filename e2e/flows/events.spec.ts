/**
 * The events calendar (#143; scope-v1 module 7). Leela Nair, this flow's own marketing manager, adds a pro night for
 * tomorrow with eight seats; Aman Bedi, its own member, books a seat from the app, and the console counts it. Seats,
 * refusals and who may are proved in supabase/tests/178_club_events.test.sql.
 */
import { expect, test } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Tomorrow in IST, as a date field takes it. */
const tomorrow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000));

test.describe('Events', () => {
  test('Events: the club adds a pro night and a member books a seat from the app', async ({ page, browser }) => {
    const title = `Pro night ${String(Date.now()).slice(-6)}`;
    await signInToConsole(page, '9000000626');
    await page.getByRole('link', { name: 'Events' }).click();
    await page.getByRole('group', { name: 'Kind' }).getByRole('button', { name: 'Pro night' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByLabel('Day', { exact: true }).fill(tomorrow());
    await page.getByRole('textbox', { name: 'Start time' }).fill('21:00');
    await page.getByRole('textbox', { name: 'Seats' }).fill('8');
    await page.getByRole('button', { name: 'Add event' }).click();
    await expect(page.getByText(`${title} is on the calendar.`)).toBeVisible();
    const row = page.getByRole('table', { name: 'Events' }).getByRole('row').filter({ hasText: title });
    await expect(row).toContainText('0 of 8');

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000627');
    await member.goto(`${appUrl('player')}/events`);
    await member.getByRole('button', { name: `Book ${title}` }).click();
    await expect(member.getByText(`You have a seat at ${title}.`)).toBeVisible();
    await expect(member.getByRole('button', { name: `Give back my seat at ${title}` })).toBeVisible();
    // The Academy's open batch (seed 30_settings.sql) is listed beside the events, booked at the Academy.
    await expect(member.getByText(/^Level 1 · /)).toBeVisible();
    await expect(member.getByRole('button', { name: 'Book at the Academy' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('table', { name: 'Events' }).getByRole('row').filter({ hasText: title })).toContainText('1 of 8');
  });
});
