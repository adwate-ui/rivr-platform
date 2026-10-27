/**
 * Dealers (#124; scope-v1 module 10; decision 0252). Sameer Kohli, this flow's own floor manager, opens Floor →
 * Dealers. The rotation board lists who deals where and for how long, the due first, and who rests; the tablet
 * flows move Pema Lepcha between tables, so the board is read as it stands. Below it, over the last month of club
 * days, each dealer's downs, time, hands, rake and drop-box variance: the seed's Pema (56_floor.sql) with her share
 * of the tip pool by time dealt. A choice of days out of order is refused. Who may read the board, when a dealer is
 * due and what a period counts are proved in supabase/tests/162_dealer_rotation.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A club day (06:00 to 06:00 IST) some days before today's, as the date input takes it. */
const clubDay = (daysBefore: number) => new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000 - daysBefore * DAY_MS).toISOString().slice(0, 10);

test.describe('Dealers', () => {
  test('Dealers: the floor manager reads the rotation board and each dealer\'s hours, hands and tip-pool share', async ({ page }) => {
    test.skip(isRemoteTarget(), 'signs in as this flow\'s own floor manager, so the local stack only');
    await signInToConsole(page, '9000000770');
    await page.getByRole('link', { name: 'Dealers', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dealers', level: 1 })).toBeVisible({ timeout: 10_000 });

    const board = page.getByRole('table', { name: 'Rotation' });
    await expect(board).toBeVisible({ timeout: 10_000 });
    await expect(board.getByText('Pema Lepcha').or(board.getByText('No dealers on the floor.')).first()).toBeVisible();

    await expect(page.getByLabel('From')).toHaveValue(clubDay(0));
    await page.getByLabel('From').fill(clubDay(30));
    const nights = page.getByRole('table', { name: 'Hours and hands' });
    const pema = nights.getByRole('row').filter({ hasText: 'Pema Lepcha' });
    await expect(pema).toBeVisible({ timeout: 10_000 });
    await expect(pema).toContainText('%');
    await expect(page.getByText('Tips belong to dealers. The export shares the tip pool by time dealt.')).toBeVisible();

    await page.getByLabel('From').fill(clubDay(-1));
    await expect(page.getByText('Choose a first day no later than the last.')).toBeVisible();
  });
});
