/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
import { settings } from './settings.ts';
import { rail } from './consoleRail.ts';
import { shell } from './consoleShell.ts';
import { cage } from './cage.ts';
import { markers } from './credit.ts';
import { activity } from './activity.ts';
import { killSwitch } from './killSwitch.ts';
import { practiceReset, practiceResetFailures, purge, purgeFailures } from './practiceReset.ts';
import { exportArchive, exportArchiveFailures } from './exportArchive.ts';
import { aml, amlFailures } from './aml.ts';
import { roster, rosterFailures } from './roster.ts';
import { cameraFailures, cameras } from './cameras.ts';
import { members, tiers } from './members.ts';
import { checkIn } from './checkIn.ts';
import { liveFloor, timeRequests, todaysPlayers, topUps } from './floor.ts';
import { tablesSetup } from './tablesSetup.ts';
import { floor } from './liveFloorV3.ts';
import { computers, dealerPins, streamOverlay, tablets, tvPairing, tvs, tvScreen } from './devices.ts';
import { highHands } from './highHands.ts';
import { certification } from './training.ts';
import { jackpots } from './jackpots.ts';
import { incidents, sops } from './sops.ts';
import { feedback, playerFeedback } from './feedback.ts';
import { itemPhoto } from './itemPhoto.ts';
import { tournamentInterest } from './tournamentInterest.ts';
import { tournaments } from './tournaments.ts';
import { dealers } from './dealers.ts';
import { potData } from './potData.ts';
import { playerPromotions } from './playerPromotions.ts';
import { promotions } from './promotions.ts';
import { rake } from './rake.ts';
import { playerHouseRules, profile } from './profile.ts';
import { playerSignUp } from './signUp.ts';
import { notStaff, staff } from './staff.ts';
import { playerKyc } from './kyc.ts';
import { kycInPerson, kycInPersonFailures } from './kycInPerson.ts';
import { kycReview, kycReviewFailures } from './kycReview.ts';
import { balance, withdrawals } from './wallet.ts';
import { treasury, treasuryFailures } from './treasury.ts';
import { accounts } from './accounts.ts';
import { expenses } from './expenses.ts';
import { shareholders } from './shareholders.ts';
import { tally } from './tally.ts';
import { ownerDashboard } from './ownerDashboard.ts';
import { reports } from './reports.ts';
import { creators } from './creators.ts';
import { consoleHostQueue } from './consoleHostQueue.ts';
import { consoleSocial } from './consoleSocial.ts';
import { website } from './website.ts';
import { playerSessions } from './sessions.ts';
import { consoleEvents, playerEvents } from './events.ts';
import { exportFilters } from './exportFilters.ts';
import { tds } from './tds.ts';
import { endOfDay, endOfDayFailures } from './endOfDay.ts';
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
  events: playerEvents,
  feedback: playerFeedback,
  promotions: playerPromotions,
  sessions: playerSessions,
  balance,
  /** The digital membership card (#71): the QR the door scans changes every few seconds. */
  card: {
    title: 'Membership card',
    /** The Card tab's title (decision 0320). */
    tab: 'Card',
    qr: 'Your door code',
    /** The member's verified selfie on the card (decision 0300). */
    photo: 'Your photo',
    /** No connection before the card came (F3-25): the door checks a member in by number too. */
    offline: 'Give your number at the door.',
    /** Over the number the phone kept from the last time (F-053). */
    yourNumber: 'Your number',
    /** Under the QR, the first time the card shows in a session (F-182). */
    brightness: 'Turn your brightness up.',
  },
  /** The toast on any screen when bonus chips are added or used while the app is open (decision 0504). */
  bonus: {
    /** `500 bonus chips added · Welcome bonus`. */
    credited: '{chips} bonus chips added · {reason}',
    /** `1,000 bonus chips used for your buy-in at Table 3`. */
    redeemed: '{chips} bonus chips used for your buy-in at {table}',
    redeemedNoTable: '{chips} bonus chips used for your buy-in',
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
  cage,
  markers,
  withdrawals,
  treasury,
  treasuryFailures,
  accounts,
  expenses,
  tds,
  exportFilters,
  tally,
  reports,
  creators,
  social: consoleSocial,
  hostQueue: consoleHostQueue,
  website,
  events: consoleEvents,
  ownerDashboard,
  shareholders,
  endOfDay,
  endOfDayFailures,
  members,
  tiers,
  activity,
  killSwitch,
  practiceReset,
  purge,
  purgeFailures,
  practiceResetFailures,
  exportArchive,
  exportArchiveFailures,
  aml,
  amlFailures,
  roster,
  rosterFailures,
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
  jackpots,
  highHands,
  certification,
  notStaff,
  sops,
  incidents,
  feedback,
  itemPhoto,
  tournaments,
  tournamentInterest,
  potData,
  dealers,
  promotions,
  /** At the foot of the rail: switches the console to the practice venue, where staff train. */
  practice: 'Practice venue',
  /** Across the top of every screen while the console works in the practice venue. */
  practiceBanner: 'Practice venue: nothing here reaches the club or its members.',
  /** A screen the club switched off, opened by its address (C-04). */
  switchedOff: 'Not used at RIVR.',
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
  overlay: streamOverlay,
} as const;

export { webApp } from './web.ts';
