/**
 * Website editing, additions flow 17 (#129; decision 0270). Sara Iqbal, this flow's own marketing manager, changes House
 * rules' heading in place, saves the draft and sees it in the preview, publishes it and finds it on the website at once,
 * then publishes the page's earlier version again from its history, so the website is as it was. Scheduled publishing
 * and the refusals are proved in supabase/tests/187_site_editor.test.sql.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Website edit', () => {
  test('marketing edits a page, previews it, publishes it and rolls it back', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'edits the club\u2019s website, so the local stack only');
    test.setTimeout(60_000);
    const heading = `House rules ${String(Date.now()).slice(-6)}`;
    await signInToConsole(page, '9000000637');
    await page.getByRole('link', { name: 'Website' }).click();
    await page.getByRole('group', { name: 'Page' }).getByRole('button', { name: 'House rules', exact: true }).click();
    const field = page.getByRole('textbox', { name: 'Heading' }).first();
    const original = await field.inputValue();
    await field.fill(heading);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved. The preview shows it as the website will.')).toBeVisible();
    await expect(page.frameLocator('iframe[title="Preview of House rules"]').getByRole('heading', { name: heading })).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(page.getByText('Published. The website shows it now.')).toBeVisible();
    const site = await browser.newPage();
    await site.goto(`${appUrl('web')}/house-rules`);
    await expect(site.getByRole('heading', { name: heading })).toBeVisible();

    await page.getByRole('button', { name: /^Publish the version of / }).first().click();
    await expect(page.getByText('That version is published again.')).toBeVisible();
    await site.reload();
    await expect(site.getByRole('heading', { name: original })).toBeVisible();
  });
});
