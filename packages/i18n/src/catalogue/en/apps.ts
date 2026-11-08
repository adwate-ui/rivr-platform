/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
import { settings } from './settings.ts';
import { rail } from './consoleRail.ts';
import { shell } from './consoleShell.ts';
import { cage } from './cage.ts';
import { markers } from './credit.ts';
import { killSwitch } from './killSwitch.ts';
import { practiceReset, practiceResetFailures, purge, purgeFailures } from './practiceReset.ts';
import { exportArchive, exportArchiveFailures } from './exportArchive.ts';
import { aml, amlFailures } from './aml.ts';
import { roster, rosterFailures } from './roster.ts';
import { cameraFailures, cameras } from './cameras.ts';
import { members, tiers } from './members.ts';
import { checkIn } from './checkIn.ts';
import { liveFloor, tablesSetup, timeRequests, todaysPlayers, topUps } from './floor.ts';
import { floor } from './liveFloorV3.ts';
import { computers, dealerPins, devices, streamOverlay, tablets, tvPairing, tvs, tvScreen } from './devices.ts';
import { highHands } from './highHands.ts';
import { certification } from './training.ts';
import { jackpots } from './jackpots.ts';
import { incidents, sops } from './sops.ts';
import { feedback, playerFeedback } from './feedback.ts';
import { itemPhoto, league, rewards } from './rewards.ts';
import { tournamentInterest } from './tournamentInterest.ts';
import { tournaments } from './tournaments.ts';
import { dealers } from './dealers.ts';
import { potData } from './potData.ts';
import { academy, academyFailures, academyPayments } from './academy.ts';
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
import { spin } from './spin.ts';
import { consoleHostQueue } from './consoleHostQueue.ts';
import { consoleSocial } from './consoleSocial.ts';
import { website } from './website.ts';
import { playerSessions } from './sessions.ts';
import { learnSources } from './learnSources.ts';
import { playerLearn } from './learn.ts';
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
  learn: playerLearn,
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
  /** RIVR Academy: batches, booking a seat, paying by UPI with the UTR. */
  academy: {
    title: 'RIVR Academy',
    seeBatches: 'See batches',
    /** A paid booking's invoice (#249), saved from its page as a PDF. */
    invoice: 'Invoice',
    noInvoice: 'No invoice for this booking yet. It comes once the cage confirms the payment.',
    empty: 'No batches open.',
    yourBookings: 'Your bookings',
    openBatches: 'Open batches',
    dates: '{from} to {to}',
    seatsLeft: 'Seats left: {seats}',
    book: 'Book a seat',
    /** A refused booking, at the top of the screen: `{batch}` is its name, `{reason}` one of the lines below. */
    refused: '{batch}: {reason}',
    full: 'This batch is full.',
    closed: 'This batch is not open for booking.',
    notOpen: 'Academy booking is not open to you.',
    stopped: 'Account paused. Ask at the front desk.',
    noFee: 'The club has not set the Academy fee yet. Try again later.',
    awaitingPayment: 'Booked. Pay to keep your seat.',
    /** Until when an unpaid seat is held: `Tuesday 20 Oct 2026, 15:30`, in IST (#247). */
    payBy: 'Pay by {weekday} {date}, {time}.',
    /** The 48-hour hold has passed; a late payment is still seated (#220). */
    holdLapsed: 'Your seat is no longer held, so it may go to another member. Paying now still seats you.',
    /** The cashier did not find the UTR the member gave; `{utr}` is that UTR. */
    turnedDown: 'The cashier could not find UTR {utr} in the bank. Check it in your UPI app and give it again.',
    /** The cage turned down `{utr}` after the seat's hold had lapsed, so the seat was given up (#222). */
    cancelled: 'Cancelled: UTR {utr} was not found and the hold ended. If you paid, show it at the front desk.',
    pay: 'Pay',
    changeUtr: 'Change the UTR',
    paymentSent: 'Payment sent with UTR {utr}. The cashier checks it against the bank, usually within a day.',
    paid: 'Paid. Your seat is confirmed.',
    payTitle: 'Pay for your seat',
    amount: 'Amount',
    upiId: 'UPI ID',
    payHow: 'Pay from any UPI app, then enter the UTR from that payment.',
    noUpi: 'Paying by UPI is not open yet. Try again later.',
    bookingGone: 'This booking is not open any more.',
    utrLabel: 'UTR',
    sendUtr: 'Send UTR',
    utrInvalid: 'Enter the 12-digit UTR from your payment.',
    utrUsed: 'This UTR was already given for another booking. Check it and try again.',
    /** A UTR given after the seat's hold cannot be changed until the cashier checks it (#222). */
    utrLocked: 'Your seat\'s hold has ended, so this UTR stays until the cashier checks it. To change it, speak to the front desk.',
    unavailable: 'Academy booking is down. Try again shortly.',
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
  spin,
  social: consoleSocial,
  hostQueue: consoleHostQueue,
  website,
  events: consoleEvents,
  learnSources,
  ownerDashboard,
  shareholders,
  endOfDay,
  endOfDayFailures,
  members,
  tiers,
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
  devices,
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
  rewards,
  league,
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
  switchedOff: 'This screen is switched off. Ask a super admin.',
  /** A screen opened by address that the staff member's role does not include. */
  notAllowed: 'Not in your role. Ask an admin.',
  academy,
  academyPayments,
  academyFailures,
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
