/**
 * Player settings (#637). Naveen Iyer, this flow's own member, opens Profile: no Learn tab, no Events and no
 * Academy, as they are off for every tier; House rules shows the club's rules and the legal standing from its website.
 * Naveen sends a quick note about the dealer, then the detailed form: the gameplay, cashier, service and ambience rated,
 * and 9 for how likely they are to recommend the club. Farhan Siddiqui, this flow's own admin, reads both on Feedback
 * with their answers. The forms' rules are proved in supabase/tests/203_feedback_forms.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Player settings', () => {
  test('house rules, no Learn, Events or Academy, and feedback in two forms that the General Manager reads', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'sends feedback, so the local stack only');
    test.setTimeout(90_000);
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000254', '/profile');
    await expect(member.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(member.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learn' })).toHaveCount(0);
    for (const heading of ['Events', 'RIVR Academy']) await expect(member.getByRole('heading', { name: heading })).toHaveCount(0);

    await member.getByRole('button', { name: 'Read the house rules' }).click();
    await expect(member.getByRole('heading', { name: 'House rules', level: 1 })).toBeVisible();
    await expect(member.getByText(/^1\. Members only, 18 and over\./)).toBeVisible();
    await expect(member.getByText('1996 · K.R. Lakshmanan v. State of Tamil Nadu')).toBeVisible();
    await member.getByRole('button', { name: 'Back' }).click();

    const run = String(Date.now() % 100_000).padStart(5, '0');
    await member.getByRole('group', { name: 'What is it about?' }).getByRole('button', { name: 'Dealer' }).click();
    await member.getByRole('textbox', { name: 'Your note' }).fill(`Quick and fair at Table 3, run ${run}`);
    await member.getByRole('button', { name: 'Send' }).click();
    await expect(member.getByText('Sent. Thank you.')).toBeVisible();

    await member.getByRole('group', { name: 'How would you like to tell us?' }).getByRole('button', { name: 'Detailed feedback' }).click();
    const rate = async (group: string, score: string) => member.getByRole('group', { name: group }).getByRole('button', { name: score, exact: true }).click();
    await rate('The gameplay, 1 to 5', '5');
    await rate('The cashier, 1 to 5', '3');
    await rate('The service, 1 to 5', '4');
    await rate('The ambience, 1 to 5', '5');
    await rate('How likely are you to recommend RIVR to a friend, 0 to 10?', '9');
    await member.getByRole('textbox', { name: 'Anything else you would like to tell us? (optional)' }).fill(`More PLO, run ${run}`);
    await member.getByRole('button', { name: 'Send' }).click();
    await expect(member.getByText('Sent. Thank you.')).toBeVisible();

    const manager = await browser.newPage();
    await signInToConsole(manager, '9000000115');
    await manager.getByRole('link', { name: 'Feedback' }).click();
    await expect(manager.getByText(`Quick and fair at Table 3, run ${run}`)).toBeVisible();
    await expect(manager.getByText(/^Naveen Iyer · No\. \d+ · a quick note on Dealer · /).first()).toBeVisible();
    await expect(manager.getByText(`More PLO, run ${run}`)).toBeVisible();
    await expect(manager.getByText(/^Naveen Iyer · No\. \d+ · detailed feedback, would recommend 9 of 10 · /).first()).toBeVisible();
    await expect(manager.getByText('Gameplay 5 · Cashier 3 · Service 4 · Ambience 5').first()).toBeVisible();
  });
});
