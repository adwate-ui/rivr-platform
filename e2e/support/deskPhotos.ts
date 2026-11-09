import type { Page } from '@playwright/test';

/**
 * The three photos of a check in person, with the browser's fake camera (playwright.config.ts): the face, then the PAN and the
 * Aadhaar front, each camera opening once the last photo is kept. The Aadhaar's bars are left where they fall and confirmed.
 */
export async function takeDeskPhotos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Take their photo' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Use photo' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('button', { name: 'Use photo' }).click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await page.getByRole('switch', { name: /^The bars hide/ }).click();
  await page.getByRole('button', { name: 'Use photo' }).click();
}
