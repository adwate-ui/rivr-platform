/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
import { settings } from './settings.ts';
import { cage } from './cage.ts';
import { markers } from './credit.ts';
import { killSwitch } from './killSwitch.ts';
import { members, tiers } from './members.ts';
import { checkIn, liveFloor } from './floor.ts';
import { computers, dealerPins, tablets, tvPairing, tvs, tvScreen } from './devices.ts';
import { highHands } from './highHands.ts';
import { certification } from './training.ts';
import { jackpots } from './jackpots.ts';
import { sops } from './sops.ts';
import { rake } from './rake.ts';
import { notStaff, staff } from './staff.ts';
import { kycInPerson, kycInPersonFailures } from './kycInPerson.ts';
import { kycReview, kycReviewFailures } from './kycReview.ts';
import { balance, withdrawals } from './wallet.ts';
import { treasury, treasuryFailures } from './treasury.ts';
import { endOfDay, endOfDayFailures } from './endOfDay.ts';
import { tonight, waitlist } from './waitlist.ts';

export const playerApp = {
  tonight,
  sessions: { title: 'Sessions', empty: 'No sessions yet.' },
  balance,
  rewards: { title: 'Rewards', empty: 'No rewards yet.' },
  learn: { title: 'Learn', empty: 'No sources yet.' },
  /** RIVR Academy: batches, booking a seat, paying by UPI with the UTR. */
  academy: {
    title: 'RIVR Academy',
    seeBatches: 'See batches',
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
  /** Profile, behind the member's initial. */
  profile: {
    title: 'Profile',
    identity: 'Identity',
    kycIncomplete: 'KYC incomplete. Finish it to join a table.',
    kycReview: 'With staff. They finish your check at the club.',
    kycVerified: 'Verified · DigiLocker and selfie',
    kycRefused: 'Not verified. Speak to the front desk.',
    finishKyc: 'Finish identity check',
    alerts: 'Waitlist alerts',
    alertsHint: 'We tell you when a seat opens in these games.',
    games: 'Games',
    /** The stake for waitlist alerts (#206): one of the club's, or any. */
    stake: 'Stake',
    anyStake: 'Any',
    nlh: 'NLH',
    plo: 'PLO',
    tournaments: 'Tournaments',
    notifications: 'Notifications',
    seatCalls: 'Seat calls',
    seatCallsHint: 'When your seat is ready.',
    callTime: 'Call time',
    callTimeHint: 'When your call time is complete.',
    withdrawals: 'Withdrawals',
    withdrawalsHint: 'When a withdrawal is sent.',
    tournamentStarts: 'Tournaments',
    tournamentStartsHint: 'When a tournament you entered is starting.',
    marketing: 'Promotions and offers',
    marketingHint: 'By WhatsApp and app notification. Stop any time.',
    saveFailed: 'Not saved. Try again.',
    /** Whether the TVs' waitlist board names the member (#326). */
    privacy: 'Privacy',
    nameOnTvs: 'Show my name on the club\'s TVs',
    nameOnTvsHint: 'Your first name and initial on the waitlist board. Off, the board shows your place instead, such as Player 2.',
    /** Shown only to a member with an Academy seat, under the heading RIVR Academy. */
    academyBookings: 'Your Academy bookings',
    /** Limits and self-exclusion (#56), as in the prototype's Profile. */
    limits: 'Limits',
    sessionReminder: 'Session reminder',
    reminderNone: 'None',
    reminderHours: '{hours}h',
    selfExclusion: 'Self-exclusion',
    takeBreak: 'Take a break',
    breakIntro: 'Waitlists and buy-ins close for the period you choose. It cannot be shortened.',
    break1: '24 hours',
    break7: '7 days',
    break30: '30 days',
    /** `{until}` is when a break would end: Wed 17 Feb, 00:10. */
    breakUntil: 'Until {until}',
  },
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
  settings,
  checkIn,
  cage,
  markers,
  withdrawals,
  treasury,
  treasuryFailures,
  endOfDay,
  endOfDayFailures,
  members,
  tiers,
  killSwitch,
  /** The heading while the console finds the staff member's venue, or fails to. */
  title: 'Console',
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
  /** At the foot of the rail: switches the console to the practice venue, where staff train. */
  practice: 'Practice venue',
  /** A screen opened by address that the staff member's role does not include. */
  notAllowed: 'Your role does not include this screen. Ask an admin if you need it.',
  /** Academy batches and bookings, for Academy staff. `{taken}` and `{seats}` are counts. */
  academy: {
    title: 'Academy',
    newBatch: 'New batch',
    batchName: 'Name',
    startsOn: 'First day',
    endsOn: 'Last day',
    seats: 'Seats',
    openBatch: 'Open batch',
    batchInvalid: 'Give the batch a name, a first and last day in order, and 1 to 500 seats.',
    noBatches: 'No batches yet.',
    dates: '{from} to {to}',
    booked: '{taken} of {seats} seats booked',
    closed: 'Closed for booking.',
    noBookings: 'No bookings yet.',
    /** A company's booking: the company, its heads and its contact. */
    company: '{company}, {seats} heads, contact {name}',
    companyOneHead: '{company}, 1 head, contact {name}',
    awaiting: 'Waiting for payment.',
    claimed: 'UTR {utr}, waiting for the cage.',
    paid: 'Paid.',
    /** The UTR field on one booking; `{name}` says whose. */
    utrFor: 'UTR for {name}',
    recordUtr: 'Record UTR',
    utrInvalid: 'Enter the 12-digit UTR from the payment.',
    cancel: 'Cancel booking',
    bookCompany: 'Book for a company',
    contactPhone: 'Contact mobile number',
    companyName: 'Company',
    heads: 'Heads',
    book: 'Book',
    companyInvalid: 'Give the contact\'s 10-digit number, the company and 1 to 100 heads.',
  },
  /** Academy payments the cage checks against the bank. */
  academyPayments: {
    title: 'Academy payments',
    empty: 'No payments to check.',
    payment: 'UTR {utr}',
    found: 'Found in the bank',
    notFound: 'Not in the bank',
    /** The UTR on the screen is not the one on the booking any more. */
    changed: 'The payer changed this UTR to {utr}. Look for the new one.',
    checkNew: 'Check the new UTR',
    /** The staff member who recorded a UTR never confirms it. */
    recordedByYou: 'You recorded this UTR, so another staff member confirms it.',
  },
  /** Why an Academy step did not go through. */
  academyFailures: {
    notAllowed: 'Your role does not allow this. Ask a manager, or another staff member who can.',
    noMember: 'No member has that number. Sign the contact up first.',
    invalid: 'Check the details and try again.',
    full: 'Not enough seats left in this batch. Choose another batch, or fewer heads.',
    closed: 'This batch is closed or has started. Choose another batch.',
    noFee: 'The Academy fees are not set. Set them before booking.',
    noPayment: 'This booking has no payment to act on. Check it again.',
    utrMismatch: 'The payer changed the UTR on this booking. Look for the new one.',
    utrUsed: 'This UTR is already on another booking. Check it with the payer.',
    stopped: 'The venue or this member is frozen. Try again once it is released.',
    unavailable: 'Could not save this. Check the connection and try again.',
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

export const driverApp = {
  pickups: { title: 'Pickups', empty: 'No pickups.' },
} as const;

export const webApp = {
  /** A website page when its content cannot be read. */
  unavailableTitle: 'The website is not available',
  unavailable: 'Try again in a few minutes.',
} as const;
