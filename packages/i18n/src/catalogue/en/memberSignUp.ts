import { playerSignUp } from './signUp.ts';

/**
 * A member's Sign-up on their record in the console (owner, 8 Nov), read only: the day they joined and their answers, each
 * named as sign-up names it to the member, then how they came. Not given where they gave nothing, or the link had no such
 * code.
 */
export const memberSignUp = {
  signedUp: 'Signed up',
  occupation: 'Occupation',
  occupations: playerSignUp.occupations,
  playTimes: 'When they play',
  playTimeNames: playerSignUp.playTimes,
  games: 'Games',
  gameNames: playerSignUp.games,
  howTheyCame: 'How they came',
  referralCode: 'Referral code',
  creatorCode: 'Creator code',
  campaign: 'Campaign',
  firstSeen: 'First seen',
  notGiven: 'Not given',
  /** Who referred them, which the floor and up set until it is paid (the owner, 25 Nov). */
  referrer: {
    label: 'Referred by',
    none: 'None',
    who: '{name} · {number}',
    paidOn: '{who} · paid {date}',
    add: 'Add referrer',
    change: 'Change referrer',
    search: 'Name, mobile or member number',
    searchFailed: 'Search failed.',
    noMatch: 'No member found.',
    matches: 'Members found',
    askPaidNow: 'Set {name} as the referrer? Both get the referral reward now.',
    askPaidLater: 'Set {name} as the referrer? Both get the referral reward at the first seat.',
    confirm: 'Yes, set referrer',
    done: {
      paid: 'Referrer set. Both got the referral reward.',
      at_first_seat: 'Referrer set. Both get the referral reward at the first seat.',
    },
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      own_record: 'Not on your own record, or with yourself as referrer.',
      locked: 'Already paid. The referrer cannot change.',
      practice: 'Referrals are not paid in the practice venue.',
      no_member: 'No such member.',
      themselves: 'A member cannot refer themselves.',
      no_referrals: 'Their tier has no referrals.',
      self_excluded: 'That member is self-excluded.',
      paused: 'Paused. Try again shortly.',
      busy: 'Too many at once. Try again shortly.',
      unavailable: 'Not saved. Try again.',
    },
  },
  /** The columns a Members export adds (the owner, 9 Nov), beside the answers and codes above; identity documents for super admins. */
  exported: {
    knownAs: 'Name at sign-up',
    ownCode: 'Their referral code',
    lastVisit: 'Last visit',
    joinedWith: 'Joined with code',
    source: 'Campaign source',
    medium: 'Campaign medium',
    campaignName: 'Campaign name',
    content: 'Campaign content',
    term: 'Campaign term',
    kycMethod: 'KYC method',
    kycMethods: { digilocker: 'DigiLocker', pan: 'PAN', manual: 'At the desk' },
    kycVerified: 'KYC verified on',
    dateOfBirth: 'Date of birth',
    pan: 'PAN',
    aadhaar: 'Aadhaar',
    aadhaarName: 'Name on Aadhaar',
    address: 'Address',
  },
};
