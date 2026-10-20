/**
 * Certification (#50; tech plan item 18): staff train in the practice venue on the same apps.
 * - At the club, Certification says the quizzes run in the practice venue.
 * - A dealer and a cashier switch the console to the practice venue and take their certification
 *   quizzes; the database marks each attempt and keeps it on their staff record. The cashier fails
 *   once, then passes.
 * - The floor manager reads every attempt in the practice venue, and pairs a tablet there, whose
 *   header says it is the practice venue's.
 * Each person is the flow's own: Auth sends one code a minute to a number.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { revoke, tabletAt } from '../support/tablet.ts';

const DEALER = [
  ['When do you log a hand on the tablet?', 'Once the pot is pushed to the winner'],
  ['What do you enter on the tablet for each hand?', 'The pot: the tablet works out the rake and the jackpot drop'],
  ['A player shows down a straight flush.', 'Claim the high hand on the tablet with that hand, for the floor to approve'],
  ['A seated player wants more chips.', 'Send a buy-in request from the tablet: the cage brings the chips'],
  ['The tablet loses its connection during your down.', 'Keep logging hands: they wait on the tablet and go once it reconnects'],
  ['Your down is over.', 'End the down on the tablet and enter the drop-box count'],
] as const;

const CASHIER = [
  ['A member wants to buy in but has not finished the identity check.', 'Send them to finish the identity check first'],
  ['You have prepared a withdrawal. Who approves it?', 'A second staff member, never the one who prepared it'],
  ['A member says they have paid a deposit by UPI. When do you confirm it?', 'Once the amount with its UTR is found in the bank'],
  ['A member asks for a marker.', 'Only within the credit limit set for them, signed by the member on the cage screen'],
  ['Your shift is ending.', 'Count the chips and cash and close the shift: a difference needs a reason'],
  ['The console shows the venue is frozen.', 'Stop: no money moves until the freeze is released'],
] as const;

// Two wrong: four of six is not a pass at 80%.
const CASHIER_TWO_WRONG = [
  ...CASHIER.slice(0, 4),
  ['Your shift is ending.', 'Count only the cash'],
  ['The console shows the venue is frozen.', 'Carry on with cash only'],
] as const;

/** Signs in, turns on the practice venue at the foot of the rail, and opens Certification. */
async function certificationInPractice(page: Page, number: string) {
  await signInToConsole(page, number);
  await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();
  const rail = page.getByRole('complementary');
  await rail.getByRole('switch', { name: 'Practice venue' }).click();
  await expect(rail.getByText('RIVR Practice')).toBeVisible();
  await page.getByRole('link', { name: 'Certification' }).click();
}

/** Picks one choice for each question, by its prompt, and hands the answers in. */
async function handIn(page: Page, answers: readonly (readonly [string, string])[]) {
  for (const [index, [prompt, choice]] of answers.entries()) {
    await page.getByRole('group', { name: `${index + 1}. ${prompt}` }).getByRole('button', { name: choice, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Hand in answers' }).click();
}

test.describe('Certification', () => {
  test('a dealer and a cashier take their quizzes in the practice venue, and the floor manager sees the attempts and pairs a training tablet', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, so the local stack only');
    test.setTimeout(120_000);
    const dealer = await browser.newPage();
    await signInToConsole(dealer, '9000000170');
    await dealer.getByRole('link', { name: 'Certification' }).click();
    await expect(dealer.getByText(/^Certification quizzes run in the practice venue\./)).toBeVisible({ timeout: 5000 });
    await dealer.getByRole('complementary').getByRole('switch', { name: 'Practice venue' }).click();
    await dealer.getByRole('button', { name: 'Start Dealer certification' }).click();
    await dealer.getByRole('button', { name: 'Hand in answers' }).click();
    await expect(dealer.getByText('Answer every question, then hand in.')).toBeVisible();
    await handIn(dealer, DEALER);
    await expect(dealer.getByText('Passed: 6 of 6. It is on your staff record.')).toBeVisible();
    await dealer.getByRole('button', { name: 'Back to quizzes' }).click();
    await expect(dealer.getByText(/^You passed on \d{1,2} [A-Z][a-z]{2,3} \d{4} with 6 of 6\./)).toBeVisible();
    // A dealer does not manage staff, so sees no one else's attempts.
    await expect(dealer.getByRole('table', { name: 'Attempts' })).toHaveCount(0);

    const cashier = await browser.newPage();
    await certificationInPractice(cashier, '9000000171');
    await cashier.getByRole('button', { name: 'Start Cashier certification' }).click();
    await handIn(cashier, CASHIER_TWO_WRONG);
    await expect(cashier.getByText('Not a pass: 4 of 6. A pass needs 80% right. Read the procedures again and try once more.')).toBeVisible();
    await cashier.getByRole('button', { name: 'Try again' }).click();
    await handIn(cashier, CASHIER);
    await expect(cashier.getByText('Passed: 6 of 6. It is on your staff record.')).toBeVisible();

    const floor = await browser.newPage();
    await certificationInPractice(floor, '9000000172');
    const attempts = floor.getByRole('table', { name: 'Attempts' });
    await floor.getByRole('searchbox', { name: 'Find a name' }).fill('Swati');
    const swati = attempts.getByRole('row').filter({ hasText: 'Swati Agarwal' });
    await expect(swati.filter({ hasText: '6 of 6' }).filter({ hasText: 'Passed' }).first()).toBeVisible();
    await expect(swati.filter({ hasText: '4 of 6' }).filter({ hasText: 'Not passed' }).first()).toBeVisible();
    await floor.getByRole('searchbox', { name: 'Find a name' }).fill('Manoj');
    await expect(attempts.getByRole('row').filter({ hasText: 'Manoj Thapa' }).filter({ hasText: 'Dealer certification' }).first()).toBeVisible();

    // A tablet paired in the practice venue says so, so nobody takes it for a live one.
    const { tablet, name } = await tabletAt(browser, floor, 'Table 1');
    await tablet.reload();
    await expect(tablet.getByText('Table 1, practice venue', { exact: true })).toBeVisible();
    await revoke(floor, name);
  });
});
