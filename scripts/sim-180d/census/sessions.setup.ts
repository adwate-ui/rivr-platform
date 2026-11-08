/**
 * One sign-in per person per checkpoint, through the apps as people sign in (Auth sends one code a minute to a
 * number, so each person has their own). Staff sign in to the console, members to the player app; the admin then
 * pairs a dealer tablet (the dealer signs in with their PIN), a door kiosk and a TV, as the e2e flows do.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { STAFF_ROLES } from '@rivr/contracts';
import { signInToConsole, signInToPlayer } from '../../../e2e/support/signIn.ts';
import { MEMBERS, type Person } from '../src/census/plan.ts';
import { useSimClock } from './clock.ts';
import { answeredBanner } from './census.ts';
import { readContext, sessionFile } from './context.ts';

const context = readContext();
const simNow = new Date(context.simNow);

async function signedIn(browser: Browser, person: Person, signIn: (page: Page, number: string) => Promise<void>): Promise<void> {
  const number = context.numbers[person];
  if (number === undefined) throw new Error(`no test number for ${person}`);
  const browserContext = await browser.newContext({ timezoneId: 'Asia/Kolkata', locale: 'en-IN', storageState: answeredBanner() });
  const page = await browserContext.newPage();
  await useSimClock(page, simNow);
  // A sign-in that fails is itself a finding: it is noted, and that person's screens then show what a stranger sees
  // (the census flags each as a refusal), rather than stopping the census for everyone else.
  await signIn(page, number).catch(async (error: unknown) => {
    test.info().annotations.push({ type: 'sign-in failed', description: `${person}: ${String(error).slice(0, 300)}` });
    await page.screenshot({ path: test.info().outputPath(`sign-in-failed-${person}.png`), fullPage: true });
  });
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
    test.skip(context.numbers[member] === undefined, `no ${member} at this checkpoint`);
    await signedIn(browser, member, async (page, number) => {
      // A member the desk has not checked sees only the identity check (#632), so they land there, not on Home.
      if (member === 'member_unchecked') await signInToPlayer(page, number, '/kyc');
      else await signInToPlayer(page, number);
    });
  });
}
