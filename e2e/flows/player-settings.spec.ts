/**
 * Player settings (#637; decision 0320). Naveen Iyer, this flow's own member, opens Profile: no Learn or Events row and no
 * Academy, as they are off for every tier; House rules shows the club's rules and the legal standing from its website.
 * From Send feedback, Naveen sends a quick note about the dealer, then the detailed form: the gameplay, cashier, service and ambience rated,
 * and 9 for how likely they are to recommend the club. Farhan Siddiqui, this flow's own admin, reads both on Feedback
 * with their answers. The forms' rules are proved in supabase/tests/203_feedback_forms.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Player settings', () => {
  test('Profile › House rules, Feedback: no Learn, Events or Academy, and feedback in two forms that the General Manager reads', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'sends feedback, so the local stack only');
    test.setTimeout(90_000);
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000254', '/profile');
    await expect(member.getByRole('heading', { name: 'Naveen Iyer', level: 1 })).toBeVisible();
    await expect(member.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    // Learn and Events are rows under Club only for a tier with them (decision 0322): off for every tier.
    for (const row of ['Learn', 'Events']) await expect(member.getByRole('button', { name: row, exact: true })).toHaveCount(0);
    await expect(member.getByRole('heading', { name: 'RIVR Academy' })).toHaveCount(0);

    // Profile › House rules: the club's rules numbered in gold, then the legal standing, from its website.
    await member.getByRole('button', { name: 'House rules' }).click();
    await expect(member.getByRole('heading', { name: 'House rules', level: 1 })).toBeVisible();
    await expect(member.getByText(/^Members only, 18 and over\./)).toBeVisible();
    await expect(member.getByText('K.R. Lakshmanan v. State of Tamil Nadu')).toBeVisible();
    await member.getByRole('button', { name: 'Profile' }).click();

    // Profile › Feedback: the quick note in a sheet, then the detailed form a tab away.
    const run = String(Date.now() % 100_000).padStart(5, '0');
    await member.getByRole('button', { name: 'Send feedback' }).click();
    let sheet = member.getByRole('dialog', { name: 'Send feedback' });
    await sheet.getByRole('radiogroup', { name: 'Topic' }).getByRole('radio', { name: 'Dealer' }).click();
    await sheet.getByRole('textbox', { name: 'What happened?' }).fill(`Quick and fair at Table 3, run ${run}`);
    await sheet.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(member.getByText('Feedback sent')).toBeVisible();
    await expect(sheet).toHaveCount(0);

    await member.getByRole('button', { name: 'Send feedback' }).click();
    sheet = member.getByRole('dialog', { name: 'Send feedback' });
    await sheet.getByRole('button', { name: 'Detailed feedback' }).click();
    const rate = async (group: string, score: string) => sheet.getByRole('radiogroup', { name: group }).getByRole('radio', { name: score, exact: true }).click();
    await rate('The gameplay, 1 to 5', '5');
    await rate('The cashier, 1 to 5', '3');
    await rate('The service, 1 to 5', '4');
    await rate('The ambience, 1 to 5', '5');
    await rate('How likely are you to recommend RIVR to a friend, 0 to 10?', '9');
    await sheet.getByRole('textbox', { name: 'Anything else you would like to tell us? (optional)' }).fill(`More PLO, run ${run}`);
    await sheet.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(member.getByText('Feedback sent')).toBeVisible();

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
