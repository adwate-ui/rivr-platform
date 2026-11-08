/**
 * The devices for the census, after every sign-in (the admin's session pairs them): a dealer tablet the dealer signs in
 * to with their PIN, a door kiosk and a TV, as the e2e flows pair them. A pairing that fails is noted, and that device's
 * screens then show what an unpaired device sees, rather than stopping the census.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { appUrl, VIEWPORT } from '../../../e2e/support/apps.ts';
import { tabletAt } from '../../../e2e/support/tablet.ts';
import { useSimClock } from './clock.ts';
import { readContext, sessionFile } from './context.ts';

const context = readContext();
const simNow = new Date(context.simNow);
const PIN = '2741';

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

async function soft(name: string, pair: () => Promise<void>): Promise<void> {
  await pair().catch((error: unknown) => {
    test.info().annotations.push({ type: 'pairing failed', description: `${name}: ${String(error).slice(0, 300)}` });
  });
}

test('pairs a dealer tablet and the dealer signs in', async ({ browser }) => soft('tablet', () => pairTablet(browser)));
test('pairs a door kiosk', async ({ browser }) => soft('door', () => pairDoor(browser)));
test('pairs a TV on the waitlist board', async ({ browser }) => soft('tv', () => pairTv(browser)));
