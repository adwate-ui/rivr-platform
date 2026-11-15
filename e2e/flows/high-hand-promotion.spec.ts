/**
 * High hand promotion (redesign RD-23; decision 0622). Nisha Rao, an admin, starts a promotion from the High hand bonus
 * template: three hands, each with its Bonus. She adds any full house at 1,000 and removes the straight flush, keeps the
 * three rules and the budget each month, simulates it on last week and submits it. Kabir Anand, a super admin, approves it
 * and it is live: its row says the most a hand pays, and opens its record beside the list, with nothing paid tonight, Log a
 * high hand, and its hands and rules. A second high hand is refused at Submit while this one runs. Kabir ends it from its
 * record. 161 Nisha and 162 Kabir are the flow's own. Local stack only: it ends any high hand a cut-off run left running.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { endHighHands, shoot } from '../support/highHand.ts';
import { signInToConsole } from '../support/signIn.ts';

// Names of this run's own, as each run makes promotions of its own.
const RUN = Date.now().toString(36).slice(-5);
const NAME = `High hand bonus ${RUN}`;
const SECOND = `Second high hand ${RUN}`;

const rowOf = (page: Page, name: string) => page.getByRole('table', { name: 'Promotions' }).getByRole('row').filter({ hasText: name });

/** Starts a promotion from the High hand bonus template, under a name. */
async function startFromTemplate(author: Page, name: string) {
  await author.goto(`${appUrl('console')}/promotions`);
  await author.getByRole('button', { name: 'New promotion' }).click();
  await author.getByRole('radiogroup', { name: 'Start from' }).getByRole('radio', { name: 'High hand bonus' }).click();
  await author.getByRole('textbox', { name: 'Name members see' }).fill(name);
}

/** Simulates the terms on last week, which Submit waits for, and submits them. */
async function simulateAndSubmit(author: Page) {
  await author.getByRole('button', { name: 'Simulate' }).click();
  await expect(author.getByText('members qualified', { exact: true })).toBeVisible({ timeout: 10_000 });
  await author.getByRole('button', { name: 'Submit for approval' }).click();
}

/** Nisha changes the template's hands: any full house added at 1,000, the straight flush removed. */
async function changeHands(author: Page) {
  await expect(author.getByRole('textbox', { name: 'Royal flush' })).toHaveValue('25000');
  await author.getByRole('group', { name: 'Add a hand' }).getByRole('button', { name: 'Any full house' }).click();
  // A hand with no Bonus goes no further.
  await author.getByRole('button', { name: 'Simulate' }).click();
  await expect(author.getByText('Each hand needs its Bonus, in whole 50s.')).toBeVisible();
  await author.getByRole('textbox', { name: 'Any full house' }).fill('1000');
  await author.getByRole('button', { name: 'Remove Straight flush' }).click();
  await expect(author.getByRole('textbox', { name: 'Straight flush' })).toHaveCount(0);
  await expect(author.getByRole('switch', { name: 'Both hole cards must play' })).toBeChecked();
  await expect(author.getByRole('switch', { name: 'Shown at showdown' })).toBeChecked();
  await expect(author.getByRole('textbox', { name: 'Players dealt in, at least' })).toHaveValue('4');
  await expect(author.getByRole('textbox', { name: 'Budget', exact: true })).toHaveValue('200000');
  await expect(author.getByText(/^Royal flush 25,000, Four of a kind 5,000, Any full house 1,000 Bonus, paid each time, for all stakes, every day, all day\./)).toBeVisible();
}

/** Kabir reads the record beside the list: nothing paid tonight, Log a high hand, then its hands and rules. */
async function readRecord(approver: Page) {
  // The row's title opens it: its name, then what it gives.
  await rowOf(approver, NAME).getByRole('button', { name: new RegExp(`^${NAME} `) }).click();
  const record = approver.getByRole('dialog', { name: NAME });
  await expect(record.getByText('No high hand paid tonight.')).toBeVisible();
  await expect(record.getByText('Budget left this month')).toBeVisible();
  await expect(record.getByRole('button', { name: 'Log a high hand' })).toBeVisible();
  await shoot(approver, 'console-record-paid-1440');
  await record.getByRole('radio', { name: 'Hands and rules' }).click();
  await expect(record.getByText('Any full house')).toBeVisible();
  // The straight flush she removed and Aces full, which she never listed.
  await expect(record.getByText('Not paid')).toHaveCount(2);
  await expect(record.getByText('4 or more')).toBeVisible();
  await shoot(approver, 'console-record-hands-and-rules-1440');
  return record;
}

test.describe('High hand promotion', () => {
  test.skip(isRemoteTarget(), 'makes a promotion and ends high hands in the local database, so the local stack only');

  test('built from its template, approved, read on its record, and the only one running', async ({ browser }) => {
    test.setTimeout(180_000);
    endHighHands();
    const author = await browser.newPage();
    await signInToConsole(author, '9000000161');
    await startFromTemplate(author, NAME);
    await changeHands(author);
    await shoot(author, 'console-builder-1440');
    await simulateAndSubmit(author);
    await expect(author.getByText(`${NAME} sent for approval`)).toBeVisible({ timeout: 10_000 });

    const approver = await browser.newPage();
    await signInToConsole(approver, '9000000162', '/promotions');
    await approver.getByRole('button', { name: `Review ${NAME}` }).click();
    await expect(approver.getByText('A new promotion. Nothing runs yet.')).toBeVisible();
    await shoot(approver, 'console-review-1440');
    await approver.getByRole('button', { name: 'Approve' }).click();
    await expect(approver.getByText(`${NAME} is live`)).toBeVisible({ timeout: 10_000 });
    await expect(rowOf(approver, NAME)).toContainText('Up to 25,000 Bonus a hand');
    await expect(rowOf(approver, NAME)).toContainText('Live');
    await shoot(approver, 'console-list-1440');
    const record = await readRecord(approver);

    // One runs in a venue: a second is refused at Submit.
    await startFromTemplate(author, SECOND);
    await simulateAndSubmit(author);
    await expect(author.getByText('Another high hand promotion is running. End it first.')).toBeVisible({ timeout: 10_000 });

    // Ended from its record, so no other flow meets it.
    await record.getByRole('button', { name: `End ${NAME}` }).click();
    await record.getByRole('button', { name: `Yes, end ${NAME}` }).click();
    await expect(approver.getByText(`${NAME} ended`)).toBeVisible({ timeout: 10_000 });
  });
});
