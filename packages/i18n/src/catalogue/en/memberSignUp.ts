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
};
