/**
 * The staging journeys (design 3d): one club night end to end on staging's own apps, as RIVR's people work it.
 * 1. The super admin frees the test numbers in SIM_ERASE_NUMBERS by erasing their seed members (the owner: "delete a few
 *    seed numbers from the app so that they are available for testing").
 * 2. They add Sim 180 Staff, a floor manager in the Floor role, on SIM_STAFF_NUMBER.
 * 3. A new member signs up on SIM_MEMBER_NUMBER on a phone and takes the selfie while the club checks identity at the desk.
 * 4. The floor opens a table if none is open; the member asks to join its list; the floor approves, checks ID, seats them.
 * 5. During play the member orders to the seat and asks for an hour more and a top-up, which the floor works.
 * 6. The floor lets them go early, the desk checks them out, and they rate the night.
 * 7. Sim 180 Staff, in each role of SIM_ROLES, opens every screen its rail shows, at 1440 and at 390 px.
 * 8. Sim 180 Staff is turned off and the member erased; afterAll does the same when a step failed before step 8.
 * Selectors and steps are copied from the e2e flows (e2e/flows) and cited where used. Every step screenshots; checks
 * that should not stop the journey are soft, so a step goes on past them. Playwright still marks that step failed, and
 * serial mode then skips the steps after it; afterAll cleans up either way. A table the walk opens stays open.
 * Run only by hand through `pnpm staging:walk` (bin/staging-walk.ts with staging/playwright.config.ts), never in CI.
 * Preconditions: WHATSAPP_ALLOWLIST on staging holds only the owner's number, so nothing reaches a test number's
 * phone, and the preflight (staging/preflight.ts) passes. Env: SIM_SUPER_NUMBER, SIM_STAFF_NUMBER, SIM_MEMBER_NUMBER,
 * SIM_ERASE_NUMBERS (comma-separated), SIM_ROLES, and staging:walk's own E2E_* variables.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { appUrl, VIEWPORT } from '../../../e2e/support/apps.ts';
import { openConsole, openFromRail } from '../../../e2e/support/console.ts';
import { letGoEarly, requestsPanel } from '../../../e2e/support/floor.ts';
import { SIGN_IN_CODE, signInToConsole } from '../../../e2e/support/signIn.ts';
// Presses buttons by their exact names, one after another.
import { press } from '../../../e2e/support/tablet.ts';

const env = (name: string, fallback = ''): string => process.env[name] ?? fallback;
const [SUPER, STAFF_NUMBER, MEMBER_NUMBER] = [env('SIM_SUPER_NUMBER', '9000000101'), env('SIM_STAFF_NUMBER'), env('SIM_MEMBER_NUMBER')];
const ERASE = env('SIM_ERASE_NUMBERS').split(',').map((number) => number.trim()).filter((number) => /^\d{10}$/.test(number));
const ROLES = env('SIM_ROLES', 'host,admin,marketing,service,owner_view,cashier').split(',').map((role) => role.trim()).filter((role) => role !== '');
const [STAFF, TITLE] = ['Sim 180 Staff', 'Floor manager'];
// Sign-up takes a name in letters only (apps/player/src/features/sign-up/components/SignUpScreen.tsx:17 and the sign_up
// function's check), so the member's "Sim 180" is spelt out.
const MEMBER = 'Sim One Eighty Member';
// The roles as the Staff screen names them (packages/i18n/src/catalogue/en/staff.ts, roles).
const ROLE_LABEL: Readonly<Record<string, string>> = { admin: 'Admin', floor: 'Floor', cashier: 'Cashier', dealer: 'Dealer', marketing: 'Marketing', host: 'Host', owner_view: 'Owner, view only', service: 'F&B' };
// The member's screens and their addresses: the four tabs, then Profile, the initial at the top (player-shell.spec.ts:24-31).
const MEMBER_SCREENS: readonly (readonly [string, RegExp])[] = [['Home', /\/$/], ['Rewards', /\/rewards$/], ['Card', /\/card$/], ['Sessions', /\/sessions$/], ['Profile', /\/profile$/]];
const SLOW = { timeout: 20_000 };
let admin: Page, floor: Page, member: Page;
const night = { table: '', seat: '', atClub: false, staffOn: false, memberJoined: false };

/** A full-page screenshot in the step's own output folder, after a soft check that `after` shows when one is given. */
async function shot(page: Page, name: string, after?: Locator): Promise<void> {
  if (after !== undefined) await expect.soft(after.first()).toBeVisible(SLOW);
  await page.screenshot({ path: test.info().outputPath(`${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`), fullPage: true });
}

/** Whether the locator shows within the wait. */
const seen = (locator: Locator, timeout = 10_000): Promise<boolean> => locator.first().waitFor({ timeout }).then(() => true, () => false);

/** Whether the locator shows; a soft failure naming `what` when it does not, and the journey goes on. */
const present = (locator: Locator, what: string, timeout = 10_000): Promise<boolean> => seen(locator, timeout).then((shown) => {
  expect.soft(shown, what).toBe(true);
  return shown;
});

/** Fills textboxes found by their exact names. */
async function fill(page: Page, fields: Readonly<Record<string, string>>): Promise<void> {
  for (const [name, value] of Object.entries(fields)) await page.getByRole('textbox', { name, exact: true }).fill(value);
}

/** The member's request in the floor's panel that says `kind`, once it arrives (floor-requests.spec.ts:15-19). */
function requestOf(kind: RegExp): Promise<Locator> {
  const entry = requestsPanel(floor).locator('div').filter({ has: floor.getByRole('button', { name: MEMBER, exact: true }) }).filter({ hasText: kind }).last();
  return expect(entry).toBeVisible({ timeout: 30_000 }).then(() => entry);
}

/** One of sign-up's pickers and its choices; a picker of many closes on Done (attribution.spec.ts:44-55). */
async function pick(picker: string, choices: readonly string[]): Promise<void> {
  await member.getByRole('button', { name: new RegExp(`^${picker}`) }).click();
  for (const choice of choices) await member.getByRole('dialog', { name: picker }).getByRole('button', { name: choice, exact: true }).click();
  if (choices.length > 1) await member.getByRole('dialog', { name: picker }).getByRole('button', { name: 'Done' }).click();
}

/** Erases the member with this mobile from their record's Account tab (member-erasure.spec.ts:40-57); false when none has it. */
async function eraseByNumber(number: string, reason: string): Promise<boolean> {
  await openConsole(admin, '/members');
  await admin.getByRole('searchbox', { name: 'Name, member no. or mobile' }).fill(number);
  // The first row's title button, which opens the record (packages/ui DataTable); a super admin's search finds a mobile.
  const row = admin.getByRole('table', { name: 'Members' }).getByRole('row').nth(1).getByRole('button').first();
  await expect(row.or(admin.getByText(/^Nothing matches /))).toBeVisible(SLOW);
  if (!(await row.isVisible())) return false;
  const fullName = (await row.innerText()).trim();
  await row.click();
  await admin.getByRole('link', { name: 'Account', exact: true }).click();
  await fill(admin, { 'Type the member\'s full name to confirm': fullName, 'Why the member is erased': reason });
  const erase = admin.getByRole('button', { name: 'Erase personal data' });
  // Disabled while the record lists what to clear first (EraseMember.tsx:59).
  await expect.soft(erase, `nothing blocks erasing ${fullName}`).toBeEnabled();
  if (await erase.isEnabled()) await erase.click();
  await shot(admin, `erased-${number}`, admin.getByText(/^Erased\. Forfeited /));
  return true;
}

/** Sim 180 Staff's row open on Change, and `control` (a role or Active) set to `wanted`, asked first (staff.spec.ts:43-57). */
async function changeStaff(control: Locator, wanted: string, confirm: string, name: string): Promise<void> {
  await openConsole(admin, '/staff');
  await admin.getByRole('searchbox', { name: 'Find staff' }).fill(STAFF);
  await press(admin, [STAFF, `Change ${STAFF}`]);
  if ((await control.getAttribute('aria-checked')) !== wanted) await control.click().then(() => press(admin, [confirm]));
  await expect.soft(control).toHaveAttribute('aria-checked', wanted);
  await shot(admin, name);
}

/** Gives Sim 180 Staff a role on its row (StaffRow.test.tsx:42-49). */
const setRole = (role: string): Promise<void> => changeStaff(roleChoice(role), 'true', 'Yes, change it', `role-${role}`);
const roleChoice = (role: string): Locator => admin.getByRole('radiogroup', { name: `Role for ${STAFF}` }).getByRole('radio', { name: ROLE_LABEL[role] ?? role, exact: true });

/** Adds Sim 180 Staff as staff.spec.ts:33-42 does, in the Floor role; a row a run before turned off is restored instead. */
async function addStaff(): Promise<void> {
  await openConsole(admin, '/staff');
  await press(admin, ['Add staff']);
  await fill(admin, { 'Full name': STAFF, 'Job title': TITLE, 'Mobile number': STAFF_NUMBER });
  await admin.getByRole('radiogroup', { name: 'Role', exact: true }).getByRole('radio', { name: 'Floor', exact: true }).click();
  await press(admin, ['Add staff member']);
  const added = admin.getByText(`${STAFF} is added.`);
  await expect(added.or(admin.getByText('Already on the staff list. Turn their row back on below.')).first()).toBeVisible(SLOW);
  night.staffOn = true;
  if (!(await added.isVisible())) {
    // Restore, asked first, on Removed staff (StaffTable.tsx:57-60).
    await admin.getByRole('link', { name: 'Removed staff' }).click();
    await admin.getByRole('searchbox', { name: 'Find staff' }).fill(STAFF);
    if (await seen(admin.getByRole('button', { name: `Restore ${STAFF}` }), 5_000)) await press(admin, [`Restore ${STAFF}`, `Yes, restore ${STAFF}`]);
  }
  await setRole('floor');
}

/** A new number signs in, joins (attribution.spec.ts:35-60), takes the selfie (kyc.spec.ts:121-128) and opens each screen. */
async function newMember(): Promise<void> {
  await member.goto(`${appUrl('player')}/sign-in`);
  await member.getByRole('textbox', { name: 'Mobile number' }).fill(MEMBER_NUMBER);
  await press(member, ['Send code']);
  await member.getByRole('textbox', { name: '6-digit code' }).fill(SIGN_IN_CODE);
  await expect(member.getByRole('heading', { name: 'About you' }), 'SIM_MEMBER_NUMBER has no member (step 1 erases it)').toBeVisible(SLOW);
  night.memberJoined = true;
  await fill(member, { 'Full name, as on Aadhaar': MEMBER, City: 'Gurugram' });
  await pick('Occupation', ['Salaried']);
  await pick('When you usually play', ['Weekday evenings', 'Late nights']);
  await pick('Games you play', ['PLO', 'Bomb pots']);
  await shot(member, 'sign-up');
  await press(member, ['Continue']);
  await shot(member, 'identity', member.getByRole('heading', { name: 'Verify your identity', level: 1 }));
  night.atClub = await present(member.getByText('Aadhaar and PAN at the desk, on your first visit'), 'the club checks identity at the desk');
  if (!night.atClub) return;
  await press(member, ['Take a selfie', 'Take photo', 'Use photo']);
  await shot(member, 'registered', member.getByRole('heading', { name: "You're registered." }));
  await press(member, ["See tonight's tables"]);
  for (const [screen, address] of MEMBER_SCREENS) {
    await (screen === 'Profile' ? member : member.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: screen, exact: true }).click();
    await expect.soft(member).toHaveURL(address);
    await shot(member, `member-${screen}`);
  }
  await press(member, ['Back']);
}

/** Sim 180 Staff on the Live floor: the first open table, else the first closed one, opened from its tile (live-floor.spec.ts:21). */
async function openATable(): Promise<void> {
  await signInToConsole(floor, STAFF_NUMBER);
  // A table's tile is a group with its ⋯ "Settings for <table>" (packages/ui TableTile.tsx:88-98).
  const tiles = floor.getByRole('group').filter({ has: floor.getByRole('button', { name: /^Settings for / }) });
  await expect(tiles.first()).toBeVisible(SLOW);
  const open = tiles.filter({ hasNot: floor.getByRole('button', { name: 'Open table' }) });
  const tile = (await open.count()) > 0 ? open.first() : tiles.first();
  night.table = ((await tile.getByRole('button', { name: /^Settings for / }).first().getAttribute('aria-label')) ?? '').replace(/^Settings for /, '');
  if ((await open.count()) === 0) await tile.getByRole('button', { name: 'Open table' }).first().click();
  await shot(floor, 'floor', floor.getByRole('heading', { name: 'Live floor', level: 1 }));
}

/** The member asks to join (waitlist.spec.ts:22-32); the floor approves (floor-requests.spec.ts:45-52), checks ID when asked. */
async function joinAndApprove(): Promise<void> {
  await member.reload();
  await member.getByRole('button', { name: new RegExp(`^${night.table} · `) }).click();
  await member.getByRole('dialog').getByRole('button', { name: /^Request a seat$/ }).click();
  await expect(member.getByText('Requested', { exact: true })).toBeVisible(SLOW);
  await shot(member, 'requested', member.getByText('Your ID is checked at the desk before you sit.'));
  await (await requestOf(/Join request/)).getByRole('button', { name: 'Approve' }).click();
  await shot(floor, 'approved', floor.getByText(`${MEMBER} added to the ${night.table} list`));
  // Approved with a seat free, the seat sheet opens; it waits (floor-requests.spec.ts:47-51).
  const sheet = floor.getByRole('dialog', { name: 'Seat a player' });
  if (await seen(sheet, 5_000)) await sheet.getByRole('button', { name: 'Cancel' }).click();
  const alert = await requestOf(/To seat|ID check, then seat|Waiting for a seat/);
  if ((await alert.innerText()).includes('ID check')) await deskCheck(alert);
}

/** The check in person that the request's Check ID opens (waitlist-at-the-club.spec.ts:66-79; FloorSheets.tsx:64). */
async function deskCheck(alert: Locator): Promise<void> {
  await alert.getByRole('button', { name: 'Check ID' }).click();
  await floor.getByRole('button', { name: `Check ${MEMBER}` }).click();
  await press(floor, ['Take their photo', 'Take photo', 'Use photo']);
  await floor.getByLabel(`Date of birth on ${MEMBER}'s original document`).fill('1990-04-10');
  await fill(floor, { [`Last four digits of ${MEMBER}'s Aadhaar`]: '1800', [`${MEMBER}'s PAN from the original card`]: 'simps1800s' });
  await floor.getByRole('switch', { name: `${MEMBER} agrees to this identity check` }).click();
  await shot(floor, 'desk-check');
  await floor.getByRole('button', { name: `Verify ${MEMBER}` }).click();
  await expect(floor.getByRole('status').getByText(`${MEMBER} is verified and can take a seat.`)).toBeVisible(SLOW);
  await openFromRail(floor, 'Live floor');
}

/** Seat a player by number with a call time (bonus-chips.spec.ts:92-99, waitlist.spec.ts:202); the phone shows the seat. */
async function seatMember(): Promise<void> {
  await floor.getByRole('button', { name: 'Seat a player' }).click();
  const sheet = floor.getByRole('dialog', { name: 'Seat a player' });
  await sheet.getByRole('radiogroup', { name: 'Table', exact: true }).getByRole('radio', { name: night.table, exact: true }).click();
  await sheet.getByRole('textbox', { name: 'Or a mobile or member number' }).fill(MEMBER_NUMBER);
  await sheet.getByRole('radiogroup', { name: 'Call time' }).getByRole('radio', { name: '4 h', exact: true }).click();
  await shot(floor, 'seat-sheet');
  await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
  const toast = floor.getByText(new RegExp(`^${MEMBER_NUMBER} seated at ${night.table}, seat \\d+$`));
  await expect(toast).toBeVisible(SLOW);
  night.seat = /seat (\d+)$/.exec(await toast.innerText())?.[1] ?? '';
  await member.reload();
  await shot(member, 'seated', member.getByRole('heading', { name: `${night.table} · Seat ${night.seat}` }));
}

/** From the seat, an order the floor accepts, sends and delivers (fnb.spec.ts:37-71). */
async function orderToSeat(): Promise<void> {
  if (!(await present(member.getByRole('button', { name: 'Order to my seat' }), 'Order to my seat on Tonight'))) return;
  await press(member, ['Order to my seat']);
  await expect(member.getByRole('heading', { name: 'Order', level: 1, exact: true })).toBeVisible(SLOW);
  await member.getByRole('button', { name: /^Add / }).first().click();
  await shot(member, 'order');
  await member.getByRole('button', { name: /^Send to the bar/ }).click();
  await openFromRail(floor, 'Food and drink');
  const accept = floor.getByRole('region', { name: 'To accept' }).locator('div').filter({ hasText: `${night.table}, seat ${night.seat} · ${MEMBER}` })
    .filter({ has: floor.getByRole('button', { name: /^Accept KOT \d+$/ }) }).last().getByRole('button', { name: /^Accept KOT \d+$/ });
  const kot = /(\d+)$/.exec((await accept.getAttribute('aria-label')) ?? '')?.[1] ?? '';
  await press(floor, [`Accept KOT ${kot}`, `KOT ${kot} on its way`, `Mark KOT ${kot} delivered`]);
  await shot(floor, 'fnb-delivered', floor.getByText(/^Delivered in /));
  await openFromRail(floor, 'Live floor');
}

/** An hour more, approved; a top-up, started then done (call-time.spec.ts:42-63). */
async function timeAndTopUp(): Promise<void> {
  await member.reload();
  await press(member, ['Add time', 'Request 1 hour']);
  await (await requestOf(/Wants \+1 h/)).getByRole('button', { name: 'Approve' }).click();
  await shot(floor, 'time-approved', floor.getByText(`${MEMBER}: +1 h approved`));
  await member.reload();
  await press(member, ['Top up', 'Request top-up']);
  await (await requestOf(/^Top-up/)).getByRole('button', { name: 'Start' }).click();
  await (await requestOf(/Top-up in progress/)).getByRole('button', { name: 'Done' }).click();
  await shot(floor, 'top-up-done', floor.getByText(`Top-up done for ${MEMBER}`));
}

/** Let go early with a reason (seating.spec.ts:35), out at the Door (sessions.spec.ts:24-27), rated (door-kiosk.spec.ts:72-78). */
async function leaving(): Promise<void> {
  await letGoEarly(floor, MEMBER, 'Floor decision');
  await shot(floor, 'let-go');
  await openFromRail(floor, 'Door');
  await fill(floor, { 'Card, mobile, number or name': MEMBER_NUMBER });
  await press(floor, ['Check out']);
  await shot(floor, 'checked-out', floor.getByText('Checked out.'));
  await member.reload();
  await member.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
  if (!(await present(member.getByRole('heading', { name: 'How was your night?' }), 'Home asks how the night was', 20_000))) return;
  await member.getByRole('radiogroup', { name: 'Your rating, 1 to 5' }).getByRole('radio', { name: '4', exact: true }).click();
  await fill(member, { 'Anything to add? (optional)': 'Staging walk: the night ran as planned.' });
  await shot(member, 'rating');
  await press(member, ['Send to the General Manager']);
  await shot(member, 'rated', member.getByText('Rating sent'));
}

/**
 * Each role in turn, given on Staff; then a fresh sign-in, a minute after the last code (Auth sends one a minute to a
 * number), and every screen the rail lists, Admin unfolded, at 1440 then 390 px (console-fits.spec.ts:77-123).
 */
async function eachRole({ browser }: { browser: Browser }): Promise<void> {
  test.setTimeout(ROLES.length * 300_000 + 60_000);
  const rails: Record<string, string[]> = {};
  let codeAt = 0;
  for (const role of ROLES) {
    await setRole(role);
    const page = await browser.newPage({ viewport: VIEWPORT.console });
    await page.waitForTimeout(Math.max(0, codeAt + 61_000 - Date.now()));
    codeAt = Date.now();
    await signInToConsole(page, STAFF_NUMBER);
    const rail = page.getByRole('navigation', { name: 'Sections' });
    await expect(rail.getByRole('link').first()).toBeVisible(SLOW);
    // Admin folds until opened; unfolded by its state, never by a blind click (console-fits.spec.ts:73-80).
    if (await seen(rail.getByRole('button', { name: 'Admin', expanded: false }), 2_000)) await rail.getByRole('button', { name: 'Admin' }).click().then(() => expect(rail.getByRole('button', { name: 'Admin', expanded: true })).toBeVisible());
    // A link's name is its label; a count follows on a line of its own (packages/ui/src/SideNav/NavItem.tsx:68-74).
    rails[role] = (await rail.getByRole('link').allInnerTexts()).map((text) => text.split('\n')[0]?.trim() ?? '');
    for (const [index, screen] of (rails[role] ?? []).entries()) {
      await page.setViewportSize(VIEWPORT.console);
      await openFromRail(page, screen);
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0, SLOW);
      await shot(page, `${role}-${String(index + 1)}-${screen}-1440`, page.getByRole('main').getByRole('heading', { level: 1 }));
      await page.setViewportSize(VIEWPORT.player);
      await shot(page, `${role}-${String(index + 1)}-${screen}-390`);
    }
    await page.close();
  }
  await test.info().attach('rail-entries.json', { body: JSON.stringify(rails, null, 2), contentType: 'application/json' });
}

/** Sim 180 Staff turned off (staff.spec.ts:51-57) and the member erased; each only once. */
async function cleanUp(): Promise<void> {
  if (night.staffOn) await changeStaff(admin.getByRole('switch', { name: `Active: ${STAFF}` }), 'false', 'Yes, turn it off', 'staff-off');
  if (night.memberJoined) await eraseByNumber(MEMBER_NUMBER, 'End of the staging walk');
  Object.assign(night, { staffOn: false, memberJoined: false });
}

test.describe.serial('Staging journeys', () => {
  test.use({ actionTimeout: 30_000 });
  test.beforeAll(async ({ browser }) => {
    if (STAFF_NUMBER === '' || MEMBER_NUMBER === '' || SIGN_IN_CODE === '') throw new Error('Set SIM_STAFF_NUMBER, SIM_MEMBER_NUMBER and E2E_SIGN_IN_CODE');
    [admin, floor, member] = await Promise.all([browser.newPage({ viewport: VIEWPORT.console }), browser.newPage({ viewport: VIEWPORT.console }), browser.newPage({ viewport: VIEWPORT.player })]);
  });
  // A failed step skips the rest (serial mode), so Sim 180 Staff is still turned off and the member erased.
  test.afterAll(() => (night.staffOn || night.memberJoined ? cleanUp() : undefined));
  test('1. the super admin frees the seed numbers by erasing their members', async () => {
    await signInToConsole(admin, SUPER);
    for (const number of ERASE) {
      if (!(await eraseByNumber(number, 'Freed for the 180-day simulation\'s staging walk'))) test.info().annotations.push({ type: 'skipped', description: `${number}: no member at the club has it` });
    }
  });
  test('2. the super admin adds Sim 180 Staff, a floor manager', addStaff);
  test('3. a new member signs up on a phone, takes the selfie, and opens Home, Rewards, Card, Sessions and Profile', newMember);
  test('4. the floor opens a table; the member joins its list; the floor approves, checks ID and seats them', () => openATable().then(joinAndApprove).then(seatMember));
  test('5. during play the member orders to the seat and asks for more time and a top-up; the floor works each', () => orderToSeat().then(timeAndTopUp));
  test('6. the floor lets the member go early, the desk checks them out, and they rate the night', leaving);
  test('7. Sim 180 Staff opens every screen its rail shows in each role, at 1440 and 390 px', eachRole);
  test('8. clean up: Sim 180 Staff is turned off and the member erased', cleanUp);
});
