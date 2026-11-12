/**
 * The club's numbers are a setting (the owner, 12 Nov; decision 0582). A super admin (Rhea Kapur, this flow's own sign-in:
 * Auth sends one code a minute to a number) changes the WhatsApp number under Settings, Club details; the website's top bar
 * and the player app's way to the desk use it at once. The flow changes only the WhatsApp number, as website-pages reads the
 * number to call, and puts it back at the end.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CLUB_WHATSAPP = '+918796580435';

/** Saves `whatsapp` as the club's WhatsApp number on Settings, Club details. */
async function setWhatsapp(page: Page, whatsapp: string) {
  await page.goto(`${appUrl('console')}/settings?tab=club`);
  const field = page.getByRole('textbox', { name: 'WhatsApp number', exact: true });
  await field.fill(whatsapp);
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('Configuration saved.')).toBeVisible();
}

test.describe('the club contact', () => {
  test('a super admin sets the WhatsApp number, and the website and the app use it', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'changes the club\'s numbers, so the local stack only');
    const staff = await browser.newPage();
    await signInToConsole(staff, '9000000182');
    try {
      await setWhatsapp(staff, '98111 00022');
      const site = await browser.newPage();
      await site.goto(`${appUrl('web')}/`);
      const contacts = site.getByRole('list', { name: 'Contact' });
      await expect(contacts.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/919811100022');
      await expect(contacts.getByRole('link', { name: '+91 87965 80435' })).toHaveAttribute('href', 'tel:+918796580435');

      // Signed out, the app's first step ends with the way to the desk.
      const app = await browser.newPage();
      await app.goto(`${appUrl('player')}/sign-in`);
      const desk = app.getByRole('group', { name: 'Front desk' });
      await expect(desk.getByRole('link', { name: 'WhatsApp the desk' })).toHaveAttribute('href', 'https://wa.me/919811100022');
      await expect(desk.getByRole('link', { name: 'Call the desk' })).toHaveAttribute('href', 'tel:+918796580435');
    } finally {
      await setWhatsapp(staff, CLUB_WHATSAPP);
    }
  });
});
