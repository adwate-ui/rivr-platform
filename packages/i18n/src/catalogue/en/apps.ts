/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
import { settings } from './settings.ts';
import { rail } from './consoleRail.ts';
import { shell } from './consoleShell.ts';
import { activity } from './activity.ts';
import { cameraFailures, cameras } from './cameras.ts';
import { members, tiers } from './members.ts';
import { checkIn } from './checkIn.ts';
import { liveFloor, timeRequests, todaysPlayers, topUps } from './floor.ts';
import { tablesSetup } from './tablesSetup.ts';
import { floor } from './liveFloorV3.ts';
import { computers, dealerPins, tablets, tvPairing, tvs, tvScreen } from './devices.ts';
import { feedback, playerFeedback } from './feedback.ts';
import { itemPhoto } from './itemPhoto.ts';
import { tournamentInterest } from './tournamentInterest.ts';
import { playerPromotions } from './playerPromotions.ts';
import { promotions } from './promotions.ts';
import { rake } from './rake.ts';
import { playerHouseRules, profile } from './profile.ts';
import { playerSignUp } from './signUp.ts';
import { notStaff, staff } from './staff.ts';
import { playerKyc } from './kyc.ts';
import { kycInPerson, kycInPersonFailures } from './kycInPerson.ts';
import { kycReview, kycReviewFailures } from './kycReview.ts';
import { reports } from './reports.ts';
import { website } from './website.ts';
import { playerSessions } from './sessions.ts';
import { exportFilters } from './exportFilters.ts';
import { tonight, waitlist } from './waitlist.ts';
import { consoleFnb, playerFnb } from './fnb.ts';
import { playerAlerts, playerNotFound } from './playerAlerts.ts';
import { playerSignIn } from './playerSignIn.ts';
import { playerLive, playerOrder } from './playerLive.ts';

export const playerApp = {
  alerts: playerAlerts,
  notFound: playerNotFound,
  signIn: playerSignIn,
  live: playerLive,
  order: playerOrder,
  tonight,
  fnb: playerFnb,
  feedback: playerFeedback,
  promotions: playerPromotions,
  sessions: playerSessions,
  /** The toast on any screen when bonus chips are added or used while the app is open (decision 0504). */
  bonus: {
    /** `500 bonus chips added · Welcome bonus`. */
    credited: '{chips} Bonus added · {reason}',
    /** `1,000 bonus chips used for your buy-in at Table 3`. */
    redeemed: '{chips} Bonus used for your buy-in at {table}',
    redeemedNoTable: '{chips} Bonus used for your buy-in',
    /** A high hand paid (redesign RD-25): `High hand: Straight flush, Nine high. 10,000 Bonus added.` */
    highHand: 'High hand: {hand}. {chips} Bonus added.',
  },
  profile,
  houseRules: playerHouseRules,
  signUp: playerSignUp,
  kyc: playerKyc,
} as const;

export const consoleApp = {
  liveFloor,
  floor,
  todaysPlayers,
  tablesSetup,
  topUps,
  timeRequests,
  fnb: consoleFnb,
  settings,
  checkIn,
  exportFilters,
  reports,
  website,
  members,
  tiers,
  activity,
  cameras,
  cameraFailures,
  /** The heading while the console finds the staff member's venue, or fails to. */
  title: 'Console',
  rail,
  shell,
  waitlist,
  // Each member named, never spread: a spread can run a getter, so the bundler would keep this whole
  // object, and the console's copy would ship in the player (#344).
  tablets,
  dealerPins,
  staff,
  tvs,
  computers,
  rake,
  notStaff,
  feedback,
  itemPhoto,
  tournamentInterest,
  promotions,
  /** At the foot of the rail: switches the console to the practice venue, where staff train. */
  practice: 'Practice venue',
  /** Across the top of every screen while the console works in the practice venue. */
  practiceBanner: 'Practice venue: nothing here reaches the club or its members.',
  /** A screen opened by address that the staff member's role does not include. */
  notAllowed: 'Not in your role. Ask an admin.',
  /** A role with no screen on the console: investors and dealers (owner, 8 Nov). */
  noScreens: {
    title: 'RIVR console',
    body: 'Nothing on the console for your role yet.',
  },
  kycReview,
  kycReviewFailures,
  kycInPerson,
  kycInPersonFailures,
} as const;

export { tabletApp } from './tablet.ts';

export const displayApp = {
  pairing: tvPairing,
  screen: tvScreen,
} as const;

export { webApp } from './web.ts';
