/** Signing a seeded person in, as a person does: number, then code. Members to the player app, staff to the console. */
import { expect, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from './apps.ts';

/** The code seeded test numbers take: the local stack's, or staging's private one in a release. */
export const SIGN_IN_CODE = isRemoteTarget() ? (process.env.E2E_SIGN_IN_CODE ?? '') : '123456';

/**
 * Signs a seeded member in on a phone-sized screen. Opened at `path` signed out, the app asks for
 * sign-in and returns there; from sign-in itself it waits for Tonight.
 */
export async function signInToPlayer(page: Page, number: string, path = '/sign-in') {
  if (SIGN_IN_CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the flow cannot sign in on staging');
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}${path}`);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByRole('textbox', { name: /^Code sent to/ }).fill(SIGN_IN_CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  if (path === '/sign-in') await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
  else await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/** Signs someone in to the console at 1440 px; what they land on is the caller's to check. */
export async function signInToConsole(page: Page, number: string) {
  if (SIGN_IN_CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the flow cannot sign in on staging');
  await page.setViewportSize(VIEWPORT.console);
  await page.goto(appUrl('console'));
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByRole('textbox', { name: /^Code sent to/ }).fill(SIGN_IN_CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
}
