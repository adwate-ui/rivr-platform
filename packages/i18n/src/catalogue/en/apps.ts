/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
import { settings } from './settings.ts';
import { rail } from './consoleRail.ts';
import { cage } from './cage.ts';
import { markers } from './credit.ts';
import { killSwitch } from './killSwitch.ts';
import { practiceReset, practiceResetFailures, purge, purgeFailures } from './practiceReset.ts';
import { exportArchive, exportArchiveFailures } from './exportArchive.ts';
import { aml, amlFailures } from './aml.ts';
import { roster, rosterFailures } from './roster.ts';
import { cameraFailures, cameras } from './cameras.ts';
import { members, tiers } from './members.ts';
import { checkIn, liveFloor } from './floor.ts';
import { computers, dealerPins, streamOverlay, tablets, tvPairing, tvs, tvScreen } from './devices.ts';
import { highHands } from './highHands.ts';
import { certification } from './training.ts';
import { jackpots } from './jackpots.ts';
import { incidents, sops } from './sops.ts';
import { feedback, playerFeedback } from './feedback.ts';
import { league, rewards } from './rewards.ts';
import { tournaments } from './tournaments.ts';
import { dealers } from './dealers.ts';
import { potData } from './potData.ts';
import { academy, academyFailures, academyPayments } from './academy.ts';
import { playerPromotions } from './playerPromotions.ts';
import { promotions } from './promotions.ts';
import { rake } from './rake.ts';
import { profile } from './profile.ts';
import { notStaff, staff } from './staff.ts';
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
import { exportFilters } from './exportFilters.ts';
import { tds } from './tds.ts';
import { endOfDay, endOfDayFailures } from './endOfDay.ts';
import { tonight, waitlist } from './waitlist.ts';
import { consoleFnb, playerFnb } from './fnb.ts';

export const playerApp = {
  tonight,
  fnb: playerFnb,
  feedback: playerFeedback,
  promotions: playerPromotions,
  sessions: {
    title: 'Sessions',
    empty: 'No sessions yet.',
    /** TDS certificate data (#93), shown only when TDS was withheld: `Oct–Dec 2026 · RIVR Gaming Pvt Ltd · TAN DELR12345E`. */
    tds: 'TDS withheld',
    tdsFrom: '{quarter} · {legalName} · TAN {tan}',
    tdsAmount: '{tds} under section {section}, from {count} payments',
    noTan: 'not yet given',
    /** A session in the history (#127): `100/200 · 6 h 30 min`. */
    sub: '{stakes} · {hours}',
    /** A tournament in the history, in place of the stakes (#549): `Tournament · place 4 of 61`. */
    tournament: 'Tournament',
    tournamentPlace: 'Tournament · place {place} of {entrants}',
    prize: 'Prize',
    /** A session at several tables, named by the one played longest: `Table 2 and 1 more`. */
    moreTables: '{table} and {count} more',
    /** A club month's totals above its sessions: `3 sessions · 12 h 40 min`. */
    monthSummary: '{count} sessions · {hours}',
    monthSummaryOne: '1 session · {hours}',
    /** A session's detail (design prompt, "Sessions"): bonus chips, TDS and what was paid only when they apply. */
    stake: 'Stake',
    time: 'Time',
    timeRange: '{from} to {to}',
    hours: 'Hours',
    buyIn: 'Buy-in',
    bonus: 'Bonus chips',
    cashOut: 'Cash-out',
    tdsLine: 'TDS withheld',
    /** Under the TDS line when it was withheld on a period's winnings, not the session's alone (#563). */
    tdsOn: { day: 'TDS on the day’s winnings', financial_year: 'TDS on this year’s winnings' },
    paid: 'Paid to you',
    net: 'Net',
    receipt: 'Receipt {reference}',
    notFound: 'This session is not in your history.',
  },
  balance,
  learn: { title: 'Learn', empty: 'No sources yet.' },
  /** The digital membership card (#71): the QR the door scans changes every few seconds. */
  card: { title: 'Membership card', qr: 'Your door code', hint: 'Show this at the door. The code changes every few seconds.' },
  /** RIVR Academy: batches, booking a seat, paying by UPI with the UTR. */
  academy: {
    title: 'RIVR Academy',
    seeBatches: 'See batches',
    /** A paid booking's invoice (#249), saved from its page as a PDF. */
    invoice: 'Invoice',
    noInvoice: 'No invoice for this booking yet. It comes once the cage confirms the payment.',
    empty: 'No batches open right now.',
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
    stopped: 'Your account is paused. Speak to the front desk.',
    noFee: 'The club has not set the Academy fee yet. Try again later.',
    awaitingPayment: 'Booked. Pay to keep your seat.',
    /** Until when an unpaid seat is held: `Tuesday 20 Oct 2026, 15:30`, in IST (#247). */
    payBy: 'Pay by {weekday} {date}, {time}.',
    /** The 48-hour hold has passed; a late payment is still seated (#220). */
    holdLapsed: 'Your seat is no longer held, so it may go to another member. Paying now still seats you.',
    /** The cashier did not find the UTR the member gave; `{utr}` is that UTR. */
    turnedDown: 'The cashier could not find UTR {utr} in the bank. Check it in your UPI app and give it again.',
    /** The cage turned down `{utr}` after the seat's hold had lapsed, so the seat was given up (#222). */
    cancelled: 'Cancelled. The cashier could not find UTR {utr} in the bank, and your seat was no longer held. If you paid, show the payment at the front desk.',
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
    unavailable: 'Academy booking is not available right now. Try again in a few minutes.',
  },
  profile,
  /** Joining the club after the first code: the name on the player's Aadhaar. */
  signUp: {
    title: 'Your name',
    intro: 'Your full name as on your Aadhaar. We check it when you verify your identity.',
    nameLabel: 'Full name as on your Aadhaar',
    submit: 'Continue',
    /** Signs out, for someone who signed in with the wrong number. */
    otherNumber: 'Use another number',
    nameInvalid: 'Enter your full name in English letters, as on your Aadhaar.',
    staff: 'Staff join as members at the front desk.',
    stopped: 'New sign-ups are paused for now. Try again later.',
    unavailable: 'Sign-up is not available right now. Try again in a few minutes.',
  },
  /** KYC: DigiLocker, or a PAN when DigiLocker fails. Only the masked Aadhaar is ever shown. */
  kyc: {
    title: 'Identity',
    intro: 'We check your identity with a selfie and DigiLocker. We keep your photo, masked Aadhaar, PAN, date of birth and address, and nothing else.',
    selfieIntro: 'First, a selfie. Hold the phone at eye level, face inside the frame.',
    takeSelfie: 'Take a selfie',
    notLive: 'We could not use that photo. Face the camera in good light and try again.',
    digilockerIntro: 'Your selfie is in. Next, DigiLocker shares your Aadhaar and PAN with us. We keep the masked Aadhaar only.',
    start: 'Continue with DigiLocker',
    checking: 'Checking your identity',
    verifiedTitle: 'Identity verified',
    dateOfBirthLabel: 'Date of birth',
    aadhaarLabel: 'Aadhaar',
    panLabel: 'PAN',
    continue: 'Continue',
    panTitle: 'PAN',
    panIntro: 'Enter your PAN to finish.',
    panPlaceholder: 'ABCDE1234F',
    verify: 'Verify',
    panInvalid: 'Enter a PAN like ABCDE1234F.',
    dateOfBirthInvalid: 'Enter your date of birth.',
    panRejected: 'This PAN did not match. Check it and the name, then try again.',
    reviewTitle: 'With staff',
    refusedTitle: 'Not verified',
    refused: 'We could not complete your identity check. Speak to the front desk at the club.',
    review: 'Staff will check your documents at the club to finish.',
    stopped: 'Identity checks are paused for now. Try again later.',
    tooManyAttempts: 'Too many tries today. Try again tomorrow, or ask at the club.',
    notConfigured: 'Identity checks are not open yet. Staff will check your documents at the club.',
    unavailable: 'Identity checks are not available right now. Try again in a few minutes.',
  },
} as const;

export const consoleApp = {
  liveFloor,
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
  rewards,
  league,
  tournaments,
  potData,
  dealers,
  promotions,
  /** At the foot of the rail: switches the console to the practice venue, where staff train. */
  practice: 'Practice venue',
  /** A screen opened by address that the staff member's role does not include. */
  notAllowed: 'Your role does not include this screen. Ask an admin if you need it.',
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

export const driverApp = {
  pickups: { title: 'Pickups', empty: 'No pickups.' },
} as const;

export { webApp } from './web.ts';
