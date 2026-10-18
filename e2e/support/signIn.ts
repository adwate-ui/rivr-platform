/** Signing a seeded member in to the player app, as a person does: number, code, Tonight. */
import { expect, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from './apps.ts';

/** The code seeded test numbers take: the local stack's, or staging's private one in a release. */
export const SIGN_IN_CODE = isRemoteTarget() ? (process.env.E2E_SIGN_IN_CODE ?? '') : '123456';

/** Signs a seeded member in on a phone-sized screen and waits for Tonight. */
export async function signInToPlayer(page: Page, number: string) {
  if (SIGN_IN_CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the flow cannot sign in on staging');
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}/sign-in`);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByRole('textbox', { name: /^Code sent to/ }).fill(SIGN_IN_CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
}
