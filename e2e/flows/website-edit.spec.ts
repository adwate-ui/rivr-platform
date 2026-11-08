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
    // The website is Content's first tab, its pages listed beside the editor (console v3).
    await page.getByRole('link', { name: 'Content', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Website', level: 2 })).toBeVisible();
    await page.getByRole('region', { name: 'Pages' }).getByRole('button', { name: 'House rules', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'House rules', level: 2 })).toBeVisible();
    // Going back up the page by keyboard, each field stops clear of the bar that stays at the top (WCAG 2.4.11).
    await page.getByRole('main').getByRole('textbox').last().focus();
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Shift+Tab');
      await expect.poll(() => page.getByRole('button', { name: 'Save draft' }).evaluate((save) => {
        const focused = document.activeElement;
        const bar = save.closest('.sticky');
        return focused === null || bar === null ? 'no field or bar' : bar.contains(focused) || focused.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom;
      })).toBe(true);
    }
    const field = page.getByRole('textbox', { name: 'Heading' }).first();
    const original = await field.inputValue();
    await field.fill(heading);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved.')).toBeVisible();
    await page.getByRole('radio', { name: 'Preview' }).click();
    await expect(page.frameLocator('iframe[title="Preview of House rules"]').getByRole('heading', { name: heading })).toBeVisible();

    await page.getByRole('button', { name: 'Publish now' }).click();
    await expect(page.getByText('Published.')).toBeVisible();
    const site = await browser.newPage();
    await site.goto(`${appUrl('web')}/house-rules`);
    await expect(site.getByRole('heading', { name: heading })).toBeVisible();

    await page.getByRole('button', { name: /^Publish the version of / }).first().click();
    // Asked twice, as it goes live at once (F2-21).
    await page.getByRole('button', { name: 'Yes, publish it now' }).click();
    await expect(page.getByText('That version is published again.')).toBeVisible();
    await site.reload();
    await expect(site.getByRole('heading', { name: original })).toBeVisible();
  });
});
