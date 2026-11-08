/**
 * How the club is reached (the owner, 3 Nov): one number for calls and WhatsApp. The website's contacts, and the player
 * app's way to the front desk (8 Nov audit, F-184; decision 0540). Kept apart from the package's main entry, which brings
 * Zod with it.
 */
export const CLUB_CONTACT = {
  phone: '+918796580435',
  whatsapp: '918796580435',
  instagram: 'https://www.instagram.com/rivr.pokerclub/',
  youtube: 'https://www.youtube.com/@rivr.pokerclub',
  email: 'info@rivrpoker.com',
} as const;
