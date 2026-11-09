/**
 * Waitlist › At the club (decision 0503): while the club checks identity at the desk, Raghav Grewal, let in by his selfie (his own member here: Auth sends one code a minute),
 * asks to join Table 3's list from Tonight before the desk has checked him; the floor (Deepa, a host, who signs in to no other flow at the same time) approves him, sees
 * "ID check needed" with Check ID in place of Seat, checks his originals in the check in person it opens, and back on the
 * list his place has Seat again. The club's switch and his check are set up and taken away in the local database, so the
 * local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { takeDeskPhotos } from '../support/deskPhotos.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const RAGHAV = '00000000-0000-4000-8000-000000000410';
const CLUB = '00000000-0000-4000-8000-000000000001';
const NAME = 'Raghav Grewal';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Raghav with no place, no check and no consent, and the club checking identity in the app. */
function reset() {
  sql(`delete from public.waitlist_entry where member_id = '${RAGHAV}'`);
  sql(`delete from public.seat_session where member_id = '${RAGHAV}'`);
  sql(`delete from public.setting where venue_id = '${CLUB}' and key = 'kyc.at_the_club'`);
  sql(`delete from public.kyc_review where member_id = '${RAGHAV}'`);
  sql(`delete from public.consent where member_id = '${RAGHAV}' and purpose = 'kyc_verification'`);
  sql(`delete from public.kyc_record where member_id = '${RAGHAV}'`);
}

/** The console's card for Table 3's list, and Raghav's row on it. */
function placeRow(host: Page) {
  const list = host.locator('section').filter({ has: host.getByRole('heading', { level: 2, name: 'Table 3', exact: true }) }).last();
  // As waitlist.spec.ts's placeRow: the row holding both his ⋯ menu and his tick.
  return list.locator('div').filter({ has: host.getByRole('button', { name: `More for ${NAME}`, exact: true }) })
    .filter({ has: host.getByRole('checkbox', { name: `Select ${NAME}` }) }).last();
}

// The desk's photos take a phone or tablet's back camera: a computer is sent on to one (decision 0573).
test.use({ hasTouch: true });

test.describe('Waitlist › At the club', () => {
  test.skip(isRemoteTarget(), 'sets the club checking identity at the desk in the local database, so the local stack only');
  test.beforeEach(reset);
  test.afterEach(reset);

  test('a member let in by his selfie joins from the app; the floor runs Check ID at the desk, then Seat', async ({ browser, page }) => {
    // The switch on, and his selfie in (decision 0502), as the app's selfie step leaves it.
    sql(`insert into public.setting (venue_id, key, subject, value, effective_from, reason)
         values ('${CLUB}', 'kyc.at_the_club', '', '{"enabled": true}', now() - interval '1 minute', 'Cashfree is not live')`);
    sql(`insert into public.kyc_record (venue_id, member_id, at_club_from) values ('${CLUB}', '${RAGHAV}', now() - interval '1 hour')`);
    // His sign-up photo, as the selfie step stores it: the desk is shown it beside the camera. Only its row, which stays
    // (Storage refuses a delete in SQL) and is found again on the next run: the flow checks the photo is offered.
    sql(`insert into storage.objects (bucket_id, name) values ('kyc', '${CLUB}/${RAGHAV}/photo.jpg') on conflict do nothing`);

    await signInToPlayer(page, '9000000410');
    await page.getByRole('button', { name: /^Table 3 · / }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Request a seat$/ }).click();
    await expect(page.getByText('Requested', { exact: true })).toBeVisible();
    await expect(page.getByText('Your ID is checked at the desk before you sit.')).toBeVisible();

    const host = await browser.newPage();
    await signInToConsole(host, '9000000158', '/waitlist');
    await host.getByRole('button', { name: `Approve ${NAME}` }).click();
    await expect(placeRow(host)).toContainText('ID check needed');
    await expect(placeRow(host).getByRole('button', { name: `Seat ${NAME}` })).toHaveCount(0);

    // Check ID opens the check in person with him searched; the host checks his originals.
    await placeRow(host).getByRole('button', { name: `Check ${NAME}’s ID` }).click();
    await expect(host.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' })).toHaveValue(NAME);
    await expect(host.getByText('Selfie taken in the app. Check their originals.')).toBeVisible();
    await host.getByRole('button', { name: `Check ${NAME}` }).click();
    await takeDeskPhotos(host);
    await host.getByLabel(`Date of birth on ${NAME}'s original document`).fill('1990-04-10');
    await host.getByRole('textbox', { name: `Last four digits of ${NAME}'s Aadhaar` }).fill('4100');
    await host.getByRole('textbox', { name: `${NAME}'s PAN from the original card` }).fill('ragpg4100g');
    await host.getByRole('switch', { name: `${NAME} agrees to this ID check` }).click();
    await host.getByRole('button', { name: `Verify ${NAME}` }).click();
    await expect(host.getByRole('status').getByText(`${NAME} is verified and can take a seat.`)).toBeVisible();

    // Back on the list, Seat is there again.
    await host.goto(`${appUrl('console')}/waitlist`);
    await expect(placeRow(host)).not.toContainText('ID check needed');
    await expect(placeRow(host).getByRole('button', { name: `Seat ${NAME}` })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Your ID is checked at the desk before you sit.')).toHaveCount(0);
  });
});
