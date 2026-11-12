/**
 * How the club is reached online, on the website's contacts (#616). Its numbers for calls and WhatsApp are set under
 * Settings, Club, and read from public_club_contact (decision 0582). Kept apart from the package's main entry, which
 * brings Zod with it.
 */
export const CLUB_CONTACT = {
  instagram: 'https://www.instagram.com/rivr.pokerclub/',
  youtube: 'https://www.youtube.com/@rivr.pokerclub',
  email: 'info@rivrpoker.com',
} as const;
