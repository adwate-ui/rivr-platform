/** The player app's sign-up copy. */

/**
 * Joining the club after the first code (#631): the number they signed in with, an optional photo, the name on the
 * player's Aadhaar, the city, what best describes them and when they usually play.
 */
export const playerSignUp = {
  title: 'About you',
  /** `{phone}` is the number they signed in with: `+91 98765 43210`. */
  phone: 'Mobile {phone}',
  addPhoto: 'Add a photo (optional)',
  photoAdded: 'Photo added.',
  removePhoto: 'Remove the photo',
  photoFailed: 'Photo not sent. Try again or remove it.',
  cityLabel: 'City',
  cityInvalid: 'Enter your city in English letters.',
  occupationLabel: 'What best describes you',
  occupations: {
    salaried: 'Salaried or working professional',
    business_owner: 'Business owner or self-employed',
    independent_professional: 'Independent professional (doctor, lawyer, CA, consultant)',
    student: 'Student',
    homemaker: 'Homemaker',
    retired: 'Retired',
    prefer_not_to_say: 'Prefer not to say',
  },
  occupationNeeded: 'Choose what best describes you.',
  playTimesLabel: 'When you usually play',
  playTimes: {
    weekday_afternoons: 'Weekday afternoons (12:00 to 18:00)',
    weekday_evenings: 'Weekday evenings (18:00 to 22:00)',
    late_night: 'Late night (after 22:00)',
    weekends: 'Weekends',
  },
  /** The games the member plays (#653), any of them. */
  gamesLabel: 'Games you play',
  games: { poker: 'Poker', plo: 'PLO', bomb: 'Bomb', roe: 'ROE' },
  answersInvalid: 'Check your city and your choices, then try again.',
  nameLabel: 'Full name as on your Aadhaar',
  submit: 'Continue',
  /** Signs out, for someone who signed in with the wrong number. */
  otherNumber: 'Use another number',
  nameInvalid: 'Full name in English, as on your Aadhaar.',
  staff: 'Staff join as members at the front desk.',
  stopped: 'Sign-ups are paused. Try again later.',
  unavailable: 'Sign-up is down. Try again shortly.',
} as const;
