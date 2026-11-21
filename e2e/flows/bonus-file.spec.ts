/**
 * Bonus from a file (the owner, 22 Nov; decision 0707): Kiara Sethi, a super admin who signs in to no other flow, chooses a
 * CSV on Members naming Aarav Joshi by his member number and Kiara Shah by her mobile. Each is added Bonus and uses it on
 * the next line, neither checked in. The preview names them, Save asks twice, and every line goes; their records show the
 * use with its reason. Each run adds and uses the same Bonus, so what they hold is as it was. The checks read the local
 * database, so the local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const AARAV = '00000000-0000-4000-8000-000000000250';
const KIARA_SHAH = '00000000-0000-4000-8000-000000000251';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** This run's own reason, so an earlier run's lines never pass for its own. */
const REASON = `Food on the night ${Date.now().toString(36).slice(-5)}`;

test.describe('Bonus from a file', () => {
  test.skip(isRemoteTarget(), 'reads the local database to check what the file did, so the local stack only');

  test('a super admin adds and uses Bonus for two members from one CSV, every line or none', async ({ page }) => {
    const number = sql(`select member_number from public.member where id = '${AARAV}'`);
    const held = () => sql(`select private.bonus_in_force('${AARAV}', now()) || ' ' || private.bonus_in_force('${KIARA_SHAH}', now())`);
    const before = held();

    await signInToConsole(page, '9000000199', '/members');
    await page.getByRole('button', { name: 'Bonus from a file' }).click();
    const sheet = page.getByRole('dialog', { name: 'Bonus from a file' });
    // Her mobile written two ways, as staff type it.
    const csv = ['Member,Type,Chips,Reason', `${number},Add,500,${REASON}`, `${number},Use,500,${REASON}`, `90000 00251,add,"1,000",${REASON}`,
      `+919000000251,use,1000,${REASON}`].join('\r\n');
    await sheet.locator('input[type="file"]').setInputFiles({ name: 'bonus.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

    // Every line with its member, and the totals; nothing sent yet.
    await expect(sheet.getByText(`Line 2 · Aarav Joshi · No. ${number} · Add 500 · ${REASON}`)).toBeVisible();
    await expect(sheet.getByText(`Line 3 · Aarav Joshi · No. ${number} · Use 500 · ${REASON}`)).toBeVisible();
    await expect(sheet.getByText(new RegExp(`^Line 5 · Kiara Shah · No\\. \\d+ · Use 1,000 · ${REASON}$`))).toBeVisible();
    await expect(sheet.getByText('4 lines · 1,500 added · 1,500 used')).toBeVisible();
    expect(sql(`select count(*) from public.bonus_redemption where reason = '${REASON}'`)).toBe('0');

    await sheet.getByRole('button', { name: 'Save every line' }).click();
    await sheet.getByRole('button', { name: 'Yes, save 4 lines' }).click();
    await expect(sheet.getByText('4 lines saved.')).toBeVisible();
    expect(sql(`select count(*) from public.bonus_grant where reason = '${REASON}' and idempotency_key like 'bonus.hand:file:%'`)).toBe('2');
    expect(sql(`select count(*) from public.bonus_redemption where reason = '${REASON}' and visit_id is null and session_id is null`)).toBe('2');
    expect(held()).toBe(before);

    // Aarav's record shows the use, with its reason and who saved the file.
    await page.goto(`${appUrl('console')}/members?member=${AARAV}&part=bonus`);
    await expect(page.getByText(new RegExp(`Used · ${REASON} · by Kiara Sethi$`))).toBeVisible();
  });
});
