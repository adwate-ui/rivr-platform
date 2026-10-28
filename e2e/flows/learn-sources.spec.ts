/**
 * Learn sources (#131; decision 0016). Isha Kapoor, this flow's own super admin, chooses an encoding: the drill
 * engine's validator and all eight gates run on it in the console, it passes, and with its licence it is uploaded and
 * listed. A broken file is refused before anything is uploaded. Licence expiry and the feature key are proved in
 * supabase/tests/179_learn_sources.test.sql.
 */
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

const EXAMPLE = join(import.meta.dirname, '..', '..', 'packages', 'drills', 'fixtures', 'example-encoding.json');
const nextYear = () => `${String(new Date().getFullYear() + 1)}-03-31`;

test.describe('Learn sources', () => {
  test('Learn sources: a super admin uploads an encoding that passes the validator and the gates', async ({ page }) => {
    await signInToConsole(page, '9000000629');
    await page.getByRole('link', { name: 'Learn sources' }).click();
    const file = page.locator('input[type="file"]');
    await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"not": "an encoding"}') });
    await expect(page.getByText('Refused by: validator.')).toBeVisible({ timeout: 20_000 });

    await file.setInputFiles(EXAMPLE);
    await expect(page.getByText(/passed the validator and all eight gates\.$/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Licence ends on').fill(nextYear());
    await page.getByRole('textbox', { name: 'Licence terms' }).fill('Licensed to the club for its members');
    await page.getByRole('button', { name: 'Upload source' }).click();
    await expect(page.getByText(/is added\. Members have it until /)).toBeVisible();
    await expect(page.getByRole('table', { name: 'Learn sources' }).getByRole('cell', { name: 'On', exact: true })).toBeVisible();
  });
});
