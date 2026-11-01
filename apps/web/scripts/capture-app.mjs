/**
 * The website's picture of the app (UI polish audit AS-03): today's Home as a seeded member sees it, on a 390 by 844 phone
 * at three times (1170 by 2532), saved as public/media/app-home.webp. Run it after any change to Home, against the
 * freshly seeded local stack with the player app served (`pnpm --filter player preview`): `pnpm --filter web capture:app`.
 */
import { chromium } from '@playwright/test';
import { appPort } from '@rivr/config/worktree';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** Ishaan Verma: a member who has finished the identity check and is not seated, so Home shows tonight's tables. */
const MEMBER = '9000000211';
/** The code seeded numbers take on a local stack (supabase/config.template.toml). */
const CODE = '123456';
const player = `http://127.0.0.1:${appPort('player')}`;
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/media/app-home.webp');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  await page.goto(`${player}/sign-in`);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(MEMBER);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByRole('textbox', { name: /^Code sent to/ }).fill(CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByRole('heading', { name: 'Tonight' }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await sharp(await page.screenshot()).webp({ quality: 82 }).toFile(out);
} finally {
  await browser.close();
}
