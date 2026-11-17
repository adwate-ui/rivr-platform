/**
 * A seated member stays signed in (redesign RD-34; decision 0641). Payal Bhatt, this flow's own member (Auth sends one
 * code a minute to a number), is seated at Table 2 by Gauri Sehgal, its own floor manager, and sees her call time. Then
 * the app is opened again as it is after hours with the phone locked: with a session whose hour ran out five hours ago,
 * which it renews once and quietly; with no connection, when it shows the seat it kept and never sign-in; and after a
 * renewal whose reply never reached the phone, which Auth answers again. Her seat is set down and taken away in the
 * local database, and the lost reply is made by spending her token outside the app, so the local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { localSupabaseEnv, worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { seatOnFloor } from '../support/floor.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const PAYAL = '00000000-0000-4000-8000-000000000450';
const FIVE_HOURS = 5 * 60 * 60;

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Payal with no seat and no place on a list. */
function reset() {
  sql(`delete from public.waitlist_entry where member_id = '${PAYAL}'`);
  sql(`delete from public.seat_session where member_id = '${PAYAL}'`);
}

/** The session the phone keeps, made to read as one whose hour ran out five hours ago; gives its refresh token. */
async function ageStoredSession(page: Page): Promise<string> {
  return page.evaluate((seconds) => {
    const stored: unknown = JSON.parse(localStorage.getItem('rivr-session') ?? 'null');
    if (typeof stored !== 'object' || stored === null || !('refresh_token' in stored) || typeof stored.refresh_token !== 'string') throw new Error('No session is stored');
    localStorage.setItem('rivr-session', JSON.stringify({ ...stored, expires_at: Math.floor(Date.now() / 1000) - seconds }));
    return stored.refresh_token;
  }, FIVE_HOURS);
}

/** A new page of the same phone opened on Home, keeping every address it shows and every answer Auth gives a renewal. */
async function openApp(context: BrowserContext) {
  const page = await context.newPage();
  const shown: string[] = [];
  const renewals: number[] = [];
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) shown.push(new URL(frame.url()).pathname); });
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && response.url().includes('/auth/v1/token')) renewals.push(response.status());
  });
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}/`);
  return { page, shown, renewals };
}

/** Her seat, and when she sat down there (the owner, 17 Nov: no countdown). */
async function expectCallTime(page: Page) {
  await expect(page.getByRole('heading', { name: 'Table 2, seat 6' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Playing since')).toBeVisible();
}

test.describe.serial('Stays signed in', () => {
  test.skip(isRemoteTarget(), 'seats a member in the local database and spends her token outside the app, so the local stack only');
  let phone: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90_000);
    reset();
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000157');
    await seatOnFloor(floor, { table: 'Table 2', seat: 6, number: '9000000450' });
    await floor.close();
    phone = await browser.newContext();
    page = await phone.newPage();
    await signInToPlayer(page, '9000000450');
    await expectCallTime(page);
    // The shell is kept for a launch with no connection once the service worker has it.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  });

  test.afterAll(async () => {
    await phone.close();
    reset();
  });

  test('Stays signed in: opened five hours after its session ran out, the app renews it once and shows the call time', async () => {
    await ageStoredSession(page);
    await page.close();
    const opened = await openApp(phone);
    page = opened.page;
    await expectCallTime(page);
    expect(opened.shown).not.toContain('/sign-in');
    expect(opened.renewals).toEqual([200]);
  });

  test('Stays signed in: opened with no connection, the app shows the seat it kept, and Home again once online', async () => {
    test.setTimeout(90_000);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('rivr.offline.v2')?.includes('my-seat') ?? false)).toBe(true);
    await ageStoredSession(page);
    await page.close();
    await phone.setOffline(true);
    const opened = await openApp(phone);
    page = opened.page;
    await expect(page.getByText(/^No connection\. Showing tables as of \d\d:\d\d\.$/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Table 2, seat 6' })).toBeVisible();
    expect(opened.shown).not.toContain('/sign-in');

    await phone.setOffline(false);
    await expect(page.getByText(/^No connection\./)).toHaveCount(0, { timeout: 15_000 });
    await expectCallTime(page);
    // The renewal held back while there was no network goes through, and nothing signs her out.
    await expect.poll(() => opened.renewals, { timeout: 45_000 }).toContain(200);
    expect(opened.renewals.filter((status) => status !== 200)).toEqual([]);
    expect(opened.shown).not.toContain('/sign-in');
  });

  test('Stays signed in: a renewal whose reply never reached the phone does not sign her out', async ({ request }) => {
    test.setTimeout(90_000);
    const refreshToken = await ageStoredSession(page);
    await page.close();
    // The phone asked for a renewal and never got the answer: Auth has moved on to a token the phone does not hold.
    const { url, publishableKey } = localSupabaseEnv();
    const spent = await request.post(`${url}/auth/v1/token?grant_type=refresh_token`, {
      headers: { apikey: publishableKey, 'content-type': 'application/json' }, data: { refresh_token: refreshToken },
    });
    expect(spent.status()).toBe(200);
    // Past the ten seconds in which Auth takes the same token twice from anyone.
    await new Promise((resolve) => setTimeout(resolve, 12_000));

    const opened = await openApp(phone);
    page = opened.page;
    await expectCallTime(page);
    expect(opened.shown).not.toContain('/sign-in');
    expect(opened.renewals).toEqual([200]);
  });
});
