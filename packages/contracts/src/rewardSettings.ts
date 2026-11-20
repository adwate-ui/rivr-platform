/**
 * The settings for what members earn by playing: hourly rakeback; and the members' own: the verification bonus and where identity is checked. Part of SETTINGS in settings.ts,
 * kept here to hold that file to its size.
 */
import { z } from 'zod';
import type { SettingDefinition } from './settingDefinition.ts';

// The cap is the most bonus one member gets at one stake in one club week, in whole ₹50 chips.
export const rakebackRate = {
  key: 'rakeback.rate',
  description: 'Hourly rakeback (decision 0245): the share of a member\'s rake at this table type over a club week, in basis points (1000 is 10%), given as bonus each Monday at 06:00 IST, rounded down to whole ₹50 chips, held to the cap and ending after the days given. The rate in force when the week began applies to all of it; none set, or 0, gives none. Only a super admin changes it, with a reason.',
  scope: 'table_type',
  superAdminOnly: true,
  value: z.strictObject({
    basis_points: z.int().min(0).max(10_000),
    cap_paise: z.int().min(5_000).max(10_000_000).multipleOf(5_000).optional(),
    expires_days: z.int().min(1).max(365),
  }),
} as const satisfies SettingDefinition;

/** Identity checked at the club (decision 0502): while Cashfree is not live, a selfie lets a new member in and staff check them at the desk. */
export const kycAtTheClub = {
  key: 'kyc.at_the_club', defaultValue: { enabled: false },
  description: 'Identity checked at the club: a new member takes a selfie in the app and is let in, and staff check their Aadhaar and PAN in person on their first visit, which is final while this is on. Off, members check in the app. None set is off. Only a super admin changes it, with a reason.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ enabled: z.boolean() }),
} as const satisfies SettingDefinition;

/** The Aadhaar bars at the desk (decision 0663): off, the Aadhaar front is photographed whole, for super admins alone. */
export const kycAadhaarCovers = {
  key: 'kyc.aadhaar_covers', defaultValue: { enabled: false },
  description: 'Aadhaar bars at the desk: staff photograph the Aadhaar front under bars that hide its first eight digits and QR code, and say they do. Off, the photo is kept unmasked, for super admins alone. None set is off. Only a super admin changes it, with a reason.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ enabled: z.boolean() }),
} as const satisfies SettingDefinition;

/** The one number the app stores' reviewers sign in with (decision 0575). Set on the day the store apps go in for review; none set is none. */
export const authStoreReviewer = {
  key: 'auth.store_reviewer',
  description: 'The one number the app stores\' reviewers sign in with. Set on the day the store apps go in for review. None set is none.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ phone: z.string().regex(/^\+91[6-9][0-9]{9}$/) }),
} as const satisfies SettingDefinition;

/**
 * The most bonus chips one staff member adds by hand in a club day (the owner, 9 Nov), 10,000 from the start; super admins are not
 * capped, and only they change it. None set is no cap.
 */
export const bonusDailyStaffCap = {
  key: 'bonus.daily_staff_cap',
  description: 'The most Bonus one staff member adds by hand in a club day; an addition past it is refused and the owner hears of it. Super admins are not capped. None set is no cap.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ chips: z.int().min(50).max(1000000) }),
} as const satisfies SettingDefinition;

/**
 * The most bonus an admin or a floor manager adds by hand at once (redesign RD-19): more is refused. Super admins are not
 * capped (the owner, 15 Nov), and only they change it. None set is the most any addition may be, 1,00,000.
 */
export const bonusByHandCap = {
  key: 'bonus.by_hand_cap', defaultValue: { chips: 100000 },
  description: 'The most bonus an admin or a floor manager adds by hand at once; more is refused. Super admins are not capped. None set is 1,00,000.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ chips: z.int().min(50).max(100000) }),
} as const satisfies SettingDefinition;

/**
 * How many days bonus chips last (the owner, 12 Nov; decision 0579): each grant ends that long after it is given, and chips
 * held when it is switched on end that long from then. 0 is never. Only super admins change it. None set is never.
 */
export const bonusExpiryDays = {
  key: 'bonus.expiry_days',
  description: 'How many days Bonus lasts after it is given; Bonus held when it is switched on lasts that long from then. 0 is never. None set is never.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ days: z.int().min(0).max(3650) }),
} as const satisfies SettingDefinition;

/**
 * The share of a member's bonus one visit may redeem (the owner, 12 Nov; decision 0579): of what they held at its first Bonus
 * use, a seat's buy-in or a use without a seat (decision 0706), in whole 50s. Only super admins change it. None set is all of it.
 */
export const bonusVisitCap = {
  key: 'bonus.visit_cap',
  description: 'The share of the Bonus a member held at a visit\'s first Bonus use that they may use in that visit, in whole 50s. None set is all of it.',
  scope: 'venue',
  superAdminOnly: true,
  value: z.strictObject({ basis_points: z.int().min(100).max(10000) }),
} as const satisfies SettingDefinition;

/** The visits a member needs this month before the app offers them a cab (#140); none set is four. */
export const cabMinimumVisits = {
  key: 'cab.minimum_visits',
  description: 'The visits a member needs this month before the app offers them a cab; none set is four.',
  scope: 'venue',
  value: z.strictObject({ visits: z.int().min(1).max(31) }),
} as const satisfies SettingDefinition;
