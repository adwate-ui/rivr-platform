/**
 * One sign-in per person per checkpoint, through the apps as people sign in (Auth sends one code a minute to a
 * number, so each person has their own). Staff sign in to the console, members to the player app; the admin then
 * pairs a dealer tablet (the dealer signs in with their PIN), a door kiosk and a TV, as the e2e flows do.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { STAFF_ROLES } from '@rivr/contracts';
import { appUrl, VIEWPORT } from '../../../e2e/support/apps.ts';
import { signInToConsole, signInToPlayer } from '../../../e2e/support/signIn.ts';
import { tabletAt } from '../../../e2e/support/tablet.ts';
import { MEMBERS, type Person } from '../src/census/plan.ts';
import { useSimClock } from './clock.ts';
import { answeredBanner } from './census.ts';
import { readContext, sessionFile } from './context.ts';

const context = readContext();
const simNow = new Date(context.simNow);
const PIN = '2741';

async function signedIn(browser: Browser, person: Person, signIn: (page: Page, number: string) => Promise<void>): Promise<void> {
  const number = context.numbers[person];
  if (number === undefined) throw new Error(`no test number for ${person}`);
  const browserContext = await browser.newContext({ timezoneId: 'Asia/Kolkata', locale: 'en-IN', storageState: answeredBanner() });
  const page = await browserContext.newPage();
  await useSimClock(page, simNow);
  await signIn(page, number);
  await browserContext.storageState({ path: sessionFile(context, person) });
  await browserContext.close();
}

for (const role of STAFF_ROLES) {
  test(`signs in ${role}`, async ({ browser }) => {
    await signedIn(browser, role, async (page, number) => {
      await signInToConsole(page, number);
      await expect(page.getByRole('navigation').first()).toBeVisible();
    });
  });
}

for (const member of MEMBERS) {
  test(`signs in ${member}`, async ({ browser }) => {
    await signedIn(browser, member, async (page, number) => {
      await signInToPlayer(page, number);
    });
  });
}

/** The admin's console, from the session saved above. */
async function adminConsole(browser: Browser): Promise<Page> {
  const browserContext = await browser.newContext({ storageState: sessionFile(context, 'admin'), timezoneId: 'Asia/Kolkata' });
  const page = await browserContext.newPage();
  await useSimClock(page, simNow);
  return page;
}

async function pairTablet(browser: Browser): Promise<void> {
  const admin = await adminConsole(browser);
  const { tablet } = await tabletAt(browser, admin, context.table);
  await tablet.reload();
  await tablet.getByRole('button', { name: context.dealer, exact: true }).click();
  for (const digit of PIN) await tablet.getByRole('button', { name: digit, exact: true }).click();
  await tablet.getByRole('button', { name: 'Sign in' }).click();
  await expect(tablet.getByRole('heading', { name: 'Seats', level: 1 })).toBeVisible();
  await tablet.context().storageState({ path: sessionFile(context, 'tablet') });
}

async function pairDoor(browser: Browser): Promise<void> {
  const admin = await adminConsole(browser);
  await admin.goto(`${appUrl('console')}/settings?tab=devices&part=tablets`);
  await admin.getByRole('textbox', { name: 'Tablet name' }).fill(`Door ${context.checkpoint}`);
  await admin.getByRole('switch', { name: 'Door kiosk' }).click();
  await admin.getByRole('button', { name: 'Add and pair' }).click();
  const code = (await admin.getByText(/^Pairing code \d{6}/).textContent())?.match(/\d{6}/)?.[0] ?? '';
  const kiosk = await (await browser.newContext({ viewport: VIEWPORT.tablet, timezoneId: 'Asia/Kolkata' })).newPage();
  await useSimClock(kiosk, simNow);
  await kiosk.goto(appUrl('tablet'));
  await kiosk.getByRole('textbox', { name: 'Pairing code' }).fill(code);
  await kiosk.getByRole('button', { name: 'Pair' }).click();
  await expect(kiosk.getByRole('heading', { name: 'Hold your RIVR card up to the camera' })).toBeVisible();
  await kiosk.context().storageState({ path: sessionFile(context, 'door') });
}

async function pairTv(browser: Browser): Promise<void> {
  const tv = await (await browser.newContext({ viewport: VIEWPORT.display, timezoneId: 'Asia/Kolkata' })).newPage();
  await useSimClock(tv, simNow);
  await tv.goto(appUrl('display'));
  const code = (await tv.getByRole('heading', { level: 2, name: /^\d{6}$/ }).textContent()) ?? '';
  const admin = await adminConsole(browser);
  await admin.goto(`${appUrl('console')}/settings?tab=devices&part=tvs`);
  await admin.getByRole('textbox', { name: 'Code on the TV' }).fill(code);
  await admin.getByRole('textbox', { name: 'TV name' }).fill(`TV ${context.checkpoint}`);
  await admin.getByRole('radiogroup', { name: 'What it shows' }).getByRole('radio', { name: 'Waitlist board', exact: true }).click();
  await admin.getByRole('button', { name: 'Pair the TV' }).click();
  await expect(tv.getByRole('heading', { level: 2, name: /^\d{6}$/ })).toHaveCount(0, { timeout: 15_000 });
  await tv.context().storageState({ path: sessionFile(context, 'tv') });
}

test.describe.serial('devices', () => {
  test('pairs a dealer tablet and the dealer signs in', async ({ browser }) => pairTablet(browser));
  test('pairs a door kiosk', async ({ browser }) => pairDoor(browser));
  test('pairs a TV on the waitlist board', async ({ browser }) => pairTv(browser));
});
