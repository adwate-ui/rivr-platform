/**
 * Satellites and multi-flight events (#519, #524; decisions 0250, 0251). Neel Desai, this flow's own floor manager,
 * makes four Weeknight Turbos: a satellite for a main event, and a Day 1 flight of a Day 2. The list says which is
 * which. A satellite's finish by chips, its tickets, a flight's bag and Day 2's field are proved in
 * supabase/tests/160 and 161; the cage's and the app's tickets in packages/db's hook tests.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

const MAIN = 'Events Main';
const SATELLITE = 'Events Satellite';
const DAY_TWO = 'Events Day 2';
const FLIGHT = 'Events Flight 1A';

/** Today in IST, as a date field takes it. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** The floor makes a Weeknight Turbo by this name; the console opens it. */
async function make(floor: Page, name: string) {
  await floor.getByRole('group', { name: 'Template' }).getByRole('button', { name: 'Weeknight Turbo', exact: true }).click();
  await floor.getByRole('textbox', { name: 'Name' }).fill(name);
  await floor.getByLabel('Day', { exact: true }).fill(today());
  await floor.getByRole('textbox', { name: 'Start time' }).fill('22:00');
  await floor.getByRole('button', { name: 'Make tournament' }).click();
  await expect(floor.getByText(`${name} is on the list.`)).toBeVisible();
}

/** Removes the flow's tournaments, even after a failure: a satellite and a flight before what they feed. */
async function removeAll(floor: Page) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  for (const name of [SATELLITE, FLIGHT, MAIN, DAY_TWO]) {
    const open = floor.getByRole('button', { name: `Open ${name}` });
    if (await open.count() === 0) continue;
    if (await open.isEnabled()) await open.click();
    await floor.getByRole('button', { name: 'Remove', exact: true }).click();
    await floor.getByRole('button', { name: 'Remove it' }).click();
    await expect(open).toHaveCount(0);
  }
}

test.describe('Tournament events', () => {
  test('Tournament events: the floor makes a satellite for a main event and a Day 1 flight of a Day 2', async ({ page }) => {
    await signInToConsole(page, '9000000623');
    await removeAll(page);
    try {
      const list = page.getByRole('table', { name: 'Tournaments' });
      for (const name of [MAIN, DAY_TWO, SATELLITE]) await make(page, name);
      await page.getByRole('group', { name: 'Satellite for' }).getByRole('button', { name: MAIN, exact: true }).click();
      await expect(list.getByRole('row').filter({ hasText: SATELLITE })).toContainText(`Satellite for ${MAIN}`);
      await expect(page.getByText(`Satellite for ${MAIN}`).first()).toBeVisible();

      await make(page, FLIGHT);
      await page.getByRole('group', { name: 'Day 1 flight of' }).getByRole('button', { name: DAY_TWO, exact: true }).click();
      await expect(list.getByRole('row').filter({ hasText: FLIGHT })).toContainText(`Day 1 flight of ${DAY_TWO}`);
      await expect(list.getByRole('row').filter({ hasText: DAY_TWO }).getByRole('cell', { name: 'Day 2', exact: true })).toBeVisible();
      // A flight is bagged, not finished: its panel offers no payouts of its own.
      await expect(page.getByRole('heading', { name: 'Bagging' })).toBeVisible();
    } finally {
      await removeAll(page);
    }
  });
});
