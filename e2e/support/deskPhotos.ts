import type { Page } from '@playwright/test';

/**
 * The three photos of a check in person (redesign RD-21), with the browser's fake camera (playwright.config.ts): from the
 * Member step, Start the check, then the face, the PAN and the Aadhaar front, "Use photo" moving on each time to the next
 * step and at last to Details. The Aadhaar's bars are left where they fall and confirmed.
 */
export async function takeDeskPhotos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start the check' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Use photo' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Use photo' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('switch', { name: /^The bars hide/ }).click();
  await page.getByRole('button', { name: 'Use photo' }).click();
}
