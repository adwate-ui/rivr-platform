/**
 * Pot data (#114; features "Pot data"; decision 0185). Anika Rao, this flow's own super admin, opens
 * Floor → Pot data: the hands of the club's day, by default today's. She widens the period to the last
 * week, and the hands the tablet flows logged, if any ran, list with their table, dealer, variant and
 * money, filtered by table, dealer and variant. A choice of days out of order is refused. Who may read pot
 * data, and that a period holds only its days, is proved in supabase/tests/102_interest_and_pot_data.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A club day (06:00 to 06:00 IST) some days before today's, as the date input takes it. */
const clubDay = (daysBefore: number) => new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000 - daysBefore * DAY_MS).toISOString().slice(0, 10);

test.describe('Pot data', () => {
  test('Pot data: the super admin reads the week\'s hands by table, dealer and variant', async ({ page }) => {
    test.skip(isRemoteTarget(), 'signs in as this flow\'s own super admin, so the local stack only');
    await signInToConsole(page, '9000000704');
    await page.getByRole('link', { name: 'Hands', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Hands', level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('From')).toHaveValue(clubDay(0));

    // The seed's floor (56_floor.sql) has Pema Lepcha deal a four of a kind at Table 2 on the night it loads.
    await page.getByLabel('From').fill(clubDay(7));
    const hands = page.getByRole('table', { name: 'Hands' });
    await expect(hands).toBeVisible({ timeout: 10_000 });
    await page.getByRole('group', { name: 'Dealer' }).getByRole('button', { name: 'Pema Lepcha' }).click();
    await page.getByRole('group', { name: 'Table' }).getByRole('button', { name: 'Table 2' }).click();
    await expect(hands.getByText('Four of a kind').first()).toBeVisible();
    await expect(hands.getByText('Pema Lepcha').first()).toBeVisible();

    await page.getByLabel('From').fill(clubDay(-1));
    await expect(page.getByText('Choose a first day no later than the last.')).toBeVisible();
  });
});
