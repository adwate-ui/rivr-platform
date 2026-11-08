/** Signing a seeded person in, as a person does: number, then code. Members to the player app, staff to the console. */
import { expect, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from './apps.ts';

/** The code seeded test numbers take: the local stack's, or staging's private one in a release. */
export const SIGN_IN_CODE = isRemoteTarget() ? (process.env.E2E_SIGN_IN_CODE ?? '') : '123456';

/**
 * Signs a seeded member in on a phone-sized screen. Opened at `path` signed out, the app asks for
 * sign-in and returns there; from sign-in itself it waits for Home.
 */
export async function signInToPlayer(page: Page, number: string, path = '/sign-in') {
  if (SIGN_IN_CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the flow cannot sign in on staging');
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}${path}`);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
  // Six digits in, the code goes on by itself (S-01), in the redesign's code cells (decision 0320).
  await page.getByRole('textbox', { name: '6-digit code' }).fill(SIGN_IN_CODE);
  if (path === '/sign-in') await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  else await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/**
 * Signs someone in to the console at 1440 px and waits until the code is checked and the console opens: a navigation
 * while the code is checked cancels the check ("context canceled" in Auth's logs), and the console opens signed out.
 * With `path`, it then opens that screen by its address (e2e/support/console.ts, decision 0476). What they land on is
 * the caller's to check.
 */
export async function signInToConsole(page: Page, number: string, path?: string) {
  if (SIGN_IN_CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the flow cannot sign in on staging');
  await page.setViewportSize(VIEWPORT.console);
  await page.goto(appUrl('console'));
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
  // Six digits in, the code goes on by itself (S-01).
  await page.getByRole('textbox', { name: /^Code sent to/ }).fill(SIGN_IN_CODE);
  await expect(page.getByRole('textbox', { name: /^Code sent to/ })).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole('textbox', { name: 'Mobile number' })).toHaveCount(0);
  if (path !== undefined) await page.goto(`${appUrl('console')}${path}`);
}
