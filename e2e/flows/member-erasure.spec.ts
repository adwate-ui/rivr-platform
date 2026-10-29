/**
 * Member erasure (#424; decision 0207). Nisha Bhatt, this flow's own super admin (Auth sends one code a minute to a
 * number), erases Neel Kapur at the practice venue on his request. His record shows the 500 points he will forfeit
 * and nothing left to clear; a name not typed exactly is refused; typed exactly, with a reason, his personal data is
 * erased, his KYC selfie leaves Storage, and the record keeps only his member number. Local stack only: it uploads
 * the selfie with the service role. What is deleted, kept, blocked and audited, that the practice seed is taken
 * again and that nothing is sent out, is proved in supabase/tests/131_member_erasure.test.sql.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { localBinary, localSupabaseEnv, worktreeRoot } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const FOLDER = '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-0000000d0758/';
// A one-pixel PNG, as the KYC images flow uploads.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function asServer(): Record<string, string> {
  const root = worktreeRoot();
  const status: unknown = JSON.parse(execFileSync(localBinary('supabase', root), ['status', '-o', 'json'], { cwd: root, encoding: 'utf8' }));
  const key: unknown = typeof status === 'object' && status !== null ? Reflect.get(status, 'SERVICE_ROLE_KEY') : undefined;
  if (typeof key !== 'string') throw new Error('The local stack is not running');
  return { apikey: key, authorization: `Bearer ${key}` };
}

test.describe('Member erasure', () => {
  test('a super admin erases a practice member on request, typing his name and a reason', async ({ page, request }) => {
    test.skip(isRemoteTarget(), 'erases a member and uploads with the service role, so the local stack only');
    const { url } = localSupabaseEnv();
    const server = asServer();
    await request.post(`${url}/storage/v1/object/kyc/${FOLDER}selfie.png`, { headers: { ...server, 'content-type': 'image/png', 'x-upsert': 'true' }, data: PNG });

    await signInToConsole(page, '9000000757');
    const rail = page.getByRole('complementary');
    await rail.getByRole('switch', { name: 'Practice venue' }).click();
    await expect(rail.getByText('RIVR Practice')).toBeVisible();
    await page.getByRole('link', { name: 'Members' }).click();
    await page.getByRole('searchbox', { name: 'Find a member' }).fill('Neel');
    await page.getByRole('button', { name: 'Open Neel Kapur' }).click();

    await expect(page.getByRole('heading', { name: 'Erasure on request' })).toBeVisible();
    await expect(page.getByText('Forfeited to the club: 500 points and 0 bonus chips.')).toBeVisible();
    const name = page.getByRole('textbox', { name: 'Type the member\'s full name to confirm' });
    const erase = page.getByRole('button', { name: 'Erase personal data' });
    await name.fill('Neel');
    await page.getByRole('textbox', { name: 'Why the member is erased' }).fill('Asked at the desk on 26 Oct');
    await erase.click();
    await expect(page.getByText('Type the member\'s full name exactly as the record shows it.')).toBeVisible();

    await name.fill('Neel Kapur');
    await erase.click();
    await expect(page.getByText('Erased. Forfeited 500 points and 0 bonus chips; KYC files removed: 1.')).toBeVisible();
    await expect(page.getByText('This member\'s personal data was erased on request.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Erased member' })).toBeVisible();
    const left = await request.post(`${url}/storage/v1/object/list/kyc`, { headers: server, data: { prefix: FOLDER, limit: 10, offset: 0 } });
    expect(await left.json()).toEqual([]);
  });
});
