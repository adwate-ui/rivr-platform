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
