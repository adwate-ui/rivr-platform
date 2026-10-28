// Academy lessons (#134): a member reads a lesson's cards in a book that ships with RIVR, answers its quiz, and the
// lesson is kept as done.
import { expect, test } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

/** The count in "Card 1 of 6" or "Question 1 of 5". */
const countIn = (text: string | null) => Number(/ of (\d+)$/.exec(text ?? '')?.[1] ?? '0');

test('Academy lessons: a member reads a lesson, answers its quiz, and the lesson is kept as done', async ({ page }) => {
  await signInToPlayer(page, '9000000641');
  await page.goto(`${appUrl('player')}/learn`);
  await page.getByRole('button', { name: "How To Read Hands At No-Limit Hold'em" }).click();
  await page.getByRole('button', { name: 'Lessons' }).click();
  await page.getByRole('button', { name: 'Hand Reading On The Flop' }).click();

  const cards = countIn(await page.getByText(/^Card 1 of \d+$/).textContent());
  expect(cards).toBeGreaterThan(1);
  for (let card = 1; card < cards; card += 1) await page.getByRole('button', { name: 'Next card' }).click();
  await page.getByRole('button', { name: 'Start the quiz' }).click();

  const questions = countIn(await page.getByRole('heading', { name: /^Question 1 of \d+$/ }).textContent());
  expect(questions).toBeGreaterThan(0);
  for (let question = 1; question <= questions; question += 1) {
    await page.getByRole('button', { name: 'Strong fit' }).click();
    await page.getByRole('button', { name: question === questions ? 'See how you did' : 'Next question' }).click();
  }
  await expect(page.getByText(new RegExp(`^\\d+ of ${String(questions)} right\\.$`))).toBeVisible();

  await page.getByRole('button', { name: 'Back to the lessons' }).click();
  await expect(page.getByText(new RegExp(`^Done: \\d+ of ${String(questions)} right$`))).toBeVisible();
});
