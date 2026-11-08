/** The player app's sign-up copy. */

/**
 * Joining the club after the first code (#631), as the redesign has it (decision 0320): "About you", the name on the
 * player's Aadhaar, the city, then their game in three pickers. The option labels map to the stored values, which do not
 * change. The KYC selfie becomes the profile photo, so sign-up takes none.
 */
export const playerSignUp = {
  title: 'About you',
  /** The top bar's place in joining: sign-up, then identity, said as identity's eyebrow says it. */
  progress: 'Step 1 of 2',
  back: 'Back',
  /** `{phone}` is the number they signed in with: `+91 98765 43210`. */
  phone: 'Signing up with {phone}',
  nameLabel: 'Full name, as on Aadhaar',
  namePlaceholder: 'Ira Kapoor',
  nameInvalid: 'Enter your name in English, as on Aadhaar.',
  cityLabel: 'City',
  cityPlaceholder: 'Gurugram',
  cityInvalid: 'Enter your city.',
  /** A friend's referral code (the owner, 9 Nov): shown from their invite link, or typed. */
  referralLabel: 'Referral code (optional)',
  referralInvalid: 'Letters, numbers, spaces and _ . + - only.',
  referralUnknown: 'No member has that code. Check it, or leave it empty.',
  yourGame: 'Your game',
  select: 'Select',
  selectAny: 'Select any',
  occupationLabel: 'Occupation',
  occupations: {
    salaried: 'Salaried',
    business_owner: 'Business owner',
    independent_professional: 'Self-employed professional',
    student: 'Student',
    homemaker: 'Homemaker',
    retired: 'Retired',
    prefer_not_to_say: 'Prefer not to say',
  },
  occupationNeeded: 'Select your occupation.',
  playTimesLabel: 'When you usually play',
  playTimes: {
    weekday_afternoons: 'Weekday afternoons',
    weekday_evenings: 'Weekday evenings',
    late_night: 'Late nights',
    weekends: 'Weekends',
  },
  /** The games the member plays (#653), any of them. */
  gamesLabel: 'Games you play',
  games: { poker: "Hold'em", plo: 'PLO', bomb: 'Bomb pots', roe: 'ROE' },
  answersInvalid: 'Check your city and your choices, then try again.',
  submit: 'Continue',
  photoFailed: 'Photo not sent. Try again or remove it.',
  stopped: 'Sign-ups are paused. Try again later.',
  unavailable: 'Sign-up is down. Try again shortly.',
} as const;
